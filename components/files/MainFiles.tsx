import { useSignal } from '@preact/signals';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { SortColumn, sortDirectories, sortFiles, SortOrder, TRASH_PATH } from '/public/ts/utils/files.ts';
import { RequestBody as RenameRequestBody, ResponseBody as RenameResponseBody } from '/pages/api/files/rename.ts';
import { RequestBody as MoveRequestBody, ResponseBody as MoveResponseBody } from '/pages/api/files/move.ts';
import { RequestBody as DeleteRequestBody, ResponseBody as DeleteResponseBody } from '/pages/api/files/delete.ts';
import {
  RequestBody as CreateDirectoryRequestBody,
  ResponseBody as CreateDirectoryResponseBody,
} from '/pages/api/files/create-directory.ts';
import {
  RequestBody as RenameDirectoryRequestBody,
  ResponseBody as RenameDirectoryResponseBody,
} from '/pages/api/files/rename-directory.ts';
import {
  RequestBody as MoveDirectoryRequestBody,
  ResponseBody as MoveDirectoryResponseBody,
} from '/pages/api/files/move-directory.ts';
import {
  RequestBody as DeleteDirectoryRequestBody,
  ResponseBody as DeleteDirectoryResponseBody,
} from '/pages/api/files/delete-directory.ts';
import {
  RequestBody as CreateShareRequestBody,
  ResponseBody as CreateShareResponseBody,
} from '/pages/api/files/create-share.ts';
import {
  RequestBody as UpdateShareRequestBody,
  ResponseBody as UpdateShareResponseBody,
} from '/pages/api/files/update-share.ts';
import {
  RequestBody as DeleteShareRequestBody,
  ResponseBody as DeleteShareResponseBody,
} from '/pages/api/files/delete-share.ts';
import { postToUploadServiceWorker, useUploadQueue } from './useUploadQueue.ts';
import SearchFiles from './SearchFiles.tsx';
import ListFiles from './ListFiles.tsx';
import FilesBreadcrumb from './FilesBreadcrumb.tsx';
import CreateDirectoryModal from './CreateDirectoryModal.tsx';
import RenameDirectoryOrFileModal from './RenameDirectoryOrFileModal.tsx';
import MoveDirectoryOrFileModal from './MoveDirectoryOrFileModal.tsx';
import CreateShareModal from './CreateShareModal.tsx';
import ManageShareModal from './ManageShareModal.tsx';

interface MainFilesProps {
  initialDirectories: Directory[];
  initialFiles: DirectoryFile[];
  initialPath: string;
  baseUrl: string;
  isFileSharingAllowed: boolean;
  areDirectoryDownloadsAllowed: boolean;
  fileShareId?: string;
  initialSortBy?: SortColumn;
  initialSortOrder?: SortOrder;
  uploadSessionTag?: string;
}

