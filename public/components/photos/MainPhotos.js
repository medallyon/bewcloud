import { useSignal } from '@preact/signals';
import { useUploadQueue } from "/public/components/files/useUploadQueue.js";
import CreateDirectoryModal from "/public/components/files/CreateDirectoryModal.js";
import ListFiles from "/public/components/files/ListFiles.js";
import FilesBreadcrumb from "/public/components/files/FilesBreadcrumb.js";
import ListPhotos from "/public/components/photos/ListPhotos.js";
export default function MainPhotos({
  initialDirectories,
  initialFiles,
  initialPath,
  uploadSessionTag
}) {
  const isAdding = useSignal(false);
  const directories = useSignal(initialDirectories);
  const files = useSignal(initialFiles);
  const path = useSignal(initialPath);
  const areNewOptionsOption = useSignal(false);
  const isNewDirectoryModalOpen = useSignal(false);
  const isDraggingOver = useSignal(false);
  const dragCounter = useSignal(0);
  const fileConflictModal = useSignal(null);
  const replaceAllMode = useSignal(false);
  function checkFileExists(fileName, targetPath) {
    const existingFiles = files.value;
    return existingFiles.some(file => file.file_name === fileName && file.parent_path === targetPath);
  }
  function getTargetPath(file) {
    if (!file.webkitRelativePath) {
      return path.value;
    }
    const directoryPath = file.webkitRelativePath.slice(0, -file.name.length);
    return `${path.value}${directoryPath}`;
  }
  function resolveFileConflict(file, targetPath) {
    if (replaceAllMode.value || !checkFileExists(file.name, targetPath)) {
      return Promise.resolve(true);
    }
    return new Promise(resolve => {
      fileConflictModal.value = {
        isOpen: true,
        conflictFile: file,
        existingFileName: file.name,
        onReplace: () => {
          fileConflictModal.value = null;
          resolve(true);
        },
        onSkip: () => {
          fileConflictModal.value = null;
          resolve(false);
        },
        onReplaceAll: () => {
          replaceAllMode.value = true;
          fileConflictModal.value = null;
          resolve(true);
        }
      };
    });
  }
  const {
    isUploading,
    uploadProgress,
    uploadError,
    enqueueUpload
  } = useUploadQueue({
    isEnabled: true,
    path,
    files,
    directories,
    uploadSessionTag,
    uploadKind: 'photo',
    checkExistingFiles: false
  });
  function onClickUploadFile() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*,video/*';
    fileInput.click();
    fileInput.onchange = async event => {
      const chosenFilesList = event.target?.files;
      const chosenFiles = Array.from(chosenFilesList).filter(Boolean);
      if (chosenFiles.length === 0) {
        return;
      }
      areNewOptionsOption.value = false;
      replaceAllMode.value = false;
      const itemsToUpload = [];
      for (const chosenFile of chosenFiles) {
        const targetPath = getTargetPath(chosenFile);
        const shouldUpload = await resolveFileConflict(chosenFile, targetPath);
        if (shouldUpload) {
          itemsToUpload.push({
            file: chosenFile,
            parentPath: targetPath
          });
        }
      }
      await enqueueUpload(itemsToUpload);
      replaceAllMode.value = false;
    };
  }
  async function handleDroppedFiles(droppedFiles) {
    if (droppedFiles.length === 0) return;
    const photoFiles = droppedFiles.filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (photoFiles.length === 0) return;
    areNewOptionsOption.value = false;
    replaceAllMode.value = false;
    const itemsToUpload = [];
    for (const file of photoFiles) {
      const targetPath = getTargetPath(file);
      const shouldUpload = await resolveFileConflict(file, targetPath);
      if (shouldUpload) {
        itemsToUpload.push({
          file,
          parentPath: targetPath
        });
      }
    }
    await enqueueUpload(itemsToUpload);
    replaceAllMode.value = false;
  }
  async function handleDroppedItems(items) {
    const filesToUpload = [];
    await processDroppedItems(items, filesToUpload);
    if (filesToUpload.length > 0) {
      await handleDroppedFiles(filesToUpload);
    }
  }
  async function processDroppedItems(items, filesToUpload) {
    const promises = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          promises.push(processEntry(entry, '', filesToUpload));
        }
      }
    }
    await Promise.all(promises);
  }
  async function processEntry(entry, currentPath, filesToUpload) {
    return new Promise((resolve, reject) => {
      if (entry.isFile) {
        const fileEntry = entry;
        fileEntry.file(file => {
          if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            Object.defineProperty(file, 'webkitRelativePath', {
              value: currentPath ? `${currentPath}/${file.name}` : file.name,
              writable: false
            });
            filesToUpload.push(file);
          }
          resolve();
        }, reject);
      } else if (entry.isDirectory) {
        const dirEntry = entry;
        const dirPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        const reader = dirEntry.createReader();
        reader.readEntries(async entries => {
          try {
            const promises = entries.map(childEntry => processEntry(childEntry, dirPath, filesToUpload));
            await Promise.all(promises);
            resolve();
          } catch (error) {
            reject(error);
          }
        }, reject);
      } else {
        resolve();
      }
    });
  }
  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.value++;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      const hasFiles = Array.from(e.dataTransfer.items).some(item => item.kind === 'file');
      if (hasFiles) {
        isDraggingOver.value = true;
      }
    }
  }
  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.value--;
    if (dragCounter.value === 0) {
      isDraggingOver.value = false;
    }
  }
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    isDraggingOver.value = false;
    dragCounter.value = 0;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      handleDroppedItems(e.dataTransfer.items);
    } else if (e.dataTransfer?.files) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      handleDroppedFiles(droppedFiles);
    }
  }
  function onClickCreateDirectory() {
    if (isNewDirectoryModalOpen.value) {
      isNewDirectoryModalOpen.value = false;
      return;
    }
    isNewDirectoryModalOpen.value = true;
  }
  async function onClickSaveDirectory(newDirectoryName) {
    if (isAdding.value) {
      return;
    }
    if (!newDirectoryName) {
      return;
    }
    areNewOptionsOption.value = false;
    isAdding.value = true;
    try {
      const requestBody = {
        parentPath: path.value,
        name: newDirectoryName
      };
      const response = await fetch(`/api/files/create-directory`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to create directory. ${response.statusText} ${await response.text()}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to create directory!');
      }
      directories.value = [...result.newDirectories];
      isNewDirectoryModalOpen.value = false;
    } catch (error) {
      console.error(error);
    }
    isAdding.value = false;
  }
  function onCloseCreateDirectory() {
    isNewDirectoryModalOpen.value = false;
  }
  function toggleNewOptionsDropdown() {
    areNewOptionsOption.value = !areNewOptionsOption.value;
  }
  return h("div", {
    class: "relative",
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop
  }, isDraggingOver.value && h("div", {
    class: "fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
  }, h("div", {
    class: "bg-[#51A4FB] text-white p-8 rounded-lg border-2 border-dashed border-white max-w-md text-center"
  }, h("img", {
    src: "/public/images/add.svg",
    alt: "Upload",
    class: "white mx-auto mb-4",
    width: 48,
    height: 48
  }), h("h3", {
    class: "text-xl font-semibold mb-2"
  }, "Drop photos here to upload"), h("p", {
    class: "text-sm opacity-90"
  }, "Release to upload images and videos to the current directory"))), h("section", {
    class: "flex flex-row items-center justify-between mb-4"
  }, h("section", {
    class: "flex items-center justify-end w-full"
  }, h(FilesBreadcrumb, {
    path: path.value,
    isShowingPhotos: true
  }), h("section", {
    class: "relative inline-block text-left ml-2"
  }, h("div", null, h("button", {
    class: "inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2",
    type: "button",
    title: "Add new file or directory",
    id: "new-button",
    "aria-expanded": "true",
    "aria-haspopup": "true",
    onClick: () => toggleNewOptionsDropdown()
  }, h("img", {
    src: "/public/images/add.svg",
    alt: "Add new file or directory",
    class: `white ${isAdding.value || isUploading.value ? 'animate-spin' : ''}`,
    width: 20,
    height: 20
  }))), h("div", {
    class: `absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black/15 focus:outline-none ${!areNewOptionsOption.value ? 'hidden' : ''}`,
    role: "menu",
    "aria-orientation": "vertical",
    "aria-labelledby": "new-button",
    tabindex: -1
  }, h("div", {
    class: "py-1"
  }, h("button", {
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickUploadFile(),
    type: "button"
  }, "Upload Photo"), h("button", {
    class: `text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`,
    onClick: () => onClickCreateDirectory(),
    type: "button"
  }, "New Directory")))))), h("section", {
    class: "mx-auto max-w-7xl my-8"
  }, h(ListFiles, {
    directories: directories.value,
    files: [],
    isShowingPhotos: true
  }), h(ListPhotos, {
    files: files.value
  }), h("span", {
    class: `flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`
  }, isAdding.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Creating...") : null, isUploading.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), uploadProgress.value || 'Uploading...') : null, !isAdding.value && !isUploading.value ? h(Fragment, null, "\xA0") : null), uploadError.value ? h("span", {
    class: "flex justify-end items-center text-sm mt-1 mx-2 text-red-400"
  }, "Upload failed \u2014 ", uploadError.value) : null), h(CreateDirectoryModal, {
    isOpen: isNewDirectoryModalOpen.value,
    onClickSave: onClickSaveDirectory,
    onClose: onCloseCreateDirectory
  }), fileConflictModal.value?.isOpen ? h("div", {
    class: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  }, h("div", {
    class: "bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
  }, h("h3", {
    class: "text-lg font-semibold mb-4 text-gray-900"
  }, "File Already Exists"), h("p", {
    class: "text-gray-600 mb-6"
  }, "The file ", h("strong", {
    class: "text-gray-900"
  }, fileConflictModal.value.existingFileName), ' ', "already exists in this location. What would you like to do?"), h("div", {
    class: "flex flex-col sm:flex-row gap-3"
  }, h("button", {
    onClick: fileConflictModal.value.onReplace,
    class: "flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors",
    type: "button"
  }, "Replace"), h("button", {
    onClick: fileConflictModal.value.onSkip,
    class: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors",
    type: "button"
  }, "Skip"), h("button", {
    onClick: fileConflictModal.value.onReplaceAll,
    class: "flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors",
    type: "button"
  }, "Replace All")))) : null);
}