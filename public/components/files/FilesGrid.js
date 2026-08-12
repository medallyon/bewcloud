function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import { humanFileSize } from '/public/ts/utils/files.ts';
import { PHOTO_IMAGE_EXTENSIONS } from '/public/ts/utils/photos.ts';
import FilesItemMenu from "./FilesItemMenu.js";
function getExtension(name) {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLocaleLowerCase() : '';
}
function isImage(item) {
  return !item.isDirectory && PHOTO_IMAGE_EXTENSIONS.includes(getExtension(item.name));
}
export default function FilesGrid({
  items,
  chosenKeys,
  isSelectable,
  areThumbnailsAvailable,
  onToggleChoose,
  ...actions
}) {
  const chosenKeysSet = new Set(chosenKeys);
  return h("section", {
    class: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
  }, items.map(item => {
    const extension = getExtension(item.name);
    return h("article", {
      key: item.key,
      class: `relative flex flex-col overflow-hidden rounded-xl border bg-slate-700 hover:bg-slate-600 ${chosenKeysSet.has(item.key) ? 'border-accent' : 'border-slate-600'}`
    }, h("a", {
      href: item.href,
      class: "block",
      target: item.isDirectory ? undefined : '_blank',
      rel: item.isDirectory ? undefined : 'noopener noreferrer'
    }, h("span", {
      class: "flex aspect-square items-center justify-center bg-slate-900"
    }, isImage(item) && areThumbnailsAvailable ? h("img", {
      src: `/files/thumbnail/${encodeURIComponent(item.name)}?path=${encodeURIComponent(item.parentPath)}&width=400&height=400`,
      alt: item.name,
      class: "h-full w-full object-cover",
      loading: "lazy",
      width: 400,
      height: 400
    }) : h("span", {
      class: "flex flex-col items-center gap-1"
    }, h("img", {
      src: `/public/images/${item.isTrash ? 'trash' : item.isDirectory ? 'directory' : 'file'}.svg`,
      alt: item.isDirectory ? 'Directory' : 'File',
      class: "white opacity-80",
      width: 32,
      height: 32
    }), !item.isDirectory && extension ? h("span", {
      class: "text-xs uppercase text-slate-400"
    }, extension) : null))), h("footer", {
      class: "flex items-start gap-1 px-2 py-2"
    }, h("a", {
      href: item.href,
      class: "min-w-0 flex-1 text-sm font-normal text-white",
      target: item.isDirectory ? undefined : '_blank',
      rel: item.isDirectory ? undefined : 'noopener noreferrer'
    }, h("span", {
      class: "line-clamp-2 break-all"
    }, item.name), h("span", {
      class: "block text-xs text-slate-400"
    }, humanFileSize(item.sizeInBytes))), item.isTrash ? null : h(FilesItemMenu, _extends({
      item: item
    }, actions))), isSelectable && !item.isTrash ? h("input", {
      class: "absolute left-2 top-2 h-4 w-4 cursor-pointer rounded border-slate-300 bg-slate-100 text-accent",
      type: "checkbox",
      onClick: () => onToggleChoose?.(item),
      checked: chosenKeysSet.has(item.key),
      title: `Select ${item.name}`
    }) : null);
  }));
}