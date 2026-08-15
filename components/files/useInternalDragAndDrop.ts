import { Signal, useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { Directory, DirectoryFile } from '/lib/types.ts';
import {
  RequestBody as GetDirectoriesRequestBody,
  ResponseBody as GetDirectoriesResponseBody,
} from '/pages/api/files/get-directories.ts';
import { RequestBody as GetFilesRequestBody, ResponseBody as GetFilesResponseBody } from '/pages/api/files/get.ts';
import { isValidMoveTarget } from '/public/ts/utils/files.ts';
import { showToast } from '/components/toast.ts';
import { FileItem } from './fileItemModel.ts';
import { moveDirectory, moveFile } from './fileActions.ts';

// dataTransfer.getData() returns '' during dragover/dragenter (protected mode), so validity has to be decided from
// .types alone. This marker is what tells an internal item drag apart from an OS file drop, which must still upload.
export const INTERNAL_DRAG_TYPE = 'application/x-bewcloud-items';

interface UseInternalDragAndDropOptions {
  path: Signal<string>;
  files: Signal<DirectoryFile[]>;
  directories: Signal<Directory[]>;
  /** The normalised listing the view already built, so the drag payload doesn't rebuild it. */
  items: FileItem[];
  chosenKeys: string[];
  clearSelection: () => void;
  isEnabled: boolean;
}

export interface ItemDragProps {
  draggable: true;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
}

export interface DropTargetProps {
  onDragEnter: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onDragLeave: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
}

export interface FilesDragAndDrop {
  dropTargetPath: string | null;
  getItemDragProps: (item: FileItem) => ItemDragProps | undefined;
  getDropTargetProps: (targetPath: string) => DropTargetProps;
}

export function useInternalDragAndDrop(
  { path, files, directories, items, chosenKeys, clearSelection, isEnabled }: UseInternalDragAndDropOptions,
) {
  const draggedItems = useSignal<{ items: FileItem[]; sourcePath: string } | null>(null);
  const dropTargetPath = useSignal<string | null>(null);
  const isMoving = useSignal<boolean>(false);
  // HTML5 drag-and-drop doesn't work on touch, and a stray draggable attribute there breaks long-press and scrolling
  const isPointerPrecise = useSignal<boolean>(false);

  useEffect(() => {
    isPointerPrecise.value = isEnabled && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }, [isEnabled]);

  function isValidDropTarget(targetPath: string) {
    const dragged = draggedItems.value;

    if (!dragged || isMoving.value) {
      return false;
    }

    return isValidMoveTarget(dragged.items, dragged.sourcePath, targetPath);
  }

  async function refetchListing() {
    try {
      const filesRequestBody: GetFilesRequestBody = { parentPath: path.value };
      const directoriesRequestBody: GetDirectoriesRequestBody = { parentPath: path.value };

      const [filesResponse, directoriesResponse] = await Promise.all([
        fetch('/api/files/get', { method: 'POST', body: JSON.stringify(filesRequestBody) }),
        fetch('/api/files/get-directories', { method: 'POST', body: JSON.stringify(directoriesRequestBody) }),
      ]);

      const filesResult = await filesResponse.json() as GetFilesResponseBody;
      const directoriesResult = await directoriesResponse.json() as GetDirectoriesResponseBody;

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

  // One request per item, sequentially: every response carries a whole listing, and concurrent moves race on the file system
  async function runMoves(items: FileItem[], newParentPath: string) {
    let lastNewFiles: DirectoryFile[] | undefined;
    let lastNewDirectories: Directory[] | undefined;

    for (const item of items) {
      if (item.isDirectory) {
        const result = await moveDirectory(item.parentPath, newParentPath, item.name);
        lastNewDirectories = result.newDirectories;
      } else {
        const result = await moveFile(item.parentPath, newParentPath, item.name);
        lastNewFiles = result.newFiles;
      }
    }

    // move only answers with files and move-directory only with directories, so applying every response as it arrives
    // would let an earlier file response resurrect directories that later moved away
    if (lastNewDirectories) {
      directories.value = [...lastNewDirectories];
    }

    if (lastNewFiles) {
      files.value = [...lastNewFiles];
    }
  }

  async function moveItems(items: FileItem[], newParentPath: string, isUndo = false) {
    if (items.length === 0 || isMoving.value) {
      return;
    }

    isMoving.value = true;

    const movedKeys = new Set(items.map((item) => item.key));

    // Optimistic: the moved entries leave the view immediately, and the responses below replace the listing anyway
    directories.value = directories.value.filter((directory) =>
      !movedKeys.has(`${directory.parent_path}${directory.directory_name}/`)
    );
    files.value = files.value.filter((file) => !movedKeys.has(`${file.parent_path}${file.file_name}`));

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
            // Same helpers with source and target swapped: each item goes back to the parent it came from
            const movedItems = items.map((item) => ({ ...item, parentPath: newParentPath }));

            moveItems(movedItems, items[0].parentPath, true).catch(console.error);
          },
        },
      });
    } catch (error) {
      console.error(error);
      showToast({
        message: 'Failed to move. Nothing was left half-moved on purpose — refreshing the list.',
        type: 'error',
      });

      await refetchListing();
    }

    isMoving.value = false;
  }

  function getItemDragProps(item: FileItem): ItemDragProps | undefined {
    if (!isPointerPrecise.value) {
      return undefined;
    }

    return {
      draggable: true,
      onDragStart: (event: DragEvent) => {
        // Dragging something outside the selection is a single-item drag, like Finder and Drive: it avoids "I dragged one thing and moved eleven"
        // The payload comes from this signal rather than dataTransfer, so a 500-item selection needs no JSON round-trip
        const isItemChosen = chosenKeys.includes(item.key);
        const chosenItems = isItemChosen ? items.filter((_item) => chosenKeys.includes(_item.key)) : [item];

        if (!isItemChosen) {
          clearSelection();
        }

        draggedItems.value = { items: chosenItems, sourcePath: path.value };

        event.dataTransfer?.setData(INTERNAL_DRAG_TYPE, '1');

        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
        }
      },
      onDragEnd: () => {
        draggedItems.value = null;
        dropTargetPath.value = null;
      },
    };
  }

  function getDropTargetProps(targetPath: string): DropTargetProps {
    function isInternalDrag(event: DragEvent) {
      return Boolean(event.dataTransfer?.types.includes(INTERNAL_DRAG_TYPE));
    }

    return {
      onDragEnter: (event: DragEvent) => {
        if (!isInternalDrag(event) || !isValidDropTarget(targetPath)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        dropTargetPath.value = targetPath;
      },
      // Without preventDefault the browser draws its own no-drop cursor, which is exactly what an invalid target should show
      onDragOver: (event: DragEvent) => {
        if (!isInternalDrag(event) || !isValidDropTarget(targetPath)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'move';
        }
      },
      onDragLeave: (event: DragEvent) => {
        if (!isInternalDrag(event)) {
          return;
        }

        event.stopPropagation();

        if (dropTargetPath.value === targetPath) {
          dropTargetPath.value = null;
        }
      },
      onDrop: (event: DragEvent) => {
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
      },
    };
  }

  return { dropTargetPath, isMoving, moveItems, getItemDragProps, getDropTargetProps };
}
