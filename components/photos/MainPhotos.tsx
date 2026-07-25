import { useSignal } from '@preact/signals';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { ResponseBody as UploadResponseBody } from '/pages/api/files/upload.ts';
import {
  RequestBody as CreateDirectoryRequestBody,
  ResponseBody as CreateDirectoryResponseBody,
} from '/pages/api/files/create-directory.ts';
import CreateDirectoryModal from '/components/files/CreateDirectoryModal.tsx';
import ListFiles from '/components/files/ListFiles.tsx';
import FilesBreadcrumb from '/components/files/FilesBreadcrumb.tsx';
import ListPhotos from '/components/photos/ListPhotos.tsx';

interface MainPhotosProps {
  initialDirectories: Directory[];
  initialFiles: DirectoryFile[];
  initialPath: string;
}

export default function MainPhotos({ initialDirectories, initialFiles, initialPath }: MainPhotosProps) {
  const isAdding = useSignal<boolean>(false);
  const isUploading = useSignal<boolean>(false);
  const directories = useSignal<Directory[]>(initialDirectories);
  const files = useSignal<DirectoryFile[]>(initialFiles);
  const path = useSignal<string>(initialPath);
  const areNewOptionsOption = useSignal<boolean>(false);
  const isNewDirectoryModalOpen = useSignal<boolean>(false);

  // Drag and drop state
  const isDraggingOver = useSignal<boolean>(false);
  const dragCounter = useSignal<number>(0);

  // Upload progress state
  const uploadProgress = useSignal<number>(0);
  const currentFileName = useSignal<string>('');
  const totalFiles = useSignal<number>(0);
  const currentFileIndex = useSignal<number>(0);
  const showProgressPercent = useSignal<boolean>(false);
  const progressStartTime = useSignal<number>(0);
  const isProcessing = useSignal<boolean>(false);

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

  // Helper function to handle file upload with conflict detection
  async function uploadFileWithConflictCheck(file: File, targetPath: string): Promise<boolean> {
    // Check if file already exists and we're not in "replace all" mode
    if (!replaceAllMode.value && checkFileExists(file.name, targetPath)) {
      return new Promise((resolve) => {
        fileConflictModal.value = {
          isOpen: true,
          conflictFile: file,
          existingFileName: file.name,
          onReplace: async () => {
            fileConflictModal.value = null;
            try {
              const result = await uploadFileWithProgress(file, targetPath);
              if (result.success) {
                files.value = [...result.newFiles];
              }
              resolve(result.success);
            } catch (error) {
              console.error(error);
              resolve(false);
            }
          },
          onSkip: () => {
            fileConflictModal.value = null;
            resolve(true); // Skip counts as "success" to continue with next file
          },
          onReplaceAll: async () => {
            replaceAllMode.value = true;
            fileConflictModal.value = null;
            try {
              const result = await uploadFileWithProgress(file, targetPath);
              if (result.success) {
                files.value = [...result.newFiles];
              }
              resolve(result.success);
            } catch (error) {
              console.error(error);
              resolve(false);
            }
          },
        };
      });
    } else {
      // No conflict or in replace all mode - upload directly
      try {
        const result = await uploadFileWithProgress(file, targetPath);
        if (result.success) {
          files.value = [...result.newFiles];
        }
        return result.success;
      } catch (error) {
        console.error(error);
        return false;
      }
    }
  }

  // Helper function to upload a single file with progress tracking
  function uploadFileWithProgress(file: File, parentPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      formData.set('path_in_view', path.value);
      formData.set('parent_path', parentPath);
      formData.set('name', file.name);
      formData.set('contents', file);

      // Reset progress states
      showProgressPercent.value = false;
      progressStartTime.value = Date.now();
      isProcessing.value = false;

      // Timer to show progress after 1 second
      const progressTimer = setTimeout(() => {
        showProgressPercent.value = true;
      }, 1000);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          uploadProgress.value = percentComplete;

          // If we reach 100%, start showing processing state
          if (percentComplete >= 100) {
            isProcessing.value = true;
          }
        }
      });

      xhr.addEventListener('loadstart', () => {
        // Reset processing state when starting
        isProcessing.value = false;
      });

      xhr.addEventListener('load', () => {
        clearTimeout(progressTimer);
        isProcessing.value = false;

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } catch (error) {
            reject(new Error('Failed to parse response'));
          }
        } else {
          reject(new Error(`Failed to upload file. ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        clearTimeout(progressTimer);
        isProcessing.value = false;
        reject(new Error('Network error during upload'));
      });

      xhr.open('POST', '/api/files/upload');
      xhr.send(formData);
    });
  }

  function onClickUploadFile() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*,video/*';
    fileInput.click();

    fileInput.onchange = async (event) => {
      const chosenFilesList = (event.target as HTMLInputElement)?.files!;
      const chosenFiles = Array.from(chosenFilesList);

      if (chosenFiles.length === 0) return;

      isUploading.value = true;
      totalFiles.value = chosenFiles.length;
      currentFileIndex.value = 0;
      uploadProgress.value = 0;
      replaceAllMode.value = false; // Reset replace all mode for new upload session

      for (let i = 0; i < chosenFiles.length; i++) {
        const chosenFile = chosenFiles[i];
        if (!chosenFile) continue;

        currentFileIndex.value = i + 1;
        currentFileName.value = chosenFile.name;
        uploadProgress.value = 0;
        areNewOptionsOption.value = false;

        const targetPath = getTargetPath(chosenFile);
        const success = await uploadFileWithConflictCheck(chosenFile, targetPath);

        if (!success) {
          console.error(`Failed to upload photo: ${chosenFile.name}`);
        }
      }

      isUploading.value = false;
      uploadProgress.value = 0;
      currentFileName.value = '';
      totalFiles.value = 0;
      currentFileIndex.value = 0;
      showProgressPercent.value = false;
      isProcessing.value = false;
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
    isUploading.value = true;
    totalFiles.value = photoFiles.length;
    currentFileIndex.value = 0;
    uploadProgress.value = 0;
    replaceAllMode.value = false; // Reset replace all mode for new upload session

    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      currentFileIndex.value = i + 1;
      currentFileName.value = file.name;
      uploadProgress.value = 0;

      const targetPath = getTargetPath(file);
      const success = await uploadFileWithConflictCheck(file, targetPath);

      if (!success) {
        console.error(`Failed to upload photo: ${file.name}`);
      }
    }

    isUploading.value = false;
    uploadProgress.value = 0;
    currentFileName.value = '';
    totalFiles.value = 0;
    currentFileIndex.value = 0;
    showProgressPercent.value = false;
    isProcessing.value = false;
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
                {isProcessing.value
                  ? `Saving ${currentFileName.value} to disk...`
                  : `Uploading ${currentFileName.value}${
                    showProgressPercent.value ? ` (${uploadProgress.value}%)` : '...'
                  }`}
                {totalFiles.value > 1 ? ` - File ${currentFileIndex.value} of ${totalFiles.value}` : ''}
              </>
            )
            : null}
          {!isAdding.value && !isUploading.value ? <>&nbsp;</> : null}
        </span>
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
