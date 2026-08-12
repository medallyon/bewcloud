import { Directory } from '/lib/types.ts';
import { FileView, SortColumn, SortOrder, TRASH_PATH } from '/public/ts/utils/files.ts';
import { FilesDragAndDrop } from './useInternalDragAndDrop.ts';

interface FilesSidebarProps {
  path: string;
  directories: Directory[];
  sortBy: SortColumn;
  sortOrder: SortOrder;
  view: FileView;
  dragAndDrop?: FilesDragAndDrop;
}

const linkClass = 'flex min-h-11 items-center gap-2 truncate rounded-lg px-3 text-sm font-normal';
const activeLinkClass = 'bg-slate-700 text-white';
const defaultLinkClass = 'text-slate-300 hover:bg-slate-700 hover:text-white';

// ponytail: the tree only knows the current path's ancestors and the directories already loaded for this view, so it
// grows as you navigate instead of pre-fetching. Expanding an unvisited branch in place would need one
// /api/files/get-directories call per node, which is only worth adding if navigating for it turns out to annoy anyone.
export default function FilesSidebar(
  { path, directories, sortBy, sortOrder, view, dragAndDrop }: FilesSidebarProps,
) {
  const searchParams = new URLSearchParams({ sortBy, sortOrder, view });

  function dropProps(targetPath: string) {
    return {
      class: dragAndDrop?.dropTargetPath === targetPath ? 'rounded-lg outline outline-2 outline-accent' : '',
      ...(dragAndDrop ? dragAndDrop.getDropTargetProps(targetPath) : {}),
    };
  }

  function hrefFor(directoryPath: string) {
    return `/files?path=${encodeURIComponent(directoryPath)}&${searchParams.toString()}`;
  }

  const pathParts = path === '/' ? [] : path.slice(1, -1).split('/');
  const ancestors = pathParts.map((part, index) => ({
    name: part,
    path: `/${pathParts.slice(0, index + 1).join('/')}/`,
  }));

  return (
    <nav aria-label='Folders' class='flex flex-col gap-1'>
      <div {...dropProps('/')}>
        <a href={hrefFor('/')} class={`${linkClass} ${path === '/' ? activeLinkClass : defaultLinkClass}`}>
          <img src='/public/images/files.svg' alt='' class='white shrink-0' width={18} height={18} />
          All files
        </a>
      </div>
      {/* Dropping into the Trash is just a move, so it stays a valid target */}
      <div {...dropProps(TRASH_PATH)}>
        <a
          href={hrefFor(TRASH_PATH)}
          class={`${linkClass} ${path === TRASH_PATH ? activeLinkClass : defaultLinkClass}`}
        >
          <img src='/public/images/trash.svg' alt='' class='white shrink-0' width={18} height={18} />
          Trash
        </a>
      </div>

      {ancestors.length > 0
        ? (
          <ol class='mt-2 flex flex-col gap-1 border-t border-slate-700 pt-2'>
            {ancestors.map((ancestor, index) => (
              <li key={ancestor.path} style={{ paddingLeft: `${index * 0.75}rem` }} {...dropProps(ancestor.path)}>
                <a
                  href={hrefFor(ancestor.path)}
                  class={`${linkClass} ${ancestor.path === path ? activeLinkClass : defaultLinkClass}`}
                  title={ancestor.name}
                >
                  <img src='/public/images/directory.svg' alt='' class='white shrink-0' width={18} height={18} />
                  {ancestor.name}
                </a>
              </li>
            ))}
          </ol>
        )
        : null}

      {directories.length > 0
        ? (
          <ol
            class='mt-2 flex flex-col gap-1 border-t border-slate-700 pt-2'
            style={{ paddingLeft: `${ancestors.length * 0.75}rem` }}
          >
            {directories.map((directory) => {
              const directoryPath = `${directory.parent_path}${directory.directory_name}/`;

              return (
                <li key={directoryPath} {...dropProps(directoryPath)}>
                  <a
                    href={hrefFor(directoryPath)}
                    class={`${linkClass} ${defaultLinkClass}`}
                    title={directory.directory_name}
                  >
                    <img
                      src={`/public/images/${directoryPath === TRASH_PATH ? 'trash' : 'directory'}.svg`}
                      alt=''
                      class='white shrink-0'
                      width={18}
                      height={18}
                    />
                    {directory.directory_name}
                  </a>
                </li>
              );
            })}
          </ol>
        )
        : null}
    </nav>
  );
}
