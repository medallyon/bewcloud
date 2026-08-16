import { Signal, useSignal } from '@preact/signals';

import { fetchExistingFileNames } from './existingFileNames.ts';

interface FileConflictState {
  isOpen: boolean;
  existingFileName: string;
  onReplace: () => void;
  onSkip: () => void;
  onReplaceAll: () => void;
  onSkipAll: () => void;
  onAbort: () => void;
}

type ConflictResolution = 'upload' | 'skip' | 'abort';

interface UseDragAndDropUploadOptions {
  path: Signal<string>;
  // Caller's own upload-in-progress signal (from useUploadQueue), flipped on immediately on drop so "Uploading..." shows during the tree-walk/conflict-check phase, before enqueueUpload's own progress messages take over.
  isUploading: Signal<boolean>;
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
  { path, isUploading, enqueueUpload, onBeforeUpload, fileFilter, onEmptyDirectory }: UseDragAndDropUploadOptions,
) {
  const isDraggingOver = useSignal<boolean>(false);
  const dragCounter = useSignal<number>(0);
  const fileConflictModal = useSignal<FileConflictState | null>(null);
  const replaceAllMode = useSignal<boolean>(false);
  const skipAllMode = useSignal<boolean>(false);

  function getTargetPath(file: File): string {
    if (!file.webkitRelativePath) {
      return path.value;
    }

    // Resolve the parent path, keeping any sub-directory structure from directory uploads. We don't need to worry about path joining here, the API will handle it (and make sure it's secure)
    const directoryPath = file.webkitRelativePath.slice(0, -file.name.length);
    return `${path.value}${directoryPath}`;
  }

  // Resolves a naming conflict for a single file, prompting the user unless already in "replace all"/"skip all" mode.
  function resolveFileConflict(
    file: File,
    targetPath: string,
    existingNamesByPath: Map<string, Set<string>>,
  ): Promise<ConflictResolution> {
    const fileExists = existingNamesByPath.get(targetPath)?.has(file.name) ?? false;

    if (!fileExists || replaceAllMode.value) {
      return Promise.resolve('upload');
    }

    if (skipAllMode.value) {
      return Promise.resolve('skip');
    }

    return new Promise((resolve) => {
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
          resolve('abort');
        },
      };
    });
  }

  // Resolves conflicts one file at a time (so a "replace all" picked mid-batch applies to the rest), then enqueues the survivors.
  async function uploadFiles(candidateFiles: File[]) {
    const filesToUpload = fileFilter ? candidateFiles.filter(fileFilter) : candidateFiles;

    if (filesToUpload.length === 0) {
      isUploading.value = false;
      return;
    }

    // Immediate feedback for the conflict-check phase below (a network round-trip per target path), before enqueueUpload's own progress messages take over.
    isUploading.value = true;
    onBeforeUpload?.();
    replaceAllMode.value = false; // Reset replace/skip all mode for new upload session
    skipAllMode.value = false;

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
      const resolution = await resolveFileConflict(file, targetPath, existingNamesByPath);

      if (resolution === 'abort') {
        // Discards everything resolved so far in this batch too, not just the remaining files. enqueueUpload is never reached, so clear the indicator ourselves.
        replaceAllMode.value = false;
        skipAllMode.value = false;
        isUploading.value = false;
        return;
      }

      if (resolution === 'upload') {
        // overwrite is always true here: a file that never conflicted writes normally (a no-op); a file that did conflict only reaches this branch because the user chose Replace/Replace All.
        itemsToUpload.push({ file, parentPath: targetPath, overwrite: true });
      }
    }

    await enqueueUpload(itemsToUpload);

    replaceAllMode.value = false;
    skipAllMode.value = false;
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

    const hasItems = !!event.dataTransfer?.items && event.dataTransfer.items.length > 0;
    const hasFiles = !!event.dataTransfer?.files && event.dataTransfer.files.length > 0;

    if (!hasItems && !hasFiles) {
      return;
    }

    // Immediate feedback while we walk the dropped tree below, which (for a directory with many files) can itself take a moment before uploadFiles even starts its own conflict check.
    isUploading.value = true;

    try {
      if (hasItems) {
        // Use items for directory support
        const { files: droppedFiles, emptyDirectories } = await processDroppedItems(event.dataTransfer!.items);

        for (const directoryPath of emptyDirectories) {
          await onEmptyDirectory?.(directoryPath);
        }

        await uploadFiles(droppedFiles);
      } else {
        // Fallback to files for compatibility
        await uploadFiles(Array.from(event.dataTransfer!.files));
      }
    } catch (error) {
      console.error('Failed to process dropped files:', error);
      isUploading.value = false;
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
