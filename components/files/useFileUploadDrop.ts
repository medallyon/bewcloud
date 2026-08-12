import { Signal, useSignal } from '@preact/signals';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { createDirectory } from './fileActions.ts';
import { INTERNAL_DRAG_TYPE } from './useInternalDragAndDrop.ts';

export interface FileConflictModal {
  isOpen: boolean;
  conflictFile: File | null;
  existingFileName: string;
  onReplace: () => void;
  onSkip: () => void;
  onReplaceAll: () => void;
}

interface UseFileUploadDropOptions {
  path: Signal<string>;
  files: Signal<DirectoryFile[]>;
  directories: Signal<Directory[]>;
  enqueueUpload: (items: { file: File; parentPath: string }[]) => Promise<void>;
  /** Lets the caller close whatever menu was open when an upload starts. */
  onUploadStart?: () => void;
}

// Owns everything about getting files from the user's machine into the current directory: conflict prompts, recursive
// directory drops, and the external-drop handlers. Internal drag-and-drop of existing items hangs off the same element,
// so keeping this here gives that guard one unambiguous home.
export function useFileUploadDrop(
  { path, files, directories, enqueueUpload, onUploadStart }: UseFileUploadDropOptions,
) {
  const isDraggingOver = useSignal<boolean>(false);
  const dragCounter = useSignal<number>(0);

  // Directory creation progress state
  const isCreatingDirectories = useSignal<boolean>(false);
  const currentDirectoryName = useSignal<string>('');

  // File conflict resolution state
  const fileConflictModal = useSignal<FileConflictModal | null>(null);
  const replaceAllMode = useSignal<boolean>(false);

  // Helper function to check if a file already exists
  function checkFileExists(fileName: string, targetPath: string): boolean {
    const existingFiles = files.value;
    return existingFiles.some((file) => file.file_name === fileName && file.parent_path === targetPath);
  }

  // Helper function to get the target path for a file (considering webkitRelativePath)
  function getTargetPath(file: File): string {
    if ((file as any).webkitRelativePath) {
      const directoryPath = (file as any).webkitRelativePath.replace(file.name, '');
      return directoryPath ? `${path.value}${directoryPath}`.replace(/\/+$/, '') : path.value;
    }
    return path.value;
  }

  // Resolves a naming conflict for a single file, prompting the user unless already in "replace all" mode. Returns whether the file should be uploaded.
  function resolveFileConflict(file: File, targetPath: string): Promise<boolean> {
    if (replaceAllMode.value || !checkFileExists(file.name, targetPath)) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
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
        },
      };
    });
  }

  // Resolves conflicts for a batch of files, then hands the survivors to the upload queue
  async function uploadFiles(filesToUpload: File[]) {
    if (filesToUpload.length === 0) {
      return;
    }

    onUploadStart?.();
    replaceAllMode.value = false; // Reset replace all mode for new upload session

    const itemsToUpload: { file: File; parentPath: string }[] = [];

    for (const file of filesToUpload) {
      const targetPath = getTargetPath(file);
      const shouldUpload = await resolveFileConflict(file, targetPath);

      if (shouldUpload) {
        itemsToUpload.push({ file, parentPath: targetPath });
      }
    }

    await enqueueUpload(itemsToUpload);

    replaceAllMode.value = false;
  }

  // Handle directory drops (including empty directories)
  async function handleDroppedItems(items: DataTransferItemList) {
    const filesToUpload: File[] = [];
    const directoriesToCreate: string[] = [];

    // Process all dropped items
    await processDroppedItems(items, filesToUpload, directoriesToCreate);

    // Create empty directories first
    for (const dirPath of directoriesToCreate) {
      await createDirectoryFromPath(dirPath);
    }

    // Upload files
    if (filesToUpload.length > 0) {
      await uploadFiles(filesToUpload);
    }
  }

  // Recursively process dropped items to extract files and empty directories
  async function processDroppedItems(
    items: DataTransferItemList,
    filesToUpload: File[],
    directoriesToCreate: string[],
  ): Promise<void> {
    const promises: Promise<void>[] = [];

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

  // Process a single file system entry (file or directory)
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
              // Process all entries in the directory
              const promises = entries.map((childEntry) =>
                processEntry(childEntry, dirPath, filesToUpload, directoriesToCreate)
              );
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

  // Create a directory from a relative path
  async function createDirectoryFromPath(dirPath: string) {
    try {
      isCreatingDirectories.value = true;
      currentDirectoryName.value = dirPath;

      // The API handles nested path creation
      const result = await createDirectory(path.value, dirPath);

      directories.value = [...result.newDirectories];
    } catch (error) {
      console.error(`Failed to create directory ${dirPath}:`, error);
    } finally {
      isCreatingDirectories.value = false;
      currentDirectoryName.value = '';
    }
  }

  // An internal item drag also reports dataTransfer.items, so without this guard dragging a file onto a folder would
  // raise the full-screen upload overlay and then drop into the upload path with zero entries
  function isInternalItemDrag(event: DragEvent) {
    return Boolean(event.dataTransfer?.types.includes(INTERNAL_DRAG_TYPE));
  }

  // Drag and drop event handlers
  function handleDragEnter(event: DragEvent) {
    if (isInternalItemDrag(event)) {
      return;
    }

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

  function handleDrop(event: DragEvent) {
    if (isInternalItemDrag(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    isDraggingOver.value = false;
    dragCounter.value = 0;

    if (event.dataTransfer?.items && event.dataTransfer.items.length > 0) {
      // Use items for better directory support
      handleDroppedItems(event.dataTransfer.items);
    } else if (event.dataTransfer?.files) {
      // Fallback to files for compatibility
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
    handleDrop,
  };
}
