import { dismissToast, toasts } from '/public/ts/utils/toast.ts';

const toastClassPerType = new Map<string, string>([
  ['info', 'bg-slate-700 border-slate-500 text-white'],
  ['success', 'bg-green-600 border-green-500 text-on-color'],
  ['error', 'bg-red-700 border-red-500 text-on-color'],
]);

export default function ToastHost() {
  return (
    <>
      {toasts.value.map((toast) => (
        <section
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : undefined}
          class={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
            toastClassPerType.get(toast.type)
          }`}
        >
          <span class='flex-1'>{toast.message}</span>
          {toast.action
            ? (
              <button
                type='button'
                class='min-h-11 font-semibold underline'
                onClick={() => {
                  toast.action!.onClick();
                  dismissToast(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )
            : null}
          <button
            type='button'
            class='min-h-11 min-w-11 opacity-70 hover:opacity-100'
            title='Dismiss'
            aria-label='Dismiss'
            onClick={() => dismissToast(toast.id)}
          >
            ✕
          </button>
        </section>
      ))}
    </>
  );
}
