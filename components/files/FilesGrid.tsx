import { humanFileSize } from '/public/ts/utils/files.ts';
import { PHOTO_IMAGE_EXTENSIONS } from '/public/ts/utils/photos.ts';
import { FileItem, FileItemActions } from './fileItemModel.ts';
import FilesItemMenu from './FilesItemMenu.tsx';
import { FilesDragAndDrop } from './useInternalDragAndDrop.ts';

interface FilesGridProps extends FileItemActions {
  items: FileItem[];
  chosenKeys: string[];
  isSelectable: boolean;
  /** The thumbnail endpoint is user-only, so a public share falls back to glyphs. */
  areThumbnailsAvailable: boolean;
  onToggleChoose?: (item: FileItem) => void;
  dragAndDrop?: FilesDragAndDrop;
}

function getExtension(name: string) {
  const parts = name.split('.');

  return parts.length > 1 ? parts.pop()!.toLocaleLowerCase() : '';
}

function isImage(item: FileItem) {
  return !item.isDirectory &&
    (PHOTO_IMAGE_EXTENSIONS as readonly string[]).includes(getExtension(item.name));
}

export default function FilesGrid({
  items,
  chosenKeys,
  isSelectable,
  areThumbnailsAvailable,
  onToggleChoose,
  dragAndDrop,
  ...actions
}: FilesGridProps) {
  const chosenKeysSet = new Set(chosenKeys);

  return (
    <section class='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6'>
      {items.map((item) => {
        const extension = getExtension(item.name);

        return (
          <article
            key={item.key}
            class={`relative flex flex-col overflow-hidden rounded-xl border bg-slate-700 hover:bg-slate-600 ${
              dragAndDrop?.dropTargetPath === item.fullPath
                ? 'border-accent outline outline-2 -outline-offset-2 outline-accent'
                : chosenKeysSet.has(item.key)
                ? 'border-accent'
                : 'border-slate-600'
            }`}
            {...dragAndDrop?.getItemDragProps(item)}
            {...(item.isDirectory && dragAndDrop ? dragAndDrop.getDropTargetProps(item.fullPath) : {})}
          >
            <a
              href={item.href}
              class='block'
              target={item.isDirectory ? undefined : '_blank'}
              rel={item.isDirectory ? undefined : 'noopener noreferrer'}
            >
              {/* Fixed aspect ratio so a slow thumbnail never shifts the grid */}
              <span class='flex aspect-square items-center justify-center bg-slate-900'>
                {isImage(item) && areThumbnailsAvailable
                  ? (
                    <img
                      src={`/files/thumbnail/${encodeURIComponent(item.name)}?path=${
                        encodeURIComponent(item.parentPath)
                      }&width=400&height=400`}
                      alt={item.name}
                      class='h-full w-full object-cover'
                      loading='lazy'
                      width={400}
                      height={400}
                    />
                  )
                  : (
                    <span class='flex flex-col items-center gap-1'>
                      <img
                        src={`/public/images/${item.isTrash ? 'trash' : item.isDirectory ? 'directory' : 'file'}.svg`}
                        alt={item.isDirectory ? 'Directory' : 'File'}
                        class='white opacity-80'
                        width={32}
                        height={32}
                      />
                      {!item.isDirectory && extension
                        ? <span class='text-xs uppercase text-slate-400'>{extension}</span>
                        : null}
                    </span>
                  )}
              </span>
            </a>

            <footer class='flex items-start gap-1 px-2 py-2'>
              <a
                href={item.href}
                class='min-w-0 flex-1 text-sm font-normal text-white'
                target={item.isDirectory ? undefined : '_blank'}
                rel={item.isDirectory ? undefined : 'noopener noreferrer'}
              >
                <span class='line-clamp-2 break-all'>{item.name}</span>
                <span class='block text-xs text-slate-400'>{humanFileSize(item.sizeInBytes)}</span>
              </a>

              {item.isTrash ? null : <FilesItemMenu item={item} {...actions} />}
            </footer>

            {isSelectable && !item.isTrash
              ? (
                <input
                  class='absolute left-2 top-2 h-4 w-4 cursor-pointer rounded border-slate-300 bg-slate-100 text-accent'
                  type='checkbox'
                  onClick={() => onToggleChoose?.(item)}
                  checked={chosenKeysSet.has(item.key)}
                  title={`Select ${item.name}`}
                />
              )
              : null}
          </article>
        );
      })}
    </section>
  );
}
