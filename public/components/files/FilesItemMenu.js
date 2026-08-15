import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
export default function FilesItemMenu({
  item,
  onClickRename,
  onClickMove,
  onClickDelete,
  onClickDownload,
  onClickCreateShare,
  onClickManageShare
}) {
  const itemLabel = item.isDirectory ? 'directory' : 'file';
  const detailsRef = useRef(null);
  const position = useSignal(null);
  useEffect(() => {
    const details = detailsRef.current;
    if (!details) {
      return;
    }
    function close() {
      details.open = false;
    }
    function handleToggle() {
      if (!details.open) {
        position.value = null;
        return;
      }
      const rect = details.getBoundingClientRect();
      position.value = {
        top: rect.bottom + 4,
        right: globalThis.innerWidth - rect.right
      };
    }
    details.addEventListener('toggle', handleToggle);
    globalThis.addEventListener('scroll', close, true);
    globalThis.addEventListener('resize', close);
    return () => {
      details.removeEventListener('toggle', handleToggle);
      globalThis.removeEventListener('scroll', close, true);
      globalThis.removeEventListener('resize', close);
    };
  }, []);
  const entries = [];
  if (onClickDownload && item.isDirectory) {
    entries.push({
      label: 'Download as zip',
      onClick: () => onClickDownload(item)
    });
  }
  if (onClickRename) {
    entries.push({
      label: 'Rename',
      onClick: () => onClickRename(item)
    });
  }
  if (onClickMove) {
    entries.push({
      label: 'Move',
      onClick: () => onClickMove(item)
    });
  }
  if (onClickCreateShare && !item.fileShareId) {
    entries.push({
      label: 'Share publicly',
      onClick: () => onClickCreateShare(item)
    });
  }
  if (onClickManageShare && item.fileShareId) {
    entries.push({
      label: 'Manage public share',
      onClick: () => onClickManageShare(item.fileShareId)
    });
  }
  if (onClickDelete) {
    entries.push({
      label: 'Delete',
      onClick: () => onClickDelete(item),
      isDangerous: true
    });
  }
  if (entries.length === 0) {
    return null;
  }
  return h("details", {
    ref: detailsRef,
    class: "relative",
    name: "files-item-menu"
  }, h("summary", {
    class: "flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg text-slate-300 hover:bg-slate-600 hover:text-white",
    title: `Actions for this ${itemLabel}`
  }, h("img", {
    src: "/public/images/show-options.svg",
    alt: `Actions for ${item.name}`,
    class: "white w-5 max-w-5",
    width: 20,
    height: 20
  })), position.value ? h("div", {
    class: "fixed z-10 w-52 origin-top-right rounded-xl border border-slate-500 bg-slate-700 py-1 shadow-lg",
    style: {
      top: `${position.value.top}px`,
      right: `${position.value.right}px`
    }
  }, entries.map(entry => h("button", {
    key: entry.label,
    type: "button",
    class: `flex min-h-11 w-full items-center px-4 text-left text-sm hover:bg-slate-600 ${entry.isDangerous ? 'text-red-400' : 'text-white'}`,
    onClick: entry.onClick
  }, entry.label))) : null);
}