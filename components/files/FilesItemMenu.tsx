import { FileItem, FileItemActions } from './fileItemModel.ts';

interface FilesItemMenuProps extends FileItemActions {
  item: FileItem;
}

// One always-visible kebab shared by the list and the grid, so neither duplicates action markup. Built on <details> so
// open/close, click-outside and Escape come from the browser; the shared name attribute keeps only one menu open.
export default function FilesItemMenu({
  item,
  onClickRename,
  onClickMove,
  onClickDelete,
  onClickDownload,
  onClickCreateShare,
  onClickManageShare,
}: FilesItemMenuProps) {
  const itemLabel = item.isDirectory ? 'directory' : 'file';

  const entries: { label: string; onClick: () => void; isDangerous?: boolean }[] = [];

  if (onClickDownload && item.isDirectory) {
    entries.push({ label: 'Download as zip', onClick: () => onClickDownload(item) });
  }

  if (onClickRename) {
    entries.push({ label: 'Rename', onClick: () => onClickRename(item) });
  }

  if (onClickMove) {
    entries.push({ label: 'Move', onClick: () => onClickMove(item) });
  }

  if (onClickCreateShare && !item.fileShareId) {
    entries.push({ label: 'Share publicly', onClick: () => onClickCreateShare(item) });
  }

  if (onClickManageShare && item.fileShareId) {
    entries.push({ label: 'Manage public share', onClick: () => onClickManageShare(item.fileShareId!) });
  }

  if (onClickDelete) {
    entries.push({
      label: item.isTrash ? 'Empty trash' : 'Delete',
      onClick: () => onClickDelete(item),
      isDangerous: true,
    });
  }

  if (entries.length === 0) {
    return null;
  }

  return (
    <details class='relative' name='files-item-menu'>
      <summary
        class='flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg text-slate-300 hover:bg-slate-600 hover:text-white'
        title={`Actions for this ${itemLabel}`}
      >
        <img
          src='/public/images/show-options.svg'
          alt={`Actions for ${item.name}`}
          class='white w-5 max-w-5'
          width={20}
          height={20}
        />
      </summary>

      <div class='absolute right-0 z-20 mt-1 w-52 origin-top-right rounded-xl border border-slate-500 bg-slate-700 py-1 shadow-lg'>
        {entries.map((entry) => (
          <button
            key={entry.label}
            type='button'
            class={`flex min-h-11 w-full items-center px-4 text-left text-sm hover:bg-slate-600 ${
              entry.isDangerous ? 'text-red-400' : 'text-white'
            }`}
            onClick={entry.onClick}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </details>
  );
}
