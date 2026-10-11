interface FilesBulkBarProps {
  chosenItemsCount: number;
  onClickMove: () => void;
  onClickDelete: () => void;
  onClickClear: () => void;
}

export default function FilesBulkBar(
  { chosenItemsCount, onClickMove, onClickDelete, onClickClear }: FilesBulkBarProps,
) {
  if (chosenItemsCount === 0) {
    return null;
  }

  // Floating on every breakpoint rather than in flow, so selecting an item doesn't push the whole list down by the bar's height
  return (
    <section class='fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-30 flex items-center gap-2 border border-slate-600 bg-slate-900 px-4 py-2 max-md:rounded-none md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2 md:rounded-xl md:shadow-lg md:shadow-black/40'>
      <span class='flex-1 text-sm text-slate-100'>
        {chosenItemsCount} selected
      </span>

      {/* Selection-first moving is the primary path on every device; dragging is a desktop accelerator on top of it */}
      <button
        class='min-h-11 rounded-lg px-3 text-sm font-semibold text-white hover:bg-slate-700'
        type='button'
        onClick={onClickMove}
      >
        Move
      </button>

      <button
        class='min-h-11 rounded-lg px-3 text-sm font-semibold text-red-400 hover:bg-slate-700'
        type='button'
        onClick={onClickDelete}
      >
        Delete
      </button>

      <button
        class='min-h-11 min-w-11 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white'
        type='button'
        title='Clear selection'
        aria-label='Clear selection'
        onClick={onClickClear}
      >
        ✕
      </button>
    </section>
  );
}
