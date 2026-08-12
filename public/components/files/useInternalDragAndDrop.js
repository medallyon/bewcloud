import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { isValidMoveTarget } from '/public/ts/utils/files.ts';
import { showToast } from '/public/ts/utils/toast.ts';
import { moveDirectory, moveFile } from "./fileActions.js";
export const INTERNAL_DRAG_TYPE = 'application/x-bewcloud-items';
export function useInternalDragAndDrop({
  path,
  files,
  directories,
  items,
  chosenKeys,
  clearSelection,
  isEnabled
}) {
  const draggedItems = useSignal(null);
  const dropTargetPath = useSignal(null);
  const isMoving = useSignal(false);
  const isPointerPrecise = useSignal(false);
  useEffect(() => {
    isPointerPrecise.value = isEnabled && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }, [isEnabled]);
  function isValidDropTarget(targetPath) {
    const dragged = draggedItems.value;
    if (!dragged || isMoving.value) {
      return false;
    }
    return isValidMoveTarget(dragged.items, dragged.sourcePath, targetPath);
  }
  async function refetchListing() {
    try {
      const filesRequestBody = {
        parentPath: path.value
      };
      const directoriesRequestBody = {
        parentPath: path.value
      };
      const [filesResponse, directoriesResponse] = await Promise.all([fetch('/api/files/get', {
        method: 'POST',
        body: JSON.stringify(filesRequestBody)
      }), fetch('/api/files/get-directories', {
        method: 'POST',
        body: JSON.stringify(directoriesRequestBody)
      })]);
      const filesResult = await filesResponse.json();
      const directoriesResult = await directoriesResponse.json();
      if (filesResult.success) {
        files.value = [...filesResult.files];
      }
      if (directoriesResult.success) {
        directories.value = [...directoriesResult.directories];
      }
    } catch (error) {
      console.error(error);
    }
  }
  async function runMoves(items, newParentPath) {
    let lastNewFiles;
    let lastNewDirectories;
    for (const item of items) {
      if (item.isDirectory) {
        const result = await moveDirectory(item.parentPath, newParentPath, item.name);
        lastNewDirectories = result.newDirectories;
      } else {
        const result = await moveFile(item.parentPath, newParentPath, item.name);
        lastNewFiles = result.newFiles;
      }
    }
    if (lastNewDirectories) {
      directories.value = [...lastNewDirectories];
    }
    if (lastNewFiles) {
      files.value = [...lastNewFiles];
    }
  }
  async function moveItems(items, newParentPath, isUndo = false) {
    if (items.length === 0 || isMoving.value) {
      return;
    }
    isMoving.value = true;
    const movedKeys = new Set(items.map(item => item.key));
    directories.value = directories.value.filter(directory => !movedKeys.has(`${directory.parent_path}${directory.directory_name}/`));
    files.value = files.value.filter(file => !movedKeys.has(`${file.parent_path}${file.file_name}`));
    clearSelection();
    try {
      await runMoves(items, newParentPath);
      const itemsLabel = items.length === 1 ? `"${items[0].name}"` : `${items.length} items`;
      const targetLabel = newParentPath === '/' ? 'All files' : newParentPath.slice(0, -1).split('/').pop();
      showToast({
        message: isUndo ? `Moved ${itemsLabel} back.` : `Moved ${itemsLabel} to "${targetLabel}".`,
        type: 'success',
        action: isUndo ? undefined : {
          label: 'Undo',
          onClick: () => {
            const movedItems = items.map(item => ({
              ...item,
              parentPath: newParentPath
            }));
            moveItems(movedItems, items[0].parentPath, true).catch(console.error);
          }
        }
      });
    } catch (error) {
      console.error(error);
      showToast({
        message: 'Failed to move. Nothing was left half-moved on purpose — refreshing the list.',
        type: 'error'
      });
      await refetchListing();
    }
    isMoving.value = false;
  }
  function getItemDragProps(item) {
    if (!isPointerPrecise.value || item.isTrash) {
      return undefined;
    }
    return {
      draggable: true,
      onDragStart: event => {
        const isItemChosen = chosenKeys.includes(item.key);
        const chosenItems = isItemChosen ? items.filter(_item => chosenKeys.includes(_item.key)) : [item];
        if (!isItemChosen) {
          clearSelection();
        }
        draggedItems.value = {
          items: chosenItems,
          sourcePath: path.value
        };
        event.dataTransfer?.setData(INTERNAL_DRAG_TYPE, '1');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
        }
      },
      onDragEnd: () => {
        draggedItems.value = null;
        dropTargetPath.value = null;
      }
    };
  }
  function getDropTargetProps(targetPath) {
    function isInternalDrag(event) {
      return Boolean(event.dataTransfer?.types.includes(INTERNAL_DRAG_TYPE));
    }
    return {
      onDragEnter: event => {
        if (!isInternalDrag(event) || !isValidDropTarget(targetPath)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        dropTargetPath.value = targetPath;
      },
      onDragOver: event => {
        if (!isInternalDrag(event) || !isValidDropTarget(targetPath)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'move';
        }
      },
      onDragLeave: event => {
        if (!isInternalDrag(event)) {
          return;
        }
        event.stopPropagation();
        if (dropTargetPath.value === targetPath) {
          dropTargetPath.value = null;
        }
      },
      onDrop: event => {
        if (!isInternalDrag(event) || !isValidDropTarget(targetPath)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const dragged = draggedItems.value;
        draggedItems.value = null;
        dropTargetPath.value = null;
        if (dragged) {
          moveItems(dragged.items, targetPath).catch(console.error);
        }
      }
    };
  }
  return {
    dropTargetPath,
    isMoving,
    moveItems,
    getItemDragProps,
    getDropTargetProps
  };
}