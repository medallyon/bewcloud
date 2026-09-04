import { Signal, useSignal } from '@preact/signals';

import { fetchExistingFileNames } from './existingFileNames.ts';
import { postToUploadServiceWorker } from '/public/ts/service-worker.ts';

interface FileConflictState {
  isOpen: boolean;
  existingFileName: string;
  onReplace: () => void;
  onSkip: () => void;
  onReplaceAll: () => void;
  onSkipAll: () => void;
  onAbort: () => void;
}

type ConflictResolution = 'upload' | 'replace' | 'skip' | 'abort';

interface UseDragAndDropUploadOptions {
  path: Signal<string>;
  // Caller's own upload-in-progress signal (from useUploadQueue), flipped on immediately on drop so "Uploading..." shows during the tree-walk/conflict-check phase, before enqueueUpload's own progress messages take over.
  isUploading: Signal<boolean>;
  // Caller's own progress/error signals (from useUploadQueue), reused here so a tree-walk failure (before enqueueUpload is ever reached) still shows up, and the dropped folder's name shows during the walk.
  uploadProgress: Signal<string>;
  uploadError: Signal<string>;
  enqueueUpload: (items: { file: File; parentPath: string; overwrite: boolean }[]) => Promise<void>;
  // Called once, right before conflict resolution starts, e.g. to close an open dropdown.
  onBeforeUpload?: () => void;
  // Restricts which dropped/chosen files are uploaded, e.g. Photos only wants images and videos.
  fileFilter?: (file: File) => boolean;
  // Called (in order) for each empty directory found in a directory drop. Files-only wants these created; Photos ignores them.
  onEmptyDirectory?: (directoryPath: string) => Promise<void>;
  // Identifies this view's upload session to the service worker, so Abort Upload only cancels this session's own in-flight job.
  sessionTag?: string;
}

// A single readEntries() call can return a partial batch (historically capped around 100 in Chromium) per the File and Directory Entries API spec, so it must be called repeatedly until it resolves with an empty array to get every entry in the directory. Exported so it can be unit tested directly.
export function readAllDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const allEntries: FileSystemEntry[] = [];

  return new Promise((resolve, reject) => {
    function readNextBatch() {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(allEntries);
          return;
        }

        allEntries.push(...entries);
        readNextBatch();
      }, reject);
    }

    readNextBatch();
  });
}

// Drag-and-drop (and file-input) upload with naming-conflict resolution (replace/skip/replace-all), shared by MainFiles and MainPhotos. Uploads themselves still go through each caller's own useUploadQueue instance (different upload kind/session per view); this hook only resolves conflicts and hands the survivors over.
export function useDragAndDropUpload(
  {
    path,
    isUploading,
    uploadProgress,
    uploadError,
    enqueueUpload,
    onBeforeUpload,
    fileFilter,
    onEmptyDirectory,
    sessionTag = '',
  }: UseDragAndDropUploadOptions,
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

    if (!fileExists) {
      return Promise.resolve('upload');
    }

    if (replaceAllMode.value) {
      return Promise.resolve('replace');
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
          resolve('replace');
        },
        onSkip: () => {
          fileConflictModal.value = null;
          resolve('skip');
        },
        onReplaceAll: () => {
          replaceAllMode.value = true;
          fileConflictModal.value = null;
          resolve('replace');
        },
        onSkipAll: () => {
          skipAllMode.value = true;
          fileConflictModal.value = null;
          resolve('skip');
        },
        onAbort: () => {
          fileConflictModal.value = null;
          // Also stops any upload the service worker already has in flight/queued for this session
          postToUploadServiceWorker({ type: 'ABORT_UPLOADS', sessionTag });
          resolve('abort');
        },
      };
    });
  }

  // Resolves conflicts one file at a time (so a "replace all" picked mid-batch applies to the rest), then enqueues the survivors.
  async function uploadFiles(candidateFiles: File[]) {
    const filesToUpload = fileFilter ? candidateFiles.filter(fileFilter) : candidateFiles;

    if (filesToUpload.length === 0) {
      if (candidateFiles.length > 0) {
        // Something was dropped, but the filter (e.g. Photos wanting only images/videos) rejected all of it.
        uploadError.value = 'No supported files were found in the dropped items.';
      }
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

      if (resolution === 'upload' || resolution === 'replace') {
        itemsToUpload.push({ file, parentPath: targetPath, overwrite: resolution === 'replace' });
      }
    }

    await enqueueUpload(itemsToUpload);

    replaceAllMode.value = false;
    skipAllMode.value = false;
  }

  // Process a single dropped file system entry (file or directory), tagging files with a webkitRelativePath so directory structure survives the upload, and collecting empty directory paths for the caller to create.
  async function processEntry(
    entry: FileSystemEntry,
    currentPath: string,
    filesToUpload: File[],
    directoriesToCreate: string[],
  ): Promise<void> {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));

      // Add webkitRelativePath to maintain directory structure
      Object.defineProperty(file, 'webkitRelativePath', {
        value: currentPath ? `${currentPath}/${file.name}` : file.name,
        writable: false,
      });
      filesToUpload.push(file);
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const dirPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      const entries = await readAllDirectoryEntries(dirEntry.createReader());

      if (entries.length === 0) {
        // Empty directory - add to directories to create
        directoriesToCreate.push(dirPath);
      } else {
        await Promise.all(
          entries.map((childEntry) => processEntry(childEntry, dirPath, filesToUpload, directoriesToCreate)),
        );
      }
    }
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
    if (event.dataTransfer?.types.includes('Files')) {
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

    if (isUploading.value) {
      // A batch is already in flight - don't let a second overlapping drop land on top of it.
      return;
    }

    const hasItems = !!event.dataTransfer?.items && event.dataTransfer.items.length > 0;
    const hasFiles = !!event.dataTransfer?.files && event.dataTransfer.files.length > 0;

    if (!hasItems && !hasFiles) {
      return;
    }

    // Immediate feedback while we walk the dropped tree below, which (for a directory with many files) can itself take a moment before uploadFiles even starts its own conflict check. Must read entry names synchronously here (before any await), since dataTransfer.items becomes invalid once the drop event handler yields.
    const topLevelNames = hasItems
      ? Array.from(event.dataTransfer!.items)
        .map((item) => item.kind === 'file' ? item.webkitGetAsEntry()?.name : undefined)
        .filter((name): name is string => !!name)
      : Array.from(event.dataTransfer!.files).map((file) => file.name);

    isUploading.value = true;
    uploadError.value = '';
    uploadProgress.value = topLevelNames.length === 1
      ? `Uploading ${topLevelNames[0]}...`
      : topLevelNames.length > 1
      ? `Uploading ${topLevelNames.length} items...`
      : '';

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
    handleDrop,
  };
}
