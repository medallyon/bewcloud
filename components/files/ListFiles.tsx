import { Directory, DirectoryFile } from '/lib/types.ts';
import { humanFileSize, TRASH_PATH } from '/public/ts/utils/files.ts';

interface ListFilesProps {
  directories: Directory[];
  files: DirectoryFile[];
  onClickDeleteDirectory?: (parentPath: string, name: string) => Promise<void>;
  onClickDeleteFile?: (parentPath: string, name: string) => Promise<void>;
  isShowingNotes?: boolean;
  isShowingPhotos?: boolean;
}

// The plain listing used by notes and photos. Files has its own components (FilesList/FilesGrid) because sorting,
// selection, renaming, moving, sharing and downloading are Files-only concerns that nothing here ever passed in.
export default function ListFiles(
  { directories, files, onClickDeleteDirectory, onClickDeleteFile, isShowingNotes, isShowingPhotos }: ListFilesProps,
) {
  const dateFormat = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

  let routePath = 'files';
  let itemSingleLabel = 'file';
  let itemPluralLabel = 'files';

  if (isShowingNotes) {
    routePath = 'notes';
    itemSingleLabel = 'note';
    itemPluralLabel = 'notes';
  } else if (isShowingPhotos) {
    routePath = 'photos';
    itemSingleLabel = 'photo';
    itemPluralLabel = 'photos';
  }

  if (isShowingPhotos && directories.length === 0) {
    return null;
  }

  return (
    <table class='w-full border-collapse overflow-hidden rounded-xl border border-slate-600 bg-slate-900 text-left text-sm text-slate-300'>
      <thead>
        <tr class='border-b border-slate-600'>
          <th scope='col' class='px-4 py-3 font-medium text-white'>Name</th>
          <th scope='col' class='hidden md:table-cell w-56 px-4 py-3 font-medium text-white'>Last update</th>
          {isShowingNotes || isShowingPhotos
            ? null
            : <th scope='col' class='w-28 px-4 py-3 font-medium text-white'>Size</th>}
          {isShowingPhotos ? null : <th scope='col' class='w-14 px-2 py-3'></th>}
        </tr>
      </thead>
      <tbody class='divide-y divide-slate-600'>
        {directories.map((directory) => {
          const fullPath = `${directory.parent_path}${directory.directory_name}/`;

          return (
            <tr key={fullPath} class='bg-slate-700 hover:bg-slate-600'>
              <td class='px-4 py-3'>
                <a
                  href={`/${routePath}?path=${encodeURIComponent(fullPath)}`}
                  class='flex items-center gap-2 font-normal text-white'
                >
                  <img
                    src={`/public/images/${fullPath === TRASH_PATH ? 'trash' : 'directory'}.svg`}
                    class='white shrink-0 drop-shadow-md'
                    width={18}
                    height={18}
                    alt='Directory'
                    title='Directory'
                  />
                  <span class='break-all'>{directory.directory_name}</span>
                </a>
              </td>
              <td class='hidden md:table-cell px-4 py-3'>{dateFormat.format(new Date(directory.updated_at))}</td>
              {isShowingNotes || isShowingPhotos
                ? null
                : <td class='px-4 py-3'>{humanFileSize(directory.size_in_bytes)}</td>}
              {isShowingPhotos ? null : (
                <td class='px-2 py-3'>
                  {onClickDeleteDirectory && fullPath !== TRASH_PATH
                    ? (
                      <button
                        class='flex min-h-11 min-w-11 items-center justify-center rounded-lg opacity-70 hover:bg-slate-600 hover:opacity-100'
                        type='button'
                        onClick={() => onClickDeleteDirectory(directory.parent_path, directory.directory_name)}
                      >
                        <img
                          src='/public/images/delete.svg'
                          class='red drop-shadow-md'
                          width={20}
                          height={20}
                          alt='Delete directory'
                          title='Delete directory'
                        />
                      </button>
                    )
                    : null}
                </td>
              )}
            </tr>
          );
        })}
        {files.map((file) => (
          <tr key={`${file.parent_path}${file.file_name}`} class='bg-slate-700 hover:bg-slate-600'>
            <td class='px-4 py-3'>
              <a
                href={`/${routePath}/open/${encodeURIComponent(file.file_name)}?path=${
                  encodeURIComponent(file.parent_path)
                }`}
                class='flex items-center gap-2 font-normal text-white'
                target='_blank'
                rel='noopener noreferrer'
              >
                <img
                  src='/public/images/file.svg'
                  class='white shrink-0 drop-shadow-md'
                  width={18}
                  height={18}
                  alt='File'
                  title='File'
                />
                <span class='break-all'>{file.file_name}</span>
              </a>
            </td>
            <td class='hidden md:table-cell px-4 py-3'>{dateFormat.format(new Date(file.updated_at))}</td>
            {isShowingNotes ? null : <td class='px-4 py-3'>{humanFileSize(file.size_in_bytes)}</td>}
            {isShowingPhotos ? null : (
              <td class='px-2 py-3'>
                {onClickDeleteFile
                  ? (
                    <button
                      class='flex min-h-11 min-w-11 items-center justify-center rounded-lg opacity-70 hover:bg-slate-600 hover:opacity-100'
                      type='button'
                      onClick={() => onClickDeleteFile(file.parent_path, file.file_name)}
                    >
                      <img
                        src='/public/images/delete.svg'
                        class='red drop-shadow-md'
                        width={20}
                        height={20}
                        alt={`Delete ${itemSingleLabel}`}
                        title={`Delete ${itemSingleLabel}`}
                      />
                    </button>
                  )
                  : null}
              </td>
            )}
          </tr>
        ))}
        {directories.length === 0 && files.length === 0
          ? (
            <tr>
              <td class='px-4 py-6 font-normal text-slate-400' colspan={4}>No {itemPluralLabel} to show</td>
            </tr>
          )
          : null}
      </tbody>
    </table>
  );
}
