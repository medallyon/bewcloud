import { TRASH_PATH } from '/public/ts/utils/files.ts';
export function toFileItems(directories, files, {
  routePath,
  sortBy,
  sortOrder,
  view
}) {
  const searchParams = new URLSearchParams({
    sortBy,
    sortOrder
  });
  if (view) {
    searchParams.set('view', view);
  }
  const directoryItems = directories.map(directory => {
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
      href: `/${routePath}?path=${encodeURIComponent(fullPath)}&${searchParams.toString()}`
    };
  });
  const fileItems = files.map(file => ({
    key: `${file.parent_path}${file.file_name}`,
    name: file.file_name,
    parentPath: file.parent_path,
    fullPath: `${file.parent_path}${file.file_name}`,
    isDirectory: false,
    isTrash: false,
    updatedAt: file.updated_at,
    sizeInBytes: file.size_in_bytes,
    fileShareId: file.file_share_id,
    href: `/${routePath}/open/${encodeURIComponent(file.file_name)}?path=${encodeURIComponent(file.parent_path)}`
  }));
  return [...directoryItems, ...fileItems];
}