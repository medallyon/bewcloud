import { useSignal } from '@preact/signals';

import { Directory, DirectoryFile } from '/lib/types.ts';
import {
  RequestBody as CreateDirectoryRequestBody,
  ResponseBody as CreateDirectoryResponseBody,
} from '/pages/api/files/create-directory.ts';
import { useUploadQueue } from '/components/files/useUploadQueue.ts';
import CreateDirectoryModal from '/components/files/CreateDirectoryModal.tsx';
import ListFiles from '/components/files/ListFiles.tsx';
import FilesBreadcrumb from '/components/files/FilesBreadcrumb.tsx';
import ListPhotos from '/components/photos/ListPhotos.tsx';

interface MainPhotosProps {
  initialDirectories: Directory[];
  initialFiles: DirectoryFile[];
  initialPath: string;
  uploadSessionTag?: string;
}

export default function MainPhotos(
  { initialDirectories, initialFiles, initialPath, uploadSessionTag }: MainPhotosProps,
) {
  const isAdding = useSignal<boolean>(false);
  const directories = useSignal<Directory[]>(initialDirectories);
  const files = useSignal<DirectoryFile[]>(initialFiles);
  const path = useSignal<string>(initialPath);
  const areNewOptionsOption = useSignal<boolean>(false);
  const isNewDirectoryModalOpen = useSignal<boolean>(false);

  // Drag and drop state
  const isDraggingOver = useSignal<boolean>(false);
  const dragCounter = useSignal<number>(0);

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
    isEnabled: true,
    path,
    files,
    directories,
    uploadSessionTag,
    uploadKind: 'photo',
    checkExistingFiles: false,
  });

  function onClickUploadFile() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*,video/*';
    fileInput.click();

    fileInput.onchange = async (event) => {
      const chosenFilesList = (event.target as HTMLInputElement)?.files!;
      const chosenFiles = Array.from(chosenFilesList).filter(Boolean);

      if (chosenFiles.length === 0) {
        return;
      }

      areNewOptionsOption.value = false;
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

    // Filter for images and videos only
    const photoFiles = droppedFiles.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));

    if (photoFiles.length === 0) return;

    areNewOptionsOption.value = false;
    replaceAllMode.value = false; // Reset replace all mode for new upload session

    const itemsToUpload: { file: File; parentPath: string }[] = [];

    for (const file of photoFiles) {
      const targetPath = getTargetPath(file);
      const shouldUpload = await resolveFileConflict(file, targetPath);

      if (shouldUpload) {
        itemsToUpload.push({ file, parentPath: targetPath });
      }
    }

    await enqueueUpload(itemsToUpload);

    replaceAllMode.value = false;
  }

  // Handle directory drops (including empty directories) - photos only
  async function handleDroppedItems(items: DataTransferItemList) {
    const filesToUpload: File[] = [];

    // Process all dropped items, filtering for images/videos only
    await processDroppedItems(items, filesToUpload);

    // Upload photo files
    if (filesToUpload.length > 0) {
      await handleDroppedFiles(filesToUpload);
    }
  }

  // Recursively process dropped items to extract image/video files only
  async function processDroppedItems(items: DataTransferItemList, filesToUpload: File[]): Promise<void> {
    const promises: Promise<void>[] = [];

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

  // Process a single file system entry (file or directory) - photos only
  async function processEntry(entry: FileSystemEntry, currentPath: string, filesToUpload: File[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        fileEntry.file((file) => {
          // Only process image and video files
          if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            // Add webkitRelativePath to maintain directory structure
            Object.defineProperty(file, 'webkitRelativePath', {
              value: currentPath ? `${currentPath}/${file.name}` : file.name,
              writable: false,
            });
            filesToUpload.push(file);
          }
          resolve();
        }, reject);
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const dirPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

        const reader = dirEntry.createReader();
        reader.readEntries(async (entries) => {
          try {
            // Process all entries in the directory
            const promises = entries.map((childEntry) => processEntry(childEntry, dirPath, filesToUpload));
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

  // Drag and drop event handlers
  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    dragCounter.value++;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      // Allow drag if any items are being dragged (we'll filter for media files during drop)
      // This allows directories to be dragged even if we can't inspect their contents beforehand
      const hasFiles = Array.from(e.dataTransfer.items).some((item) => item.kind === 'file');
      if (hasFiles) {
        isDraggingOver.value = true;
      }
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

    areNewOptionsOption.value = false;
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
    areNewOptionsOption.value = !areNewOptionsOption.value;
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
      {isDraggingOver.value && (
        <div class='fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center'>
          <div class='bg-[#51A4FB] text-white p-8 rounded-lg border-2 border-dashed border-white max-w-md text-center'>
            <img
              src='/public/images/add.svg'
              alt='Upload'
              class='white mx-auto mb-4'
              width={48}
              height={48}
            />
            <h3 class='text-xl font-semibold mb-2'>Drop photos here to upload</h3>
            <p class='text-sm opacity-90'>Release to upload images and videos to the current directory</p>
          </div>
        </div>
      )}

      <section class='flex flex-row items-center justify-between mb-4'>
        <section class='flex items-center justify-end w-full'>
          <FilesBreadcrumb path={path.value} isShowingPhotos />

          <section class='relative inline-block text-left ml-2'>
            <div>
              <button
                class='inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2'
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
                  class={`white ${isAdding.value || isUploading.value ? 'animate-spin' : ''}`}
                  width={20}
                  height={20}
                />
              </button>
            </div>

            <div
              class={`absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black/15 focus:outline-none ${
                !areNewOptionsOption.value ? 'hidden' : ''
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
                  Upload Photo
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
        </section>
      </section>

      <section class='mx-auto max-w-7xl my-8'>
        <ListFiles
          directories={directories.value}
          files={[]}
          isShowingPhotos
        />

        <ListPhotos
          files={files.value}
        />

        <span
          class={`flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`}
        >
          {isAdding.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />Creating...
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
          {!isAdding.value && !isUploading.value ? <>&nbsp;</> : null}
        </span>

        {uploadError.value
          ? (
            <span class='flex justify-end items-center text-sm mt-1 mx-2 text-red-400'>
              Upload failed — {uploadError.value}
            </span>
          )
          : null}
      </section>

      <CreateDirectoryModal
        isOpen={isNewDirectoryModalOpen.value}
        onClickSave={onClickSaveDirectory}
        onClose={onCloseCreateDirectory}
      />

      {/* File Conflict Resolution Modal */}
      {fileConflictModal.value?.isOpen
        ? (
          <div class='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
            <div class='bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl'>
              <h3 class='text-lg font-semibold mb-4 text-gray-900'>File Already Exists</h3>
              <p class='text-gray-600 mb-6'>
                The file <strong class='text-gray-900'>{fileConflictModal.value.existingFileName}</strong>{' '}
                already exists in this location. What would you like to do?
              </p>
              <div class='flex flex-col sm:flex-row gap-3'>
                <button
                  onClick={fileConflictModal.value.onReplace}
                  class='flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors'
                  type='button'
                >
                  Replace
                </button>
                <button
                  onClick={fileConflictModal.value.onSkip}
                  class='flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors'
                  type='button'
                >
                  Skip
                </button>
                <button
                  onClick={fileConflictModal.value.onReplaceAll}
                  class='flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors'
                  type='button'
                >
                  Replace All
                </button>
              </div>
            </div>
          </div>
        )
        : null}
    </div>
  );
}
