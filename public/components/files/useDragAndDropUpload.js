import { useSignal } from '@preact/signals';
import { fetchExistingFileNames } from "./existingFileNames.js";
import { postToUploadServiceWorker } from '/public/ts/service-worker.ts';
export function useDragAndDropUpload({
  path,
  isUploading,
  uploadProgress,
  uploadError,
  enqueueUpload,
  onBeforeUpload,
  fileFilter,
  onEmptyDirectory
}) {
  const isDraggingOver = useSignal(false);
  const dragCounter = useSignal(0);
  const fileConflictModal = useSignal(null);
  const replaceAllMode = useSignal(false);
  const skipAllMode = useSignal(false);
  function getTargetPath(file) {
    if (!file.webkitRelativePath) {
      return path.value;
    }
    const directoryPath = file.webkitRelativePath.slice(0, -file.name.length);
    return `${path.value}${directoryPath}`;
  }
  function resolveFileConflict(file, targetPath, existingNamesByPath) {
    const fileExists = existingNamesByPath.get(targetPath)?.has(file.name) ?? false;
    if (!fileExists || replaceAllMode.value) {
      return Promise.resolve('upload');
    }
    if (skipAllMode.value) {
      return Promise.resolve('skip');
    }
    return new Promise(resolve => {
      fileConflictModal.value = {
        isOpen: true,
        existingFileName: file.name,
        onReplace: () => {
          fileConflictModal.value = null;
          resolve('upload');
        },
        onSkip: () => {
          fileConflictModal.value = null;
          resolve('skip');
        },
        onReplaceAll: () => {
          replaceAllMode.value = true;
          fileConflictModal.value = null;
          resolve('upload');
        },
        onSkipAll: () => {
          skipAllMode.value = true;
          fileConflictModal.value = null;
          resolve('skip');
        },
        onAbort: () => {
          fileConflictModal.value = null;
          postToUploadServiceWorker({
            type: 'ABORT_UPLOADS'
          });
          resolve('abort');
        }
      };
    });
  }
  async function uploadFiles(candidateFiles) {
    const filesToUpload = fileFilter ? candidateFiles.filter(fileFilter) : candidateFiles;
    if (filesToUpload.length === 0) {
      isUploading.value = false;
      return;
    }
    isUploading.value = true;
    onBeforeUpload?.();
    replaceAllMode.value = false;
    skipAllMode.value = false;
    const targetPaths = [...new Set(filesToUpload.map(getTargetPath))];
    const existingNamesByPath = new Map(await Promise.all(targetPaths.map(async targetPath => [targetPath, await fetchExistingFileNames(targetPath)])));
    const itemsToUpload = [];
    for (const file of filesToUpload) {
      const targetPath = getTargetPath(file);
      const resolution = await resolveFileConflict(file, targetPath, existingNamesByPath);
      if (resolution === 'abort') {
        replaceAllMode.value = false;
        skipAllMode.value = false;
        isUploading.value = false;
        return;
      }
      if (resolution === 'upload') {
        itemsToUpload.push({
          file,
          parentPath: targetPath,
          overwrite: true
        });
      }
    }
    await enqueueUpload(itemsToUpload);
    replaceAllMode.value = false;
    skipAllMode.value = false;
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
    if (event.dataTransfer?.types.includes('Files')) {
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
    const hasItems = !!event.dataTransfer?.items && event.dataTransfer.items.length > 0;
    const hasFiles = !!event.dataTransfer?.files && event.dataTransfer.files.length > 0;
    if (!hasItems && !hasFiles) {
      return;
    }
    const topLevelNames = hasItems ? Array.from(event.dataTransfer.items).map(item => item.kind === 'file' ? item.webkitGetAsEntry()?.name : undefined).filter(name => !!name) : Array.from(event.dataTransfer.files).map(file => file.name);
    isUploading.value = true;
    uploadError.value = '';
    uploadProgress.value = topLevelNames.length === 1 ? `Uploading ${topLevelNames[0]}...` : topLevelNames.length > 1 ? `Uploading ${topLevelNames.length} items...` : '';
    try {
      if (hasItems) {
        const {
          files: droppedFiles,
          emptyDirectories
        } = await processDroppedItems(event.dataTransfer.items);
        for (const directoryPath of emptyDirectories) {
          await onEmptyDirectory?.(directoryPath);
        }
        await uploadFiles(droppedFiles);
      } else {
        await uploadFiles(Array.from(event.dataTransfer.files));
      }
    } catch (error) {
      console.error('Failed to process dropped files:', error);
      uploadError.value = error instanceof Error ? error.message : String(error);
      isUploading.value = false;
      uploadProgress.value = '';
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