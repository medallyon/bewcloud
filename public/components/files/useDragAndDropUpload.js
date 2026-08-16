import { useSignal } from '@preact/signals';
import { fetchExistingFileNames } from "./existingFileNames.js";
export function useDragAndDropUpload({
  path,
  enqueueUpload,
  onBeforeUpload,
  fileFilter,
  onEmptyDirectory
}) {
  const isDraggingOver = useSignal(false);
  const dragCounter = useSignal(0);
  const fileConflictModal = useSignal(null);
  const replaceAllMode = useSignal(false);
  function getTargetPath(file) {
    if (!file.webkitRelativePath) {
      return path.value;
    }
    const directoryPath = file.webkitRelativePath.slice(0, -file.name.length);
    return `${path.value}${directoryPath}`;
  }
  function resolveFileConflict(file, targetPath, existingNamesByPath) {
    const fileExists = existingNamesByPath.get(targetPath)?.has(file.name) ?? false;
    if (replaceAllMode.value || !fileExists) {
      return Promise.resolve(true);
    }
    return new Promise(resolve => {
      fileConflictModal.value = {
        isOpen: true,
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
  async function uploadFiles(candidateFiles) {
    const filesToUpload = fileFilter ? candidateFiles.filter(fileFilter) : candidateFiles;
    if (filesToUpload.length === 0) {
      return;
    }
    onBeforeUpload?.();
    replaceAllMode.value = false;
    const targetPaths = [...new Set(filesToUpload.map(getTargetPath))];
    const existingNamesByPath = new Map(await Promise.all(targetPaths.map(async targetPath => [targetPath, await fetchExistingFileNames(targetPath)])));
    const itemsToUpload = [];
    for (const file of filesToUpload) {
      const targetPath = getTargetPath(file);
      const shouldUpload = await resolveFileConflict(file, targetPath, existingNamesByPath);
      if (shouldUpload) {
        itemsToUpload.push({
          file,
          parentPath: targetPath,
          overwrite: true
        });
      }
    }
    await enqueueUpload(itemsToUpload);
    replaceAllMode.value = false;
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
              await Promise.all(entries.map(childEntry => processEntry(childEntry, dirPath, filesToUpload, directoriesToCreate)));
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
  async function processDroppedItems(items) {
    const filesToUpload = [];
    const directoriesToCreate = [];
    const promises = [];
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          promises.push(processEntry(entry, '', filesToUpload, directoriesToCreate));
        }
      }
    }
    await Promise.all(promises);
    return {
      files: filesToUpload,
      emptyDirectories: directoriesToCreate
    };
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
  async function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingOver.value = false;
    dragCounter.value = 0;
    try {
      if (event.dataTransfer?.items && event.dataTransfer.items.length > 0) {
        const {
          files: droppedFiles,
          emptyDirectories
        } = await processDroppedItems(event.dataTransfer.items);
        for (const directoryPath of emptyDirectories) {
          await onEmptyDirectory?.(directoryPath);
        }
        await uploadFiles(droppedFiles);
      } else if (event.dataTransfer?.files) {
        await uploadFiles(Array.from(event.dataTransfer.files));
      }
    } catch (error) {
      console.error('Failed to process dropped files:', error);
    }
  }
  return {
    isDraggingOver,
    fileConflictModal,
    uploadFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop
  };
}