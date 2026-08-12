import { useSignal } from '@preact/signals';
import { createDirectory } from "./fileActions.js";
export function useFileUploadDrop({
  path,
  files,
  directories,
  enqueueUpload,
  onUploadStart
}) {
  const isDraggingOver = useSignal(false);
  const dragCounter = useSignal(0);
  const isCreatingDirectories = useSignal(false);
  const currentDirectoryName = useSignal('');
  const fileConflictModal = useSignal(null);
  const replaceAllMode = useSignal(false);
  function checkFileExists(fileName, targetPath) {
    const existingFiles = files.value;
    return existingFiles.some(file => file.file_name === fileName && file.parent_path === targetPath);
  }
  function getTargetPath(file) {
    if (file.webkitRelativePath) {
      const directoryPath = file.webkitRelativePath.replace(file.name, '');
      return directoryPath ? `${path.value}${directoryPath}`.replace(/\/+$/, '') : path.value;
    }
    return path.value;
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
  async function uploadFiles(filesToUpload) {
    if (filesToUpload.length === 0) {
      return;
    }
    onUploadStart?.();
    replaceAllMode.value = false;
    const itemsToUpload = [];
    for (const file of filesToUpload) {
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
    const directoriesToCreate = [];
    await processDroppedItems(items, filesToUpload, directoriesToCreate);
    for (const dirPath of directoriesToCreate) {
      await createDirectoryFromPath(dirPath);
    }
    if (filesToUpload.length > 0) {
      await uploadFiles(filesToUpload);
    }
  }
  async function processDroppedItems(items, filesToUpload, directoriesToCreate) {
    const promises = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          promises.push(processEntry(entry, '', filesToUpload, directoriesToCreate));
        }
      }
    }
    await Promise.all(promises);
  }
  function processEntry(entry, currentPath, filesToUpload, directoriesToCreate) {
    return new Promise((resolve, reject) => {
      if (entry.isFile) {
        const fileEntry = entry;
        fileEntry.file(file => {
          Object.defineProperty(file, 'webkitRelativePath', {
            value: currentPath ? `${currentPath}/${file.name}` : file.name,
            writable: false
          });
          filesToUpload.push(file);
          resolve();
        }, reject);
      } else if (entry.isDirectory) {
        const dirEntry = entry;
        const dirPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        const reader = dirEntry.createReader();
        reader.readEntries(async entries => {
          try {
            if (entries.length === 0) {
              directoriesToCreate.push(dirPath);
            } else {
              const promises = entries.map(childEntry => processEntry(childEntry, dirPath, filesToUpload, directoriesToCreate));
              await Promise.all(promises);
            }
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
  async function createDirectoryFromPath(dirPath) {
    try {
      isCreatingDirectories.value = true;
      currentDirectoryName.value = dirPath;
      const result = await createDirectory(path.value, dirPath);
      directories.value = [...result.newDirectories];
    } catch (error) {
      console.error(`Failed to create directory ${dirPath}:`, error);
    } finally {
      isCreatingDirectories.value = false;
      currentDirectoryName.value = '';
    }
  }
  function handleDragEnter(event) {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.value++;
    if (event.dataTransfer?.items && event.dataTransfer.items.length > 0) {
      isDraggingOver.value = true;
    }
  }
  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.value--;
    if (dragCounter.value === 0) {
      isDraggingOver.value = false;
    }
  }
  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
  }
  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingOver.value = false;
    dragCounter.value = 0;
    if (event.dataTransfer?.items && event.dataTransfer.items.length > 0) {
      handleDroppedItems(event.dataTransfer.items);
    } else if (event.dataTransfer?.files) {
      const droppedFiles = Array.from(event.dataTransfer.files);
      uploadFiles(droppedFiles);
    }
  }
  return {
    isDraggingOver,
    isCreatingDirectories,
    currentDirectoryName,
    fileConflictModal,
    uploadFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop
  };
}