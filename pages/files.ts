import page, { RequestHandlerParams } from '/lib/page.ts';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { DirectoryModel, FileModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';
import { html } from '/public/ts/utils/misc.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import Loading from '/components/Loading.ts';
import {
  FileView,
  SortColumn,
  sortDirectories,
  sortFiles,
  SortOrder,
  VALID_FILE_VIEWS,
  VALID_SORT_COLUMNS,
  VALID_SORT_ORDERS,
} from '/public/ts/utils/files.ts';
import { generateUploadSessionTag } from '/lib/auth.ts';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams) {
  const baseUrl = (await AppConfig.getConfig()).auth.baseUrl;

  if (!(await AppConfig.isAppEnabled('files'))) {
    return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
  }

  const searchParams = new URL(request.url).searchParams;

  let currentPath = searchParams.get('path') || '/';

  // Send invalid paths back to root
  if (!currentPath.startsWith('/') || currentPath.includes('../')) {
    currentPath = '/';
  }

  // Always append a trailing slash
  if (!currentPath.endsWith('/')) {
    currentPath = `${currentPath}/`;
  }

  const savedSorting = user!.extra.file_sorting;
  const urlSortBy = searchParams.get('sortBy');
  const urlSortOrder = searchParams.get('sortOrder');

  const initialSortBy =
    ((urlSortBy && VALID_SORT_COLUMNS.includes(urlSortBy as SortColumn))
      ? urlSortBy
      : (savedSorting?.sort_by && VALID_SORT_COLUMNS.includes(savedSorting.sort_by as SortColumn))
      ? savedSorting.sort_by
      : 'name') as SortColumn;

  const initialSortOrder =
    ((urlSortOrder && VALID_SORT_ORDERS.includes(urlSortOrder as SortOrder))
      ? urlSortOrder
      : (savedSorting?.sort_order && VALID_SORT_ORDERS.includes(savedSorting.sort_order as SortOrder))
      ? savedSorting.sort_order
      : 'asc') as SortOrder;

  const urlView = searchParams.get('view');
  const initialView: FileView = VALID_FILE_VIEWS.includes(urlView as FileView)
    ? urlView as FileView
    : user!.extra.file_view || 'list';

  let userDirectories = await DirectoryModel.list(user!.id, currentPath);

  let userFiles = await FileModel.list(user!.id, currentPath);

  const sortOptions = { sortBy: initialSortBy, sortOrder: initialSortOrder };
  userDirectories = sortDirectories(userDirectories, sortOptions);
  userFiles = sortFiles(userFiles, sortOptions);

  const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();
  const areDirectoryDownloadsAllowed = await AppConfig.areDirectoryDownloadsAllowed();

  const htmlContent = defaultHtmlContent({
    userDirectories,
    userFiles,
    currentPath,
    baseUrl,
    isFileSharingAllowed: isPublicFileSharingAllowed,
    areDirectoryDownloadsAllowed,
    initialSortBy,
    initialSortOrder,
    initialView,
    uploadSessionTag: await generateUploadSessionTag(session?.tokenData?.session_id),
  });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix: 'Files',
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

function defaultHtmlContent(
  {
    userDirectories,
    userFiles,
    currentPath,
    baseUrl,
    isFileSharingAllowed,
    areDirectoryDownloadsAllowed,
    initialSortBy,
    initialSortOrder,
    initialView,
    uploadSessionTag,
  }: {
    userDirectories: Directory[];
    userFiles: DirectoryFile[];
    currentPath: string;
    baseUrl: string;
    isFileSharingAllowed: boolean;
    areDirectoryDownloadsAllowed: boolean;
    initialSortBy: string;
    initialSortOrder: string;
    initialView: FileView;
    uploadSessionTag: string;
  },
) {
  return html`
    <main id="main">
      <section id="main-files">
        ${Loading()}
      </section>
    </main>

    <script type="module">
    import { h, render, Fragment } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;
    window.Fragment = Fragment;

    import MainFiles from '/public/components/files/MainFiles.js';
    import { registerUploadServiceWorker } from '/public/ts/service-worker.ts';

    const mainFilesElement = document.getElementById('main-files');

    if (mainFilesElement) {
      const mainFilesApp = h(MainFiles, {
        initialDirectories: ${JSON.stringify(userDirectories)},
        initialFiles: ${JSON.stringify(userFiles)},
        initialPath: ${JSON.stringify(currentPath)},
        baseUrl: ${JSON.stringify(baseUrl)},
        isFileSharingAllowed: ${JSON.stringify(isFileSharingAllowed)},
        areDirectoryDownloadsAllowed: ${JSON.stringify(areDirectoryDownloadsAllowed)},
        initialSortBy: ${JSON.stringify(initialSortBy)},
        initialSortOrder: ${JSON.stringify(initialSortOrder)},
        initialView: ${JSON.stringify(initialView)},
        uploadSessionTag: ${JSON.stringify(uploadSessionTag)},
      });

      render(mainFilesApp, mainFilesElement);

      document.getElementById('loading')?.remove();
    }

    registerUploadServiceWorker();
    </script>
  `;
}

export default page({
  get,
  accessMode: 'user',
});
