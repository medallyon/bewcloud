interface FilesEmptyStateProps {
  itemPluralLabel: string;
  isTrash?: boolean;
  onClickUpload?: () => void;
}

export default function FilesEmptyState({ itemPluralLabel, isTrash, onClickUpload }: FilesEmptyStateProps) {
  return (
    <section class='flex flex-col items-center gap-3 px-6 py-16 text-center'>
      <img src='/public/images/directory.svg' alt='' class='white opacity-40' width={40} height={40} />
      <p class='text-slate-300'>
        {isTrash ? `Nothing in the trash — deleted ${itemPluralLabel} land here.` : `No ${itemPluralLabel} here yet.`}
      </p>
      {onClickUpload && !isTrash
        ? (
          <button class='button' type='button' onClick={onClickUpload}>
            Upload {itemPluralLabel}
          </button>
        )
        : null}
    </section>
  );
}
