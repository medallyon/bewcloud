function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import { TRASH_PATH } from '/public/ts/utils/files.ts';
const linkClass = 'flex min-h-11 items-center gap-2 truncate rounded-lg px-3 text-sm font-normal';
const activeLinkClass = 'bg-slate-700 text-white';
const defaultLinkClass = 'text-slate-300 hover:bg-slate-700 hover:text-white';
export default function FilesSidebar({
  path,
  directories,
  sortBy,
  sortOrder,
  view,
  dragAndDrop
}) {
  const searchParams = new URLSearchParams({
    sortBy,
    sortOrder,
    view
  });
  function dropProps(targetPath) {
    return {
      class: dragAndDrop?.dropTargetPath === targetPath ? 'rounded-lg outline outline-2 outline-accent' : '',
      ...(dragAndDrop ? dragAndDrop.getDropTargetProps(targetPath) : {})
    };
  }
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
  }, h("div", dropProps('/'), h("a", {
    href: hrefFor('/'),
    class: `${linkClass} ${path === '/' ? activeLinkClass : defaultLinkClass}`
  }, h("img", {
    src: "/public/images/files.svg",
    alt: "",
    class: "white shrink-0",
    width: 18,
    height: 18
  }), "All files")), h("div", dropProps(TRASH_PATH), h("a", {
    href: hrefFor(TRASH_PATH),
    class: `${linkClass} ${path === TRASH_PATH ? activeLinkClass : defaultLinkClass}`
  }, h("img", {
    src: "/public/images/trash.svg",
    alt: "",
    class: "white shrink-0",
    width: 18,
    height: 18
  }), "Trash")), ancestors.length > 0 ? h("ol", {
    class: "mt-2 flex flex-col gap-1 border-t border-slate-700 pt-2"
  }, ancestors.map((ancestor, index) => h("li", _extends({
    key: ancestor.path,
    style: {
      paddingLeft: `${index * 0.75}rem`
    }
  }, dropProps(ancestor.path)), h("a", {
    href: hrefFor(ancestor.path),
    class: `${linkClass} ${ancestor.path === path ? activeLinkClass : defaultLinkClass}`,
    title: ancestor.name
  }, h("img", {
    src: "/public/images/directory.svg",
    alt: "",
    class: "white shrink-0",
    width: 18,
    height: 18
  }), ancestor.name)))) : null, directories.filter(directory => `${directory.parent_path}${directory.directory_name}/` !== TRASH_PATH).length > 0 ? h("ol", {
    class: "mt-2 flex flex-col gap-1 border-t border-slate-700 pt-2",
    style: {
      paddingLeft: `${ancestors.length * 0.75}rem`
    }
  }, directories.filter(directory => `${directory.parent_path}${directory.directory_name}/` !== TRASH_PATH).map(directory => {
    const directoryPath = `${directory.parent_path}${directory.directory_name}/`;
    return h("li", _extends({
      key: directoryPath
    }, dropProps(directoryPath)), h("a", {
      href: hrefFor(directoryPath),
      class: `${linkClass} ${defaultLinkClass}`,
      title: directory.directory_name
    }, h("img", {
      src: "/public/images/directory.svg",
      alt: "",
      class: "white shrink-0",
      width: 18,
      height: 18
    }), directory.directory_name));
  })) : null);
}