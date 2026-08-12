import { TRASH_PATH } from '/public/ts/utils/files.ts';
const linkClass = 'flex min-h-11 items-center gap-2 truncate rounded-lg px-3 text-sm font-normal';
const activeLinkClass = 'bg-slate-700 text-white';
const defaultLinkClass = 'text-slate-300 hover:bg-slate-700 hover:text-white';
export default function FilesSidebar({
  path,
  directories,
  sortBy,
  sortOrder,
  view
}) {
  const searchParams = new URLSearchParams({
    sortBy,
    sortOrder,
    view
  });
  function hrefFor(directoryPath) {
    return `/files?path=${encodeURIComponent(directoryPath)}&${searchParams.toString()}`;
  }
  const pathParts = path === '/' ? [] : path.slice(1, -1).split('/');
  const ancestors = pathParts.map((part, index) => ({
    name: part,
    path: `/${pathParts.slice(0, index + 1).join('/')}/`
  }));
  return h("nav", {
    "aria-label": "Folders",
    class: "flex flex-col gap-1"
  }, h("a", {
    href: hrefFor('/'),
    class: `${linkClass} ${path === '/' ? activeLinkClass : defaultLinkClass}`
  }, h("img", {
    src: "/public/images/files.svg",
    alt: "",
    class: "white shrink-0",
    width: 18,
    height: 18
  }), "All files"), h("a", {
    href: hrefFor(TRASH_PATH),
    class: `${linkClass} ${path === TRASH_PATH ? activeLinkClass : defaultLinkClass}`
  }, h("img", {
    src: "/public/images/trash.svg",
    alt: "",
    class: "white shrink-0",
    width: 18,
    height: 18
  }), "Trash"), ancestors.length > 0 ? h("ol", {
    class: "mt-2 flex flex-col gap-1 border-t border-slate-700 pt-2"
  }, ancestors.map((ancestor, index) => h("li", {
    key: ancestor.path,
    style: {
      paddingLeft: `${index * 0.75}rem`
    }
  }, h("a", {
    href: hrefFor(ancestor.path),
    class: `${linkClass} ${ancestor.path === path ? activeLinkClass : defaultLinkClass}`,
    title: ancestor.name
  }, h("img", {
    src: "/public/images/directory.svg",
    alt: "",
    class: "white shrink-0",
    width: 18,
    height: 18
  }), ancestor.name)))) : null, directories.length > 0 ? h("ol", {
    class: "mt-2 flex flex-col gap-1 border-t border-slate-700 pt-2",
    style: {
      paddingLeft: `${ancestors.length * 0.75}rem`
    }
  }, directories.map(directory => {
    const directoryPath = `${directory.parent_path}${directory.directory_name}/`;
    return h("li", {
      key: directoryPath
    }, h("a", {
      href: hrefFor(directoryPath),
      class: `${linkClass} ${defaultLinkClass}`,
      title: directory.directory_name
    }, h("img", {
      src: `/public/images/${directoryPath === TRASH_PATH ? 'trash' : 'directory'}.svg`,
      alt: "",
      class: "white shrink-0",
      width: 18,
      height: 18
    }), directory.directory_name));
  })) : null);
}