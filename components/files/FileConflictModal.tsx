interface FileConflictModalProps {
  isOpen: boolean;
  existingFileName: string;
  onReplace: () => void;
  onSkip: () => void;
  onReplaceAll: () => void;
  onSkipAll: () => void;
  onAbort: () => void;
}

// Shown by useDragAndDropUpload when an uploaded file's name already exists at the target path.
export default function FileConflictModal(
  { isOpen, existingFileName, onReplace, onSkip, onReplaceAll, onSkipAll, onAbort }: FileConflictModalProps,
) {
  return (
    <>
      <section
        class={`fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900/60`}
      >
      </section>

      <section
        class={`fixed ${
          isOpen ? 'block' : 'hidden'
        } z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-600 text-white rounded-md px-8 py-6 drop-shadow-lg overflow-y-scroll max-h-[80%]`}
      >
        <h1 class='text-2xl font-semibold my-5'>File Already Exists</h1>
        <section class='py-5 my-2 border-y border-slate-500'>
          <p class='text-slate-300'>
            The file <strong class='text-white'>{existingFileName}</strong>{' '}
            already exists in this location. What would you like to do?
          </p>
        </section>
        <footer class='flex flex-wrap gap-2 justify-between items-center'>
          <div class='flex flex-wrap gap-2'>
            <button
              class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
              onClick={() => onReplace()}
              type='button'
            >
              Replace
            </button>
            <button
              class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
              onClick={() => onSkip()}
              type='button'
            >
              Skip
            </button>
            <button
              class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
              onClick={() => onReplaceAll()}
              type='button'
            >
              Replace All
            </button>
            <button
              class='px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-md'
              onClick={() => onSkipAll()}
              type='button'
            >
              Skip All
            </button>
          </div>
          <button
            class='px-5 py-2 bg-red-600 hover:bg-red-500 text-white cursor-pointer rounded-md'
            onClick={() => onAbort()}
            type='button'
          >
            Abort Upload
          </button>
        </footer>
      </section>
    </>
  );
}
