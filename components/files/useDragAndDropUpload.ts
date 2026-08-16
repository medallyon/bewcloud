import { Signal, useSignal } from '@preact/signals';

import { fetchExistingFileNames } from './existingFileNames.ts';

interface FileConflictState {
  isOpen: boolean;
  existingFileName: string;
  onReplace: () => void;
  onSkip: () => void;
  onReplaceAll: () => void;
}

interface UseDragAndDropUploadOptions {
  path: Signal<string>;
  enqueueUpload: (items: { file: File; parentPath: string; overwrite: boolean }[]) => Promise<void>;
  // Called once, right before conflict resolution starts, e.g. to close an open dropdown.
  onBeforeUpload?: () => void;
  // Restricts which dropped/chosen files are uploaded, e.g. Photos only wants images and videos.
  fileFilter?: (file: File) => boolean;
  // Called (in order) for each empty directory found in a directory drop. Files-only wants these created; Photos ignores them.
  onEmptyDirectory?: (directoryPath: string) => Promise<void>;
}

// Drag-and-drop (and file-input) upload with naming-conflict resolution (replace/skip/replace-all), shared by MainFiles and MainPhotos. Uploads themselves still go through each caller's own useUploadQueue instance (different upload kind/session per view); this hook only resolves conflicts and hands the survivors over.
export function useDragAndDropUpload(
  { path, enqueueUpload, onBeforeUpload, fileFilter, onEmptyDirectory }: UseDragAndDropUploadOptions,
) {
  const isDraggingOver = useSignal<boolean>(false);
  const dragCounter = useSignal<number>(0);
  const fileConflictModal = useSignal<FileConflictState | null>(null);
  const replaceAllMode = useSignal<boolean>(false);

  function getTargetPath(file: File): string {
    if (!file.webkitRelativePath) {
      return path.value;
    }

    // Resolve the parent path, keeping any sub-directory structure from directory uploads. We don't need to worry about path joining here, the API will handle it (and make sure it's secure)
    const directoryPath = file.webkitRelativePath.slice(0, -file.name.length);
    return `${path.value}${directoryPath}`;
  }

  // Resolves a naming conflict for a single file, prompting the user unless already in "replace all" mode. Returns whether the file should be uploaded.
  function resolveFileConflict(
    file: File,
    targetPath: string,
    existingNamesByPath: Map<string, Set<string>>,
  ): Promise<boolean> {
    const fileExists = existingNamesByPath.get(targetPath)?.has(file.name) ?? false;

    if (replaceAllMode.value || !fileExists) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
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
        },
      };
    });
  }

  // Resolves conflicts one file at a time (so a "replace all" picked mid-batch applies to the rest), then enqueues the survivors.
  async function uploadFiles(candidateFiles: File[]) {
    const filesToUpload = fileFilter ? candidateFiles.filter(fileFilter) : candidateFiles;

    if (filesToUpload.length === 0) {
      return;
    }

    onBeforeUpload?.();
    replaceAllMode.value = false; // Reset replace all mode for new upload session

    // Check every target path a dropped file will land in (not just the currently-viewed directory), so conflicts in dragged subdirectories are caught too.
    const targetPaths = [...new Set(filesToUpload.map(getTargetPath))];
    const existingNamesByPath = new Map(
      await Promise.all(
        targetPaths.map(async (targetPath) => [targetPath, await fetchExistingFileNames(targetPath)] as const),
      ),
    );

    const itemsToUpload: { file: File; parentPath: string; overwrite: boolean }[] = [];

    for (const file of filesToUpload) {
      const targetPath = getTargetPath(file);
      const shouldUpload = await resolveFileConflict(file, targetPath, existingNamesByPath);

      if (shouldUpload) {
        // Always true: a file that never conflicted writes normally (overwrite is a no-op then); a file that did conflict only gets here because the user chose Replace/Replace All.
        itemsToUpload.push({ file, parentPath: targetPath, overwrite: true });
      }
    }

    await enqueueUpload(itemsToUpload);

    replaceAllMode.value = false;
  }

  // Process a single dropped file system entry (file or directory), tagging files with a webkitRelativePath so directory structure survives the upload, and collecting empty directory paths for the caller to create.
  function processEntry(
    entry: FileSystemEntry,
    currentPath: string,
    filesToUpload: File[],
    directoriesToCreate: string[],
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        fileEntry.file((file) => {
          // Add webkitRelativePath to maintain directory structure
          Object.defineProperty(file, 'webkitRelativePath', {
            value: currentPath ? `${currentPath}/${file.name}` : file.name,
            writable: false,
          });
          filesToUpload.push(file);
          resolve();
        }, reject);
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const dirPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

        const reader = dirEntry.createReader();
        reader.readEntries(async (entries) => {
          try {
            if (entries.length === 0) {
              // Empty directory - add to directories to create
              directoriesToCreate.push(dirPath);
            } else {
              await Promise.all(
                entries.map((childEntry) => processEntry(childEntry, dirPath, filesToUpload, directoriesToCreate)),
              );
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

  // Recursively walks dropped items (which may be directories) into a flat file list plus any empty directory paths.
  async function processDroppedItems(
    items: DataTransferItemList,
  ): Promise<{ files: File[]; emptyDirectories: string[] }> {
    const filesToUpload: File[] = [];
    const directoriesToCreate: string[] = [];
    const promises: Promise<void>[] = [];

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

    return { files: filesToUpload, emptyDirectories: directoriesToCreate };
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    dragCounter.value++;
    if (event.dataTransfer?.items && event.dataTransfer.items.length > 0) {
      isDraggingOver.value = true;
    }
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    dragCounter.value--;
    if (dragCounter.value === 0) {
      isDraggingOver.value = false;
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    isDraggingOver.value = false;
    dragCounter.value = 0;

    try {
      if (event.dataTransfer?.items && event.dataTransfer.items.length > 0) {
        // Use items for directory support
        const { files: droppedFiles, emptyDirectories } = await processDroppedItems(event.dataTransfer.items);

        for (const directoryPath of emptyDirectories) {
          await onEmptyDirectory?.(directoryPath);
        }

        await uploadFiles(droppedFiles);
      } else if (event.dataTransfer?.files) {
        // Fallback to files for compatibility
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
    handleDrop,
  };
}
