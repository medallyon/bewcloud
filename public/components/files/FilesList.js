function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import { humanFileSize } from '/public/ts/utils/files.ts';
import FilesItemMenu from "./FilesItemMenu.js";
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour12: false,
  hour: '2-digit',
  minute: '2-digit'
});
export default function FilesList({
  items,
  chosenKeys,
  areAllItemsChosen,
  areSomeItemsChosen,
  isSelectable,
  sortBy,
  sortOrder,
  onClickSort,
  onToggleChoose,
  onToggleChooseAll,
  ...actions
}) {
  const chosenKeysSet = new Set(chosenKeys);
  function renderSortableHeader(label, column, extraClassName) {
    if (!onClickSort) {
      return h("th", {
        scope: "col",
        class: `px-4 py-3 font-medium text-white ${extraClassName || ''}`
      }, label);
    }
    const isActive = sortBy === column;
    return h("th", {
      scope: "col",
      class: `px-4 py-3 font-medium text-white ${extraClassName || ''}`
    }, h("button", {
      class: `group flex w-full items-center gap-1 text-left ${isActive ? 'text-accent' : ''}`,
      onClick: () => onClickSort(column),
      type: "button"
    }, h("span", null, label), h("img", {
      src: isActive ? `/public/images/sort-${sortOrder === 'asc' ? 'up' : 'down'}.svg` : '/public/images/sort-none.svg',
      class: `white w-4 h-4 ${isActive ? '' : 'opacity-0 group-hover:opacity-100'}`,
      width: 16,
      height: 16,
      alt: "",
      title: isActive ? `Sorted ${sortOrder === 'asc' ? 'ascending' : 'descending'}` : `Sort by ${label.toLocaleLowerCase()}`
    })));
  }
  return h("table", {
    class: "w-full border-collapse overflow-hidden rounded-xl border border-slate-600 bg-slate-900 text-left text-sm text-slate-300"
  }, h("thead", null, h("tr", {
    class: "border-b border-slate-600"
  }, isSelectable ? h("th", {
    scope: "col",
    class: "w-10 pl-4 pr-2 font-medium text-white"
  }, h("input", {
    class: "h-4 w-4 cursor-pointer rounded border-slate-300 bg-slate-100 text-accent",
    type: "checkbox",
    ref: element => {
      if (element) {
        element.indeterminate = areSomeItemsChosen;
      }
    },
    onClick: () => onToggleChooseAll?.(!areAllItemsChosen),
    checked: areAllItemsChosen,
    title: areAllItemsChosen ? 'Deselect all' : 'Select all'
  })) : null, renderSortableHeader('Name', 'name'), renderSortableHeader('Last update', 'updated_at', 'hidden md:table-cell w-56'), renderSortableHeader('Size', 'size_in_bytes', 'w-28'), h("th", {
    scope: "col",
    class: "w-14 px-2 py-3"
  }))), h("tbody", {
    class: "divide-y divide-slate-600"
  }, items.map(item => h("tr", {
    key: item.key,
    class: "bg-slate-700 hover:bg-slate-600"
  }, isSelectable ? h("td", {
    class: "pl-4 pr-2 py-3"
  }, item.isTrash ? null : h("input", {
    class: "h-4 w-4 cursor-pointer rounded border-slate-300 bg-slate-100 text-accent",
    type: "checkbox",
    onClick: () => onToggleChoose?.(item),
    checked: chosenKeysSet.has(item.key),
    title: `Select ${item.name}`
  })) : null, h("td", {
    class: "px-4 py-3"
  }, h("a", {
    href: item.href,
    class: "flex items-center gap-2 font-normal text-white",
    target: item.isDirectory ? undefined : '_blank',
    rel: item.isDirectory ? undefined : 'noopener noreferrer'
  }, h("img", {
    src: `/public/images/${item.isTrash ? 'trash' : item.isDirectory ? 'directory' : 'file'}.svg`,
    class: "white shrink-0 drop-shadow-md",
    width: 18,
    height: 18,
    alt: item.isDirectory ? 'Directory' : 'File',
    title: item.isDirectory ? 'Directory' : 'File'
  }), h("span", {
    class: "break-all"
  }, item.name))), h("td", {
    class: "hidden md:table-cell px-4 py-3"
  }, dateFormat.format(new Date(item.updatedAt))), h("td", {
    class: "px-4 py-3"
  }, humanFileSize(item.sizeInBytes)), h("td", {
    class: "px-2 py-3"
  }, item.isTrash ? null : h(FilesItemMenu, _extends({
    item: item
  }, actions)))))));
}