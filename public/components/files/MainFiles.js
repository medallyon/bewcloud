import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { sortDirectories, sortFiles, TRASH_PATH } from '/public/ts/utils/files.ts';
import { createDirectory, createFileShare, deleteDirectory, deleteFile, deleteFileShare, moveDirectory, moveFile, renameDirectory, renameFile, updateFileShare } from "./fileActions.js";
import { useFileUploadDrop } from "./useFileUploadDrop.js";
import { showToast } from '/public/ts/utils/toast.ts';
import { postToUploadServiceWorker, useUploadQueue } from "./useUploadQueue.js";
import SearchFiles from "./SearchFiles.js";
import FilesList from "./FilesList.js";
import FilesGrid from "./FilesGrid.js";
import FilesBulkBar from "./FilesBulkBar.js";
import FilesEmptyState from "./FilesEmptyState.js";
import ConfirmModal from "./ConfirmModal.js";
import { toFileItems } from "./fileItemModel.js";
import FilesBreadcrumb from "./FilesBreadcrumb.js";
import CreateDirectoryModal from "./CreateDirectoryModal.js";
import RenameDirectoryOrFileModal from "./RenameDirectoryOrFileModal.js";
import MoveDirectoryOrFileModal from "./MoveDirectoryOrFileModal.js";
import CreateShareModal from "./CreateShareModal.js";
import ManageShareModal from "./ManageShareModal.js";
const VIEW_OPTIONS = [{
  view: 'list',
  label: 'List view'
}, {
  view: 'grid',
  label: 'Grid view'
}];
const SORT_OPTIONS = [{
  column: 'name',
  label: 'Name'
}, {
  column: 'updated_at',
  label: 'Last update'
}, {
  column: 'size_in_bytes',
  label: 'Size'
}];
export default function MainFiles({
  initialDirectories,
  initialFiles,
  initialPath,
  baseUrl,
  isFileSharingAllowed,
  areDirectoryDownloadsAllowed,
  fileShareId,
  initialSortBy = 'name',
  initialSortOrder = 'asc',
  initialView = 'list',
  uploadSessionTag
}) {
  const isAdding = useSignal(false);
  const isDeleting = useSignal(false);
  const isUpdating = useSignal(false);
  const directories = useSignal(initialDirectories);
  const files = useSignal(initialFiles);
  const path = useSignal(initialPath);
  const sortBy = useSignal(initialSortBy);
  const sortOrder = useSignal(initialSortOrder);
  const view = useSignal(initialView);
  const chosenDirectories = useSignal([]);
  const chosenFiles = useSignal([]);
  const areNewOptionsOpen = useSignal(false);
  const isNewDirectoryModalOpen = useSignal(false);
  const renameDirectoryOrFileModal = useSignal(null);
  const moveDirectoryOrFileModal = useSignal(null);
  const confirmModal = useSignal(null);
  const createShareModal = useSignal(null);
  const manageShareModal = useSignal(null);
  const {
    isUploading,
    uploadProgress,
    enqueueUpload
  } = useUploadQueue({
    isEnabled: !fileShareId,
    path,
    files,
    directories,
    uploadSessionTag,
    uploadKind: 'file',
    checkExistingFiles: false
  });
  const {
    isDraggingOver,
    isCreatingDirectories,
    currentDirectoryName,
    fileConflictModal,
    uploadFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop
  } = useFileUploadDrop({
    path,
    files,
    directories,
    enqueueUpload,
    onUploadStart: () => areNewOptionsOpen.value = false
  });
  const items = toFileItems(directories.value, files.value, {
    routePath: fileShareId ? `file-share/${fileShareId}` : 'files',
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
    view: fileShareId ? undefined : view.value
  });
  const chosenKeys = [...chosenDirectories.value.map(directory => `${directory.parent_path}${directory.directory_name}/`), ...chosenFiles.value.map(file => `${file.parent_path}${file.file_name}`)];
  const choosableItemsCount = items.filter(item => !item.isTrash).length;
  const areAllItemsChosen = chosenKeys.length > 0 && chosenKeys.length === choosableItemsCount;
  const areSomeItemsChosen = chosenKeys.length > 0 && !areAllItemsChosen;
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== 'Escape') {
        return;
      }
      confirmModal.value = null;
      areNewOptionsOpen.value = false;
      for (const menu of document.querySelectorAll('details[open]')) {
        menu.open = false;
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
  function onClickSort(column) {
    let newSortOrder = 'asc';
    if (sortBy.value === column) {
      newSortOrder = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
      newSortOrder = 'asc';
    }
    sortBy.value = column;
    sortOrder.value = newSortOrder;
    const sortOptions = {
      sortBy: column,
      sortOrder: newSortOrder
    };
    directories.value = sortDirectories(directories.value, sortOptions);
    files.value = sortFiles(files.value, sortOptions);
    const url = new URL(window.location.href);
    url.searchParams.set('sortBy', column);
    url.searchParams.set('sortOrder', newSortOrder);
    window.history.replaceState({}, '', url.toString());
    saveViewPreferences({
      sortBy: column,
      sortOrder: newSortOrder
    });
  }
  async function saveViewPreferences(requestBody) {
    if (fileShareId) {
      return;
    }
    try {
      const response = await fetch('/api/files/update-sort', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to save view preferences. ${response.statusText}`);
      }
    } catch (error) {
      console.error(error);
    }
  }
  function onClickView(newView) {
    view.value = newView;
    const url = new URL(window.location.href);
    url.searchParams.set('view', newView);
    window.history.replaceState({}, '', url.toString());
    saveViewPreferences({
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      view: newView
    });
  }
  function onClickUploadFile(uploadDirectory = false) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    if (uploadDirectory) {
      fileInput.webkitdirectory = true;
      fileInput.mozdirectory = true;
      fileInput.directory = true;
    }
    fileInput.click();
    fileInput.onchange = async event => {
      const chosenFilesList = event.target?.files;
      await uploadFiles(Array.from(chosenFilesList));
    };
  }
  function onClickCreateDirectory() {
    if (isNewDirectoryModalOpen.value) {
      isNewDirectoryModalOpen.value = false;
      return;
    }
    isNewDirectoryModalOpen.value = true;
  }
  async function onClickSaveDirectory(newDirectoryName) {
    if (isAdding.value) {
      return;
    }
    if (!newDirectoryName) {
      return;
    }
    areNewOptionsOpen.value = false;
    isAdding.value = true;
    try {
      const result = await createDirectory(path.value, newDirectoryName);
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
  function onClickOpenRename(item) {
    renameDirectoryOrFileModal.value = {
      isOpen: true,
      isDirectory: item.isDirectory,
      parentPath: item.parentPath,
      name: item.name
    };
  }
  function onClickCloseRename() {
    renameDirectoryOrFileModal.value = null;
  }
  async function onClickSaveRenameDirectory(newName) {
    if (isUpdating.value || !renameDirectoryOrFileModal.value?.isOpen || !renameDirectoryOrFileModal.value?.isDirectory) {
      return;
    }
    isUpdating.value = true;
    try {
      const result = await renameDirectory(renameDirectoryOrFileModal.value.parentPath, renameDirectoryOrFileModal.value.name, newName);
      directories.value = [...result.newDirectories];
    } catch (error) {
      console.error(error);
    }
    isUpdating.value = false;
    renameDirectoryOrFileModal.value = null;
  }
  async function onClickSaveRenameFile(newName) {
    if (isUpdating.value || !renameDirectoryOrFileModal.value?.isOpen || renameDirectoryOrFileModal.value?.isDirectory) {
      return;
    }
    isUpdating.value = true;
    try {
      const result = await renameFile(renameDirectoryOrFileModal.value.parentPath, renameDirectoryOrFileModal.value.name, newName);
      files.value = [...result.newFiles];
    } catch (error) {
      console.error(error);
    }
    isUpdating.value = false;
    renameDirectoryOrFileModal.value = null;
  }
  function onClickOpenMove(item) {
    moveDirectoryOrFileModal.value = {
      isOpen: true,
      isDirectory: item.isDirectory,
      path: item.parentPath,
      name: item.name
    };
  }
  function onClickCloseMove() {
    moveDirectoryOrFileModal.value = null;
  }
  async function onClickSaveMoveDirectory(newPath) {
    if (isUpdating.value || !moveDirectoryOrFileModal.value?.isOpen || !moveDirectoryOrFileModal.value?.isDirectory) {
      return;
    }
    isUpdating.value = true;
    try {
      const result = await moveDirectory(moveDirectoryOrFileModal.value.path, newPath, moveDirectoryOrFileModal.value.name);
      directories.value = [...result.newDirectories];
    } catch (error) {
      console.error(error);
    }
    isUpdating.value = false;
    moveDirectoryOrFileModal.value = null;
  }
  async function onClickSaveMoveFile(newPath) {
    if (isUpdating.value || !moveDirectoryOrFileModal.value?.isOpen || moveDirectoryOrFileModal.value?.isDirectory) {
      return;
    }
    isUpdating.value = true;
    try {
      const result = await moveFile(moveDirectoryOrFileModal.value.path, newPath, moveDirectoryOrFileModal.value.name);
      files.value = [...result.newFiles];
    } catch (error) {
      console.error(error);
    }
    isUpdating.value = false;
    moveDirectoryOrFileModal.value = null;
  }
  function onClickDownloadDirectory(item) {
    const downloadUrl = `/api/files/download-directory?parentPath=${encodeURIComponent(item.parentPath)}&name=${encodeURIComponent(item.name)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${item.name}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  async function deleteItem(item) {
    if (item.isDirectory) {
      const result = await deleteDirectory(item.parentPath, item.name);
      directories.value = [...result.newDirectories];
      await postToUploadServiceWorker({
        type: 'DIRECTORY_DELETED',
        sessionTag: uploadSessionTag ?? '',
        path: item.fullPath
      });
      return;
    }
    const result = await deleteFile(item.parentPath, item.name);
    files.value = [...result.newFiles];
  }
  async function deleteItems(items) {
    if (isDeleting.value) {
      return;
    }
    isDeleting.value = true;
    try {
      for (const item of items) {
        await deleteItem(item);
      }
      chosenDirectories.value = [];
      chosenFiles.value = [];
    } catch (error) {
      console.error(error);
      showToast({
        message: 'Some items could not be deleted.',
        type: 'error'
      });
    }
    isDeleting.value = false;
  }
  function onClickDelete(item) {
    const isAlreadyInTrash = item.fullPath.startsWith(TRASH_PATH);
    const itemLabel = item.isDirectory ? 'directory' : 'file';
    confirmModal.value = {
      isOpen: true,
      title: isAlreadyInTrash ? `Delete ${itemLabel}` : `Move ${itemLabel} to Trash`,
      message: isAlreadyInTrash ? `"${item.name}" will be deleted permanently. Any public share link for it stops working.` : `"${item.name}" moves to the Trash. Any public share link for it stops working, and undoing that isn't possible.`,
      confirmLabel: isAlreadyInTrash ? 'Delete permanently' : 'Move to Trash',
      isDangerous: true,
      onConfirm: async () => {
        confirmModal.value = null;
        await deleteItems([item]);
        showToast({
          message: isAlreadyInTrash ? `Deleted "${item.name}".` : `Moved "${item.name}" to the Trash.`,
          type: 'success'
        });
      }
    };
  }
  function onToggleChoose(item) {
    if (item.isTrash) {
      return;
    }
    if (item.isDirectory) {
      const chosenDirectoryIndex = chosenDirectories.value.findIndex(directory => directory.parent_path === item.parentPath && directory.directory_name === item.name);
      if (chosenDirectoryIndex === -1) {
        chosenDirectories.value = [...chosenDirectories.value, {
          parent_path: item.parentPath,
          directory_name: item.name
        }];
      } else {
        chosenDirectories.value = chosenDirectories.value.filter((_directory, index) => index !== chosenDirectoryIndex);
      }
      return;
    }
    const chosenFileIndex = chosenFiles.value.findIndex(file => file.parent_path === item.parentPath && file.file_name === item.name);
    if (chosenFileIndex === -1) {
      chosenFiles.value = [...chosenFiles.value, {
        parent_path: item.parentPath,
        file_name: item.name
      }];
    } else {
      chosenFiles.value = chosenFiles.value.filter((_file, index) => index !== chosenFileIndex);
    }
  }
  function onToggleChooseAll(shouldChoose) {
    if (!shouldChoose) {
      chosenDirectories.value = [];
      chosenFiles.value = [];
      return;
    }
    chosenDirectories.value = directories.value.filter(directory => `${directory.parent_path}${directory.directory_name}/` !== TRASH_PATH).map(directory => ({
      parent_path: directory.parent_path,
      directory_name: directory.directory_name
    }));
    chosenFiles.value = files.value.map(file => ({
      parent_path: file.parent_path,
      file_name: file.file_name
    }));
  }
  function onClickBulkDelete() {
    const chosenItems = items.filter(item => chosenKeys.includes(item.key));
    confirmModal.value = {
      isOpen: true,
      title: `Move ${chosenItems.length} item${chosenItems.length === 1 ? '' : 's'} to Trash`,
      message: `${chosenItems.length === 1 ? 'It' : 'They'} move to the Trash, and any public share link stops working.`,
      confirmLabel: 'Move to Trash',
      isDangerous: true,
      onConfirm: async () => {
        confirmModal.value = null;
        await deleteItems(chosenItems);
        showToast({
          message: `Moved ${chosenItems.length} item${chosenItems.length === 1 ? '' : 's'} to the Trash.`,
          type: 'success'
        });
      }
    };
  }
  function onClickCreateShare(item) {
    if (createShareModal.value?.isOpen) {
      createShareModal.value = null;
      return;
    }
    createShareModal.value = {
      isOpen: true,
      filePath: item.isDirectory ? item.fullPath.slice(0, -1) : item.fullPath
    };
  }
  async function onClickSaveFileShare(filePath, password) {
    if (isAdding.value) {
      return;
    }
    if (!filePath) {
      return;
    }
    isAdding.value = true;
    try {
      const result = await createFileShare(path.value, filePath, password);
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
  function onClickOpenManageShare(fileShareId) {
    manageShareModal.value = {
      isOpen: true,
      fileShareId
    };
  }
  async function onClickUpdateFileShare(fileShareId, password) {
    if (isUpdating.value) {
      return;
    }
    if (!fileShareId) {
      return;
    }
    isUpdating.value = true;
    try {
      const result = await updateFileShare(path.value, fileShareId, password);
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
  function onClickDeleteFileShare(fileShareId) {
    if (!fileShareId || isDeleting.value) {
      return;
    }
    confirmModal.value = {
      isOpen: true,
      title: 'Delete public share link',
      message: 'Anyone holding the link loses access. The file itself stays where it is.',
      confirmLabel: 'Delete link',
      isDangerous: true,
      onConfirm: async () => {
        confirmModal.value = null;
        isDeleting.value = true;
        try {
          const result = await deleteFileShare(path.value, fileShareId);
          directories.value = [...result.newDirectories];
          files.value = [...result.newFiles];
          manageShareModal.value = null;
          showToast({
            message: 'Public share link deleted.',
            type: 'success'
          });
        } catch (error) {
          console.error(error);
          showToast({
            message: 'Failed to delete the public share link.',
            type: 'error'
          });
        }
        isDeleting.value = false;
      }
    };
  }
  return h("div", {
    class: "relative",
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop
  }, isDraggingOver.value && !fileShareId && h("div", {
    class: "fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
  }, h("div", {
    class: "bg-accent text-on-color p-8 rounded-lg border-2 border-dashed border-on-color max-w-md text-center"
  }, h("img", {
    src: "/public/images/add.svg",
    alt: "Upload",
    class: "white mx-auto mb-4",
    width: 48,
    height: 48
  }), h("h3", {
    class: "text-xl font-semibold mb-2"
  }, "Drop files or directories here to upload"), h("p", {
    class: "text-sm opacity-90"
  }, "Release to upload files to the current directory"))), h("section", {
    class: "sticky top-0 z-20 -mx-2 mb-3 flex flex-wrap items-center gap-2 bg-slate-800 px-2 py-2"
  }, h("section", {
    class: "order-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
  }, h(FilesBreadcrumb, {
    path: path.value,
    fileShareId: fileShareId,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
    view: fileShareId ? undefined : view.value
  })), h("section", {
    class: "order-3 flex w-full items-center gap-2 md:order-2 md:w-auto"
  }, !fileShareId ? h(SearchFiles, null) : null, h("details", {
    class: "relative shrink-0",
    name: "files-toolbar-menu"
  }, h("summary", {
    class: "flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white",
    title: "Sort"
  }, h("img", {
    src: `/public/images/sort-${sortOrder.value === 'asc' ? 'up' : 'down'}.svg`,
    alt: "Sort",
    class: "white w-5 max-w-5",
    width: 20,
    height: 20
  })), h("div", {
    class: "absolute right-0 z-20 mt-1 w-52 origin-top-right rounded-xl border border-slate-500 bg-slate-700 py-1 shadow-lg"
  }, SORT_OPTIONS.map(option => h("button", {
    key: option.column,
    type: "button",
    class: `flex min-h-11 w-full items-center px-4 text-left text-sm hover:bg-slate-600 ${sortBy.value === option.column ? 'text-accent font-semibold' : 'text-white'}`,
    onClick: () => onClickSort(option.column)
  }, option.label, sortBy.value === option.column ? sortOrder.value === 'asc' ? ' ↑' : ' ↓' : '')))), !fileShareId ? h("section", {
    class: "flex shrink-0 items-center rounded-lg border border-slate-600"
  }, VIEW_OPTIONS.map(option => h("button", {
    key: option.view,
    type: "button",
    class: `flex min-h-11 min-w-11 items-center justify-center rounded-lg ${view.value === option.view ? 'bg-slate-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`,
    "aria-pressed": view.value === option.view,
    title: option.label,
    onClick: () => onClickView(option.view)
  }, h("img", {
    src: `/public/images/${option.view}-view.svg`,
    alt: option.label,
    class: "white w-5 max-w-5",
    width: 20,
    height: 20
  })))) : null, !fileShareId ? h("details", {
    class: "relative shrink-0",
    name: "files-toolbar-menu"
  }, h("summary", {
    class: "flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-on-color hover:bg-accent-hover",
    title: "Add new file or directory"
  }, h("img", {
    src: "/public/images/add.svg",
    alt: "",
    class: `white ${isAdding.value || isUploading.value || isCreatingDirectories.value ? 'animate-spin' : ''}`,
    width: 20,
    height: 20
  }), "New"), h("div", {
    class: "absolute right-0 z-20 mt-1 w-52 origin-top-right rounded-xl border border-slate-500 bg-slate-700 py-1 shadow-lg"
  }, h("button", {
    class: "flex min-h-11 w-full items-center px-4 text-left text-sm text-white hover:bg-slate-600",
    onClick: () => onClickUploadFile(),
    type: "button"
  }, "Upload files"), h("button", {
    class: "flex min-h-11 w-full items-center px-4 text-left text-sm text-white hover:bg-slate-600",
    onClick: () => onClickUploadFile(true),
    type: "button"
  }, "Upload directory"), h("button", {
    class: "flex min-h-11 w-full items-center px-4 text-left text-sm text-white hover:bg-slate-600",
    onClick: () => onClickCreateDirectory(),
    type: "button"
  }, "New directory"))) : null)), h("section", {
    class: "my-2"
  }, !fileShareId ? h(FilesBulkBar, {
    chosenItemsCount: chosenKeys.length,
    onClickDelete: onClickBulkDelete,
    onClickClear: () => onToggleChooseAll(false)
  }) : null, items.length === 0 ? h(FilesEmptyState, {
    itemPluralLabel: "files",
    isTrash: path.value === TRASH_PATH,
    onClickUpload: fileShareId ? undefined : () => onClickUploadFile()
  }) : view.value === 'grid' ? h(FilesGrid, {
    items: items,
    chosenKeys: chosenKeys,
    isSelectable: !fileShareId,
    areThumbnailsAvailable: !fileShareId,
    onToggleChoose: onToggleChoose,
    onClickRename: fileShareId ? undefined : onClickOpenRename,
    onClickMove: fileShareId ? undefined : onClickOpenMove,
    onClickDelete: fileShareId ? undefined : onClickDelete,
    onClickDownload: !fileShareId && areDirectoryDownloadsAllowed ? onClickDownloadDirectory : undefined,
    onClickCreateShare: !fileShareId && isFileSharingAllowed ? onClickCreateShare : undefined,
    onClickManageShare: !fileShareId && isFileSharingAllowed ? onClickOpenManageShare : undefined
  }) : h(FilesList, {
    items: items,
    chosenKeys: chosenKeys,
    areAllItemsChosen: areAllItemsChosen,
    areSomeItemsChosen: areSomeItemsChosen,
    isSelectable: !fileShareId,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
    onClickSort: onClickSort,
    onToggleChoose: onToggleChoose,
    onToggleChooseAll: onToggleChooseAll,
    onClickRename: fileShareId ? undefined : onClickOpenRename,
    onClickMove: fileShareId ? undefined : onClickOpenMove,
    onClickDelete: fileShareId ? undefined : onClickDelete,
    onClickDownload: !fileShareId && areDirectoryDownloadsAllowed ? onClickDownloadDirectory : undefined,
    onClickCreateShare: !fileShareId && isFileSharingAllowed ? onClickCreateShare : undefined,
    onClickManageShare: !fileShareId && isFileSharingAllowed ? onClickOpenManageShare : undefined
  }), h("span", {
    class: `flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`
  }, isDeleting.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Deleting...") : null, isAdding.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Creating...") : null, isCreatingDirectories.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Creating directory ", currentDirectoryName.value, "...") : null, isUploading.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), uploadProgress.value || 'Uploading...') : null, isUpdating.value ? h(Fragment, null, h("img", {
    src: "/public/images/loading.svg",
    class: "white mr-2",
    width: 18,
    height: 18
  }), "Updating...") : null, !isDeleting.value && !isAdding.value && !isCreatingDirectories.value && !isUploading.value && !isUpdating.value ? h(Fragment, null, "\xA0") : null)), !fileShareId ? h("section", {
    class: "flex flex-row items-center justify-start my-12"
  }, h("span", {
    class: "font-semibold"
  }, "WebDav URL:"), ' ', h("code", {
    class: "bg-slate-600 mx-2 px-2 py-1 rounded-md"
  }, baseUrl, "/dav")) : null, h(ConfirmModal, {
    state: confirmModal.value,
    onClose: () => confirmModal.value = null
  }), !fileShareId ? h(CreateDirectoryModal, {
    isOpen: isNewDirectoryModalOpen.value,
    onClickSave: onClickSaveDirectory,
    onClose: onCloseCreateDirectory
  }) : null, fileConflictModal.value?.isOpen ? h("div", {
    class: "fixed inset-0 bg-black/50 flex items-center justify-center z-50"
  }, h("div", {
    class: "bg-slate-900 text-slate-100 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
  }, h("h3", {
    class: "text-lg font-semibold mb-4 text-slate-100"
  }, "File Already Exists"), h("p", {
    class: "text-slate-300 mb-6"
  }, "The file ", h("strong", {
    class: "text-slate-100"
  }, fileConflictModal.value.existingFileName), ' ', "already exists in this location. What would you like to do?"), h("div", {
    class: "flex flex-col sm:flex-row gap-3"
  }, h("button", {
    onClick: fileConflictModal.value.onReplace,
    class: "flex-1 bg-blue-600 text-on-color px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors",
    type: "button"
  }, "Replace"), h("button", {
    onClick: fileConflictModal.value.onSkip,
    class: "flex-1 bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 transition-colors",
    type: "button"
  }, "Skip"), h("button", {
    onClick: fileConflictModal.value.onReplaceAll,
    class: "flex-1 bg-red-600 text-on-color px-4 py-2 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors",
    type: "button"
  }, "Replace All")))) : null, !fileShareId ? h(RenameDirectoryOrFileModal, {
    isOpen: renameDirectoryOrFileModal.value?.isOpen || false,
    isDirectory: renameDirectoryOrFileModal.value?.isDirectory || false,
    initialName: renameDirectoryOrFileModal.value?.name || '',
    onClickSave: renameDirectoryOrFileModal.value?.isDirectory ? onClickSaveRenameDirectory : onClickSaveRenameFile,
    onClose: onClickCloseRename
  }) : null, !fileShareId ? h(MoveDirectoryOrFileModal, {
    isOpen: moveDirectoryOrFileModal.value?.isOpen || false,
    isDirectory: moveDirectoryOrFileModal.value?.isDirectory || false,
    initialPath: moveDirectoryOrFileModal.value?.path || '',
    name: moveDirectoryOrFileModal.value?.name || '',
    onClickSave: moveDirectoryOrFileModal.value?.isDirectory ? onClickSaveMoveDirectory : onClickSaveMoveFile,
    onClose: onClickCloseMove
  }) : null, !fileShareId && isFileSharingAllowed ? h(CreateShareModal, {
    isOpen: createShareModal.value?.isOpen || false,
    filePath: createShareModal.value?.filePath || '',
    password: createShareModal.value?.password || '',
    onClickSave: onClickSaveFileShare,
    onClose: onClickCloseFileShare
  }) : null, !fileShareId && isFileSharingAllowed ? h(ManageShareModal, {
    baseUrl: baseUrl,
    isOpen: manageShareModal.value?.isOpen || false,
    fileShareId: manageShareModal.value?.fileShareId || '',
    onClickSave: onClickUpdateFileShare,
    onClickDelete: onClickDeleteFileShare,
    onClose: onClickCloseManageShare
  }) : null);
}