export default function FilesBulkBar({
  chosenItemsCount,
  onClickMove,
  onClickDelete,
  onClickClear
}) {
  if (chosenItemsCount === 0) {
    return null;
  }
  return h("section", {
    class: "max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-30 flex items-center gap-2 border border-slate-600 bg-slate-900 px-4 py-2 max-md:rounded-none md:mb-2 md:rounded-xl"
  }, h("span", {
    class: "flex-1 text-sm text-slate-100"
  }, chosenItemsCount, " selected"), h("button", {
    class: "min-h-11 rounded-lg px-3 text-sm font-semibold text-white hover:bg-slate-700",
    type: "button",
    onClick: onClickMove
  }, "Move"), h("button", {
    class: "min-h-11 rounded-lg px-3 text-sm font-semibold text-red-400 hover:bg-slate-700",
    type: "button",
    onClick: onClickDelete
  }, "Delete"), h("button", {
    class: "min-h-11 min-w-11 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white",
    type: "button",
    title: "Clear selection",
    "aria-label": "Clear selection",
    onClick: onClickClear
  }, "\u2715"));
}