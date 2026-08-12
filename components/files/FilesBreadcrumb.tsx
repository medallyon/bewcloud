import { FileView, SortColumn, SortOrder } from '/public/ts/utils/files.ts';

interface FilesBreadcrumbProps {
  path: string;
  isShowingNotes?: boolean;
  isShowingPhotos?: boolean;
  fileShareId?: string;
  sortBy?: SortColumn;
  sortOrder?: SortOrder;
  view?: FileView;
}

const crumbClass = 'inline-flex min-h-11 items-center font-normal text-white hover:underline';

export default function FilesBreadcrumb({
  path,
  isShowingNotes,
  isShowingPhotos,
  fileShareId,
  sortBy = 'name',
  sortOrder = 'asc',
  view,
}: FilesBreadcrumbProps) {
  let routePath = fileShareId ? `file-share/${fileShareId}` : 'files';
  let rootPath = '/';
  let itemPluralLabel = 'files';

  if (isShowingNotes) {
    routePath = 'notes';
    itemPluralLabel = 'notes';
    rootPath = '/Notes/';
  } else if (isShowingPhotos) {
    routePath = 'photos';
    itemPluralLabel = 'photos';
    rootPath = '/Photos/';
  }

  const commonSearchParams = new URLSearchParams({ sortBy, sortOrder });

  if (view) {
    commonSearchParams.set('view', view);
  }
  const rootHref = `/${routePath}?path=${encodeURIComponent(rootPath)}&${commonSearchParams.toString()}`;
  const pathParts = path === rootPath ? [] : path.slice(1, -1).split('/');

  return (
    <nav aria-label='Breadcrumb' class='min-w-0'>
      <ol class='flex items-center gap-1 overflow-x-auto whitespace-nowrap text-base font-semibold'>
        <li>
          {path === rootPath
            ? <span class='inline-flex min-h-11 items-center text-white'>All {itemPluralLabel}</span>
            : <a href={rootHref} class={crumbClass}>All {itemPluralLabel}</a>}
        </li>
        {pathParts.map((part, index) => {
          // Notes and photos live under a fixed root directory, which the root crumb already stands for
          if (index === 0 && (isShowingNotes || isShowingPhotos)) {
            return null;
          }

          const isLastPart = index === pathParts.length - 1;
          // The path arrives already decoded from the query string, so it's encoded exactly once on the way back out
          const pathForPart = `/${pathParts.slice(0, index + 1).join('/')}/`;

          return (
            <li key={pathForPart} class='flex items-center gap-1'>
              <span class='text-xs text-slate-400'>/</span>
              {isLastPart ? <span class='inline-flex min-h-11 items-center text-white'>{part}</span> : (
                <a
                  href={`/${routePath}?path=${encodeURIComponent(pathForPart)}&${commonSearchParams.toString()}`}
                  class={crumbClass}
                >
                  {part}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
