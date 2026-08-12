import { Directory, DirectoryFile } from '/lib/types.ts';
import { SortColumn, SortOrder, TRASH_PATH } from '/public/ts/utils/files.ts';

// Directories and files arrive as two differently-shaped arrays. Normalising them once lets the list and the grid iterate a single array instead of duplicating markup per shape.
export interface FileItem {
  key: string;
  name: string;
  parentPath: string;
  /** Directories keep their trailing slash, matching how paths are stored and compared everywhere else. */
  fullPath: string;
  isDirectory: boolean;
  isTrash: boolean;
  /** Hydrated islands receive this as a string, server-rendered code as a Date, so both are formatted through new Date(). */
  updatedAt: Date | string;
  sizeInBytes: number;
  fileShareId: string | null;
  href: string;
}

export interface FileItemActions {
  onClickRename?: (item: FileItem) => void;
  onClickMove?: (item: FileItem) => void;
  onClickDelete?: (item: FileItem) => void;
  onClickDownload?: (item: FileItem) => void;
  onClickCreateShare?: (item: FileItem) => void;
  onClickManageShare?: (fileShareId: string) => void;
}

interface ToFileItemsOptions {
  routePath: string;
  sortBy: SortColumn;
  sortOrder: SortOrder;
}

export function toFileItems(
  directories: Directory[],
  files: DirectoryFile[],
  { routePath, sortBy, sortOrder }: ToFileItemsOptions,
): FileItem[] {
  const searchParams = new URLSearchParams({ sortBy, sortOrder });

  const directoryItems: FileItem[] = directories.map((directory) => {
    const fullPath = `${directory.parent_path}${directory.directory_name}/`;

    return {
      key: fullPath,
      name: directory.directory_name,
      parentPath: directory.parent_path,
      fullPath,
      isDirectory: true,
      isTrash: fullPath === TRASH_PATH,
      updatedAt: directory.updated_at,
      sizeInBytes: directory.size_in_bytes,
      fileShareId: directory.file_share_id,
      href: `/${routePath}?path=${encodeURIComponent(fullPath)}&${searchParams.toString()}`,
    };
  });

  const fileItems: FileItem[] = files.map((file) => ({
    key: `${file.parent_path}${file.file_name}`,
    name: file.file_name,
    parentPath: file.parent_path,
    fullPath: `${file.parent_path}${file.file_name}`,
    isDirectory: false,
    isTrash: false,
    updatedAt: file.updated_at,
    sizeInBytes: file.size_in_bytes,
    fileShareId: file.file_share_id,
    href: `/${routePath}/open/${encodeURIComponent(file.file_name)}?path=${encodeURIComponent(file.parent_path)}`,
  }));

  return [...directoryItems, ...fileItems];
}
