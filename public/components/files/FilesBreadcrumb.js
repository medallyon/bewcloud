const crumbClass = 'inline-flex min-h-11 items-center font-normal text-white hover:underline';
export default function FilesBreadcrumb({
  path,
  isShowingNotes,
  isShowingPhotos,
  fileShareId,
  sortBy = 'name',
  sortOrder = 'asc'
}) {
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
  const commonSearchParams = new URLSearchParams({
    sortBy,
    sortOrder
  });
  const rootHref = `/${routePath}?path=${encodeURIComponent(rootPath)}&${commonSearchParams.toString()}`;
  const pathParts = path === rootPath ? [] : path.slice(1, -1).split('/');
  return h("nav", {
    "aria-label": "Breadcrumb",
    class: "min-w-0"
  }, h("ol", {
    class: "flex items-center gap-1 overflow-x-auto whitespace-nowrap text-base font-semibold"
  }, h("li", null, path === rootPath ? h("span", {
    class: "inline-flex min-h-11 items-center text-white"
  }, "All ", itemPluralLabel) : h("a", {
    href: rootHref,
    class: crumbClass
  }, "All ", itemPluralLabel)), pathParts.map((part, index) => {
    if (index === 0 && (isShowingNotes || isShowingPhotos)) {
      return null;
    }
    const isLastPart = index === pathParts.length - 1;
    const pathForPart = `/${pathParts.slice(0, index + 1).join('/')}/`;
    return h("li", {
      key: pathForPart,
      class: "flex items-center gap-1"
    }, h("span", {
      class: "text-xs text-slate-400"
    }, "/"), isLastPart ? h("span", {
      class: "inline-flex min-h-11 items-center text-white"
    }, part) : h("a", {
      href: `/${routePath}?path=${encodeURIComponent(pathForPart)}&${commonSearchParams.toString()}`,
      class: crumbClass
    }, part));
  })));
}