export default function MainFiles(
  {
    initialDirectories,
    initialFiles,
    initialPath,
    baseUrl,
    isFileSharingAllowed,
    areDirectoryDownloadsAllowed,
    fileShareId,
    initialSortBy = 'name',
    initialSortOrder = 'asc',
    uploadSessionTag,
  }: MainFilesProps,
) {
  const isAdding = useSignal<boolean>(false);
  const isDeleting = useSignal<boolean>(false);
  const isUpdating = useSignal<boolean>(false);
  const directories = useSignal<Directory[]>(initialDirectories);
  const files = useSignal<DirectoryFile[]>(initialFiles);
  const path = useSignal<string>(initialPath);
  const sortBy = useSignal<SortColumn>(initialSortBy);
  const sortOrder = useSignal<SortOrder>(initialSortOrder);
  const chosenDirectories = useSignal<Pick<Directory, 'parent_path' | 'directory_name'>[]>([]);
  const chosenFiles = useSignal<Pick<DirectoryFile, 'parent_path' | 'file_name'>[]>([]);
  const isAnyItemChosen = chosenDirectories.value.length > 0 || chosenFiles.value.length > 0;
  const bulkItemsCount = chosenDirectories.value.length + chosenFiles.value.length;
  const areNewOptionsOpen = useSignal<boolean>(false);
  const areBulkOptionsOpen = useSignal<boolean>(false);
  const isNewDirectoryModalOpen = useSignal<boolean>(false);
  const renameDirectoryOrFileModal = useSignal<
    { isOpen: boolean; isDirectory: boolean; parentPath: string; name: string } | null
  >(null);
  const moveDirectoryOrFileModal = useSignal<
    { isOpen: boolean; isDirectory: boolean; path: string; name: string } | null
  >(null);
  const createShareModal = useSignal<{ isOpen: boolean; filePath: string; password?: string } | null>(null);
  const manageShareModal = useSignal<{ isOpen: boolean; fileShareId: string } | null>(null);

  // Drag and drop state
  const isDraggingOver = useSignal<boolean>(false);
  const dragCounter = useSignal<number>(0);

  // Directory creation progress state
  const isCreatingDirectories = useSignal<boolean>(false);
  const currentDirectoryName = useSignal<string>('');

  // File conflict resolution state
  const fileConflictModal = useSignal<
    {
      isOpen: boolean;
      conflictFile: File | null;
      existingFileName: string;
      onReplace: () => void;
      onSkip: () => void;
      onReplaceAll: () => void;
    } | null
  >(null);
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

  // Uploads run inside a service worker (public/sw.js) so they survive a page refresh; this hook enqueues files and
  // hydrates isUploading/uploadProgress/uploadError from its broadcasts. Existing-file checking is done ourselves
  // above (with a replace/skip/replace-all prompt), so the hook's own blanket skip-if-exists check is disabled here.
  const { isUploading, uploadProgress, uploadError, enqueueUpload } = useUploadQueue({
    isEnabled: !fileShareId,
    path,
    files,
    directories,
    uploadSessionTag,
    uploadKind: 'file',
    checkExistingFiles: false,
  });

  function onClickSort(column: SortColumn) {
    let newSortOrder: SortOrder = 'asc';

    if (sortBy.value === column) {
      newSortOrder = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
      newSortOrder = 'asc';
    }

    sortBy.value = column;
    sortOrder.value = newSortOrder;

    const sortOptions = { sortBy: column, sortOrder: newSortOrder };
    directories.value = sortDirectories(directories.value, sortOptions);
    files.value = sortFiles(files.value, sortOptions);

    const url = new URL(window.location.href);
    url.searchParams.set('sortBy', column);
    url.searchParams.set('sortOrder', newSortOrder);
    window.history.replaceState({}, '', url.toString());

    if (!fileShareId) {
      fetch('/api/files/update-sort', {
        method: 'POST',
        body: JSON.stringify({ sortBy: column, sortOrder: newSortOrder }),
      }).catch(console.error);
    }
  }

  function onClickUploadFile(uploadDirectory = false) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    if (uploadDirectory) {
      fileInput.webkitdirectory = true;
      // @ts-expect-error - mozdirectory is not typed
      fileInput.mozdirectory = true;
      // @ts-expect-error - directory is not typed
      fileInput.directory = true;
    }
    fileInput.click();

    fileInput.onchange = async (event) => {
      const chosenFilesList = (event.target as HTMLInputElement)?.files!;
      const chosenFiles = Array.from(chosenFilesList);

      if (chosenFiles.length === 0) {
        return;
      }

      areNewOptionsOpen.value = false;
      replaceAllMode.value = false; // Reset replace all mode for new upload session

      const itemsToUpload: { file: File; parentPath: string }[] = [];

      for (const chosenFile of chosenFiles) {
        const targetPath = getTargetPath(chosenFile);
        const shouldUpload = await resolveFileConflict(chosenFile, targetPath);

        if (shouldUpload) {
          itemsToUpload.push({ file: chosenFile, parentPath: targetPath });
        }
      }

      await enqueueUpload(itemsToUpload);

      replaceAllMode.value = false;
    };
  }

  // Handle file upload from dropped files
  async function handleDroppedFiles(droppedFiles: File[]) {
    if (droppedFiles.length === 0) return;

    areNewOptionsOpen.value = false;
    replaceAllMode.value = false; // Reset replace all mode for new upload session

    const itemsToUpload: { file: File; parentPath: string }[] = [];

    for (const file of droppedFiles) {
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
      await handleDroppedFiles(filesToUpload);
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

      const requestBody = {
        parentPath: path.value,
        name: dirPath, // The API should handle nested path creation
      };

      const response = await fetch(`/api/files/create-directory`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to create directory. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json();
      if (result.success) {
        directories.value = [...result.newDirectories];
      }
    } catch (error) {
      console.error(`Failed to create directory ${dirPath}:`, error);
    } finally {
      isCreatingDirectories.value = false;
      currentDirectoryName.value = '';
    }
  }

  // Drag and drop event handlers
  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    dragCounter.value++;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      isDraggingOver.value = true;
    }
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    dragCounter.value--;
    if (dragCounter.value === 0) {
      isDraggingOver.value = false;
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    isDraggingOver.value = false;
    dragCounter.value = 0;

    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      // Use items for better directory support
      handleDroppedItems(e.dataTransfer.items);
    } else if (e.dataTransfer?.files) {
      // Fallback to files for compatibility
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

  async function onClickSaveDirectory(newDirectoryName: string) {
    if (isAdding.value) {
      return;
    }

    if (!newDirectoryName) {
      return;
    }

    areNewOptionsOpen.value = false;
    isAdding.value = true;

    try {
      const requestBody: CreateDirectoryRequestBody = {
        parentPath: path.value,
        name: newDirectoryName,
      };
      const response = await fetch(`/api/files/create-directory`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to create directory. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as CreateDirectoryResponseBody;

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
    areNewOptionsOpen.value = !areNewOptionsOpen.value;
  }

  function toggleBulkOptionsDropdown() {
    areBulkOptionsOpen.value = !areBulkOptionsOpen.value;
  }

  function onClickOpenRenameDirectory(parentPath: string, name: string) {
    renameDirectoryOrFileModal.value = {
      isOpen: true,
      isDirectory: true,
      parentPath,
      name,
    };
  }

  function onClickOpenRenameFile(parentPath: string, name: string) {
    renameDirectoryOrFileModal.value = {
      isOpen: true,
      isDirectory: false,
      parentPath,
      name,
    };
  }

  function onClickCloseRename() {
    renameDirectoryOrFileModal.value = null;
  }

  async function onClickSaveRenameDirectory(newName: string) {
    if (
      isUpdating.value || !renameDirectoryOrFileModal.value?.isOpen || !renameDirectoryOrFileModal.value?.isDirectory
    ) {
      return;
    }

    isUpdating.value = true;

    try {
      const requestBody: RenameDirectoryRequestBody = {
        parentPath: renameDirectoryOrFileModal.value.parentPath,
        oldName: renameDirectoryOrFileModal.value.name,
        newName,
      };
      const response = await fetch(`/api/files/rename-directory`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to rename directory. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as RenameDirectoryResponseBody;

      if (!result.success) {
        throw new Error('Failed to rename directory!');
      }

      directories.value = [...result.newDirectories];
    } catch (error) {
      console.error(error);
    }

    isUpdating.value = false;
    renameDirectoryOrFileModal.value = null;
  }

  async function onClickSaveRenameFile(newName: string) {
    if (
      isUpdating.value || !renameDirectoryOrFileModal.value?.isOpen || renameDirectoryOrFileModal.value?.isDirectory
    ) {
      return;
    }

    isUpdating.value = true;

    try {
      const requestBody: RenameRequestBody = {
        parentPath: renameDirectoryOrFileModal.value.parentPath,
        oldName: renameDirectoryOrFileModal.value.name,
        newName,
      };
      const response = await fetch(`/api/files/rename`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to rename file. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as RenameResponseBody;

      if (!result.success) {
        throw new Error('Failed to rename file!');
      }

      files.value = [...result.newFiles];
    } catch (error) {
      console.error(error);
    }

    isUpdating.value = false;
    renameDirectoryOrFileModal.value = null;
  }

  function onClickOpenMoveDirectory(parentPath: string, name: string) {
    moveDirectoryOrFileModal.value = {
      isOpen: true,
      isDirectory: true,
      path: parentPath,
      name,
    };
  }

  function onClickOpenMoveFile(parentPath: string, name: string) {
    moveDirectoryOrFileModal.value = {
      isOpen: true,
      isDirectory: false,
      path: parentPath,
      name,
    };
  }

  function onClickCloseMove() {
    moveDirectoryOrFileModal.value = null;
  }

  async function onClickSaveMoveDirectory(newPath: string) {
    if (isUpdating.value || !moveDirectoryOrFileModal.value?.isOpen || !moveDirectoryOrFileModal.value?.isDirectory) {
      return;
    }

    isUpdating.value = true;

    try {
      const requestBody: MoveDirectoryRequestBody = {
        oldParentPath: moveDirectoryOrFileModal.value.path,
        newParentPath: newPath,
        name: moveDirectoryOrFileModal.value.name,
      };
      const response = await fetch(`/api/files/move-directory`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to move directory. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as MoveDirectoryResponseBody;

      if (!result.success) {
        throw new Error('Failed to move directory!');
      }

      directories.value = [...result.newDirectories];
    } catch (error) {
      console.error(error);
    }

    isUpdating.value = false;
    moveDirectoryOrFileModal.value = null;
  }

  async function onClickSaveMoveFile(newPath: string) {
    if (isUpdating.value || !moveDirectoryOrFileModal.value?.isOpen || moveDirectoryOrFileModal.value?.isDirectory) {
      return;
    }

    isUpdating.value = true;

    try {
      const requestBody: MoveRequestBody = {
        oldParentPath: moveDirectoryOrFileModal.value.path,
        newParentPath: newPath,
        name: moveDirectoryOrFileModal.value.name,
      };
      const response = await fetch(`/api/files/move`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to move file. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as MoveResponseBody;

      if (!result.success) {
        throw new Error('Failed to move file!');
      }

      files.value = [...result.newFiles];
    } catch (error) {
      console.error(error);
    }

    isUpdating.value = false;
    moveDirectoryOrFileModal.value = null;
  }

  function onClickDownloadDirectory(parentPath: string, name: string) {
    // Create download URL with proper path encoding
    const downloadUrl = `/api/files/download-directory?parentPath=${encodeURIComponent(parentPath)}&name=${
      encodeURIComponent(name)
    }`;

    // Create a temporary anchor element to trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${name}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function onClickDeleteDirectory(parentPath: string, name: string, isBulkDeleting = false) {
    if (isBulkDeleting || confirm('Are you sure you want to delete this directory?')) {
      if (!isBulkDeleting && isDeleting.value) {
        return;
      }

      isDeleting.value = true;

      try {
        const requestBody: DeleteDirectoryRequestBody = {
          parentPath,
          name,
        };
        const response = await fetch(`/api/files/delete-directory`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Failed to delete directory. ${response.statusText} ${await response.text()}`);
        }

        const result = await response.json() as DeleteDirectoryResponseBody;

        if (!result.success) {
          throw new Error('Failed to delete directory!');
        }

        directories.value = [...result.newDirectories];

        // Tell the service worker to drop it instead of letting it keep going. Any queued upload still writing into this directory (or a subdirectory of it) is now writing into nothing.
        await postToUploadServiceWorker({
          type: 'DIRECTORY_DELETED',
          sessionTag: uploadSessionTag ?? '',
          path: `${parentPath}${name}/`,
        });
      } catch (error) {
        console.error(error);
      }

      isDeleting.value = false;
    }
  }

  async function onClickDeleteFile(parentPath: string, name: string, isBulkDeleting = false) {
    if (isBulkDeleting || confirm('Are you sure you want to delete this file?')) {
      if (!isBulkDeleting && isDeleting.value) {
        return;
      }

      isDeleting.value = true;

      try {
        const requestBody: DeleteRequestBody = {
          parentPath,
          name,
        };
        const response = await fetch(`/api/files/delete`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Failed to delete file. ${response.statusText} ${await response.text()}`);
        }

        const result = await response.json() as DeleteResponseBody;

        if (!result.success) {
          throw new Error('Failed to delete file!');
        }

        files.value = [...result.newFiles];
      } catch (error) {
        console.error(error);
      }

      isDeleting.value = false;
    }
  }

  function onClickChooseDirectory(parentPath: string, name: string) {
    if (parentPath === '/' && name === '.Trash') {
      return;
    }

    const chosenDirectoryIndex = chosenDirectories.value.findIndex((directory) =>
      directory.parent_path === parentPath && directory.directory_name === name
    );

    if (chosenDirectoryIndex === -1) {
      chosenDirectories.value = [...chosenDirectories.value, { parent_path: parentPath, directory_name: name }];
    } else {
      const newChosenDirectories = chosenDirectories.peek();
      newChosenDirectories.splice(chosenDirectoryIndex, 1);
      chosenDirectories.value = [...newChosenDirectories];
    }
  }

  function onClickChooseFile(parentPath: string, name: string) {
    const chosenFileIndex = chosenFiles.value.findIndex((file) =>
      file.parent_path === parentPath && file.file_name === name
    );

    if (chosenFileIndex === -1) {
      chosenFiles.value = [...chosenFiles.value, { parent_path: parentPath, file_name: name }];
    } else {
      const newChosenFiles = chosenFiles.peek();
      newChosenFiles.splice(chosenFileIndex, 1);
      chosenFiles.value = [...newChosenFiles];
    }
  }

  function onToggleChooseAll(shouldChoose: boolean) {
    if (!shouldChoose) {
      chosenDirectories.value = [];
      chosenFiles.value = [];
      return;
    }

    chosenDirectories.value = directories.value.filter((directory) =>
      `${directory.parent_path}${directory.directory_name}/` !== TRASH_PATH
    ).map((directory) => ({ parent_path: directory.parent_path, directory_name: directory.directory_name }));
    chosenFiles.value = files.value.map((file) => ({ parent_path: file.parent_path, file_name: file.file_name }));
  }

  async function onClickBulkDelete() {
    if (
      confirm(
        `Are you sure you want to delete ${bulkItemsCount === 1 ? 'this' : 'these'} ${bulkItemsCount} item${
          bulkItemsCount === 1 ? '' : 's'
        }?`,
      )
    ) {
      if (isDeleting.value) {
        return;
      }

      isDeleting.value = true;

      try {
        for (const directory of chosenDirectories.value) {
          await onClickDeleteDirectory(directory.parent_path, directory.directory_name, true);
        }

        for (const file of chosenFiles.value) {
          await onClickDeleteFile(file.parent_path, file.file_name, true);
        }

        chosenDirectories.value = [];
        chosenFiles.value = [];
      } catch (error) {
        console.error(error);
      }

      isDeleting.value = false;
    }
  }

  function onClickCreateShare(filePath: string) {
    if (createShareModal.value?.isOpen) {
      createShareModal.value = null;
      return;
    }

    createShareModal.value = {
      isOpen: true,
      filePath,
    };
  }

  async function onClickSaveFileShare(filePath: string, password?: string) {
    if (isAdding.value) {
      return;
    }

    if (!filePath) {
      return;
    }

    isAdding.value = true;

    try {
      const requestBody: CreateShareRequestBody = {
        pathInView: path.value,
        filePath,
        password,
      };
      const response = await fetch(`/api/files/create-share`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to create share. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as CreateShareResponseBody;

      if (!result.success) {
        throw new Error('Failed to create share!');
      }

      directories.value = [...result.newDirectories];
      files.value = [...result.newFiles];

      createShareModal.value = null;

      onClickOpenManageShare(result.createdFileShareId);
    } catch (error) {
      console.error(error);
    }

    isAdding.value = false;
  }

  function onClickCloseFileShare() {
    createShareModal.value = null;
  }

  function onClickOpenManageShare(fileShareId: string) {
    manageShareModal.value = {
      isOpen: true,
      fileShareId,
    };
  }

  async function onClickUpdateFileShare(fileShareId: string, password?: string) {
    if (isUpdating.value) {
      return;
    }

    if (!fileShareId) {
      return;
    }

    isUpdating.value = true;

    try {
      const requestBody: UpdateShareRequestBody = {
        pathInView: path.value,
        fileShareId,
        password,
      };
      const response = await fetch(`/api/files/update-share`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to update share. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as UpdateShareResponseBody;

      if (!result.success) {
        throw new Error('Failed to update share!');
      }

      directories.value = [...result.newDirectories];
      files.value = [...result.newFiles];

      manageShareModal.value = null;
    } catch (error) {
      console.error(error);
    }

    isUpdating.value = false;
  }

  function onClickCloseManageShare() {
    manageShareModal.value = null;
  }

  async function onClickDeleteFileShare(fileShareId: string) {
    if (!fileShareId || isDeleting.value || !confirm('Are you sure you want to delete this public share link?')) {
      return;
    }

    isDeleting.value = true;

    try {
      const requestBody: DeleteShareRequestBody = {
        pathInView: path.value,
        fileShareId,
      };
      const response = await fetch(`/api/files/delete-share`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete file share. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as DeleteShareResponseBody;

      if (!result.success) {
        throw new Error('Failed to delete file share!');
      }

      directories.value = [...result.newDirectories];
      files.value = [...result.newFiles];

      manageShareModal.value = null;
    } catch (error) {
      console.error(error);
    }

    isDeleting.value = false;
  }

  return (
    <div
      class='relative'
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag and drop overlay */}
      {isDraggingOver.value && !fileShareId && (
        <div class='fixed inset-0 z-50 bg-black/50 flex items-center justify-center'>
          <div class='bg-accent text-on-color p-8 rounded-lg border-2 border-dashed border-on-color max-w-md text-center'>
            <img
              src='/public/images/add.svg'
              alt='Upload'
              class='white mx-auto mb-4'
              width={48}
              height={48}
            />
            <h3 class='text-xl font-semibold mb-2'>Drop files or directories here to upload</h3>
            <p class='text-sm opacity-90'>Release to upload files to the current directory</p>
          </div>
        </div>
      )}

      <section class='flex flex-row items-center justify-between mb-4'>
        <section class='relative inline-block text-left mr-2'>
          <section class='flex flex-row items-center justify-start'>
            {!fileShareId ? <SearchFiles /> : null}

            {isAnyItemChosen
              ? (
                <section class='relative inline-block text-left ml-2'>
                  <div>
                    <button
                      class='inline-block justify-center gap-x-1.5 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-on-color shadow-sm hover:bg-accent-hover ml-2 w-11 h-9'
                      type='button'
                      title='Bulk actions'
                      id='bulk-button'
                      aria-expanded='true'
                      aria-haspopup='true'
                      onClick={() => toggleBulkOptionsDropdown()}
                    >
                      <img
                        src={`/public/images/${areBulkOptionsOpen.value ? 'hide-options' : 'show-options'}.svg`}
                        alt='Bulk actions'
                        class={`white w-5 max-w-5`}
                        width={20}
                        height={20}
                      />
                    </button>
                  </div>

                  <div
                    class={`absolute left-0 z-10 mt-2 w-44 origin-top-left rounded-md bg-slate-700 shadow-lg ring-1 ring-black/15 focus:outline-none ${
                      !areBulkOptionsOpen.value ? 'hidden' : ''
                    }`}
                    role='menu'
                    aria-orientation='vertical'
                    aria-labelledby='bulk-button'
                    tabindex={-1}
                  >
                    <div class='py-1'>
                      <button
                        class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                        onClick={() => onClickBulkDelete()}
                        type='button'
                      >
                        Delete {bulkItemsCount} item{bulkItemsCount === 1 ? '' : 's'}
                      </button>
                    </div>
                  </div>
                </section>
              )
              : null}
          </section>
        </section>

        <section class='flex items-center justify-end'>
          <FilesBreadcrumb
            path={path.value}
            fileShareId={fileShareId}
            sortBy={sortBy.value}
            sortOrder={sortOrder.value}
          />

          {!fileShareId
            ? (
              <section class='relative inline-block text-left ml-2'>
                <div>
                  <button
                    class='inline-block justify-center gap-x-1.5 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-on-color shadow-sm hover:bg-accent-hover ml-2'
                    type='button'
                    title='Add new file or directory'
                    id='new-button'
                    aria-expanded='true'
                    aria-haspopup='true'
                    onClick={() => toggleNewOptionsDropdown()}
                  >
                    <img
                      src='/public/images/add.svg'
                      alt='Add new file or directory'
                      class={`white ${
                        isAdding.value || isUploading.value || isCreatingDirectories.value ? 'animate-spin' : ''
                      }`}
                      width={20}
                      height={20}
                    />
                  </button>
                </div>

                <div
                  class={`absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black/15 focus:outline-none ${
                    !areNewOptionsOpen.value ? 'hidden' : ''
                  }`}
                  role='menu'
                  aria-orientation='vertical'
                  aria-labelledby='new-button'
                  tabindex={-1}
                >
                  <div class='py-1'>
                    <button
                      class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                      onClick={() => onClickUploadFile()}
                      type='button'
                    >
                      Upload Files
                    </button>
                    <button
                      class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                      onClick={() => onClickUploadFile(true)}
                      type='button'
                    >
                      Upload Directory
                    </button>
                    <button
                      class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                      onClick={() => onClickCreateDirectory()}
                      type='button'
                    >
                      New Directory
                    </button>
                  </div>
                </div>
              </section>
            )
            : null}
        </section>
      </section>

      <section class='mx-auto max-w-7xl my-8'>
        <ListFiles
          directories={directories.value}
          files={files.value}
          chosenDirectories={chosenDirectories.value}
          chosenFiles={chosenFiles.value}
          onClickChooseDirectory={onClickChooseDirectory}
          onClickChooseFile={onClickChooseFile}
          onToggleChooseAll={onToggleChooseAll}
          onClickOpenRenameDirectory={onClickOpenRenameDirectory}
          onClickOpenRenameFile={onClickOpenRenameFile}
          onClickOpenMoveDirectory={onClickOpenMoveDirectory}
          onClickOpenMoveFile={onClickOpenMoveFile}
          onClickDeleteDirectory={onClickDeleteDirectory}
          onClickDeleteFile={onClickDeleteFile}
          onClickCreateShare={isFileSharingAllowed ? onClickCreateShare : undefined}
          onClickOpenManageShare={isFileSharingAllowed ? onClickOpenManageShare : undefined}
          onClickDownloadDirectory={areDirectoryDownloadsAllowed ? onClickDownloadDirectory : undefined}
          fileShareId={fileShareId}
          sortBy={sortBy.value}
          sortOrder={sortOrder.value}
          onClickSort={onClickSort}
        />

        <span
          class={`flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`}
        >
          {isDeleting.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />Deleting...
              </>
            )
            : null}
          {isAdding.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />Creating...
              </>
            )
            : null}
          {isCreatingDirectories.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />
                Creating directory {currentDirectoryName.value}...
              </>
            )
            : null}
          {isUploading.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />
                {uploadProgress.value || 'Uploading...'}
              </>
            )
            : null}
          {isUpdating.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />Updating...
              </>
            )
            : null}
          {!isDeleting.value && !isAdding.value && !isCreatingDirectories.value && !isUploading.value &&
              !isUpdating.value
            ? <>&nbsp;</>
            : null}
        </span>

        {uploadError.value
          ? (
            <span class='flex justify-end items-center text-sm mt-1 mx-2 text-red-400'>
              Upload failed — {uploadError.value}
            </span>
          )
          : null}
      </section>

      {!fileShareId
        ? (
          <section class='flex flex-row items-center justify-start my-12'>
            <span class='font-semibold'>WebDav URL:</span>{' '}
            <code class='bg-slate-600 mx-2 px-2 py-1 rounded-md'>{baseUrl}/dav</code>
          </section>
        )
        : null}

      {!fileShareId
        ? (
          <CreateDirectoryModal
            isOpen={isNewDirectoryModalOpen.value}
            onClickSave={onClickSaveDirectory}
            onClose={onCloseCreateDirectory}
          />
        )
        : null}

      {/* File Conflict Resolution Modal */}
      {fileConflictModal.value?.isOpen
        ? (
          <div class='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
            <div class='bg-slate-900 text-slate-100 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl'>
              <h3 class='text-lg font-semibold mb-4 text-slate-100'>File Already Exists</h3>
              <p class='text-slate-300 mb-6'>
                The file <strong class='text-slate-100'>{fileConflictModal.value.existingFileName}</strong>{' '}
                already exists in this location. What would you like to do?
              </p>
              <div class='flex flex-col sm:flex-row gap-3'>
                <button
                  onClick={fileConflictModal.value.onReplace}
                  class='flex-1 bg-blue-600 text-on-color px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors'
                  type='button'
                >
                  Replace
                </button>
                <button
                  onClick={fileConflictModal.value.onSkip}
                  class='flex-1 bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 transition-colors'
                  type='button'
                >
                  Skip
                </button>
                <button
                  onClick={fileConflictModal.value.onReplaceAll}
                  class='flex-1 bg-red-600 text-on-color px-4 py-2 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors'
                  type='button'
                >
                  Replace All
                </button>
              </div>
            </div>
          </div>
        )
        : null}

      {!fileShareId
        ? (
          <RenameDirectoryOrFileModal
            isOpen={renameDirectoryOrFileModal.value?.isOpen || false}
            isDirectory={renameDirectoryOrFileModal.value?.isDirectory || false}
            initialName={renameDirectoryOrFileModal.value?.name || ''}
            onClickSave={renameDirectoryOrFileModal.value?.isDirectory
              ? onClickSaveRenameDirectory
              : onClickSaveRenameFile}
            onClose={onClickCloseRename}
          />
        )
        : null}

      {!fileShareId
        ? (
          <MoveDirectoryOrFileModal
            isOpen={moveDirectoryOrFileModal.value?.isOpen || false}
            isDirectory={moveDirectoryOrFileModal.value?.isDirectory || false}
            initialPath={moveDirectoryOrFileModal.value?.path || ''}
            name={moveDirectoryOrFileModal.value?.name || ''}
            onClickSave={moveDirectoryOrFileModal.value?.isDirectory ? onClickSaveMoveDirectory : onClickSaveMoveFile}
            onClose={onClickCloseMove}
          />
        )
        : null}

      {!fileShareId && isFileSharingAllowed
        ? (
          <CreateShareModal
            isOpen={createShareModal.value?.isOpen || false}
            filePath={createShareModal.value?.filePath || ''}
            password={createShareModal.value?.password || ''}
            onClickSave={onClickSaveFileShare}
            onClose={onClickCloseFileShare}
          />
        )
        : null}

      {!fileShareId && isFileSharingAllowed
        ? (
          <ManageShareModal
            baseUrl={baseUrl}
            isOpen={manageShareModal.value?.isOpen || false}
            fileShareId={manageShareModal.value?.fileShareId || ''}
            onClickSave={onClickUpdateFileShare}
            onClickDelete={onClickDeleteFileShare}
            onClose={onClickCloseManageShare}
          />
        )
        : null}
    </div>
  );
}
