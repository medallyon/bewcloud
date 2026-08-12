import { signal } from '@preact/signals';

export type ToastType = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ShowToastOptions {
  message: string;
  type?: ToastType;
  /** Milliseconds until the toast removes itself. Pass 0 to keep it until dismissed. */
  duration?: number;
  /** Re-using an id replaces that toast in place instead of stacking a second one. */
  id?: string;
  action?: Toast['action'];
}

const DEFAULT_DURATION_IN_MILLISECONDS = 5_000;

// Module-level, and every island imports this same URL, so the browser's module cache keeps a single store shared across separately-hydrated islands
export const toasts = signal<Toast[]>([]);

// Deno types setTimeout's return as Timeout, the browser as number, so this holds whatever the runtime hands back
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

let nextToastNumber = 0;

export function showToast(
  { message, type = 'info', duration = DEFAULT_DURATION_IN_MILLISECONDS, id, action }: ShowToastOptions,
) {
  const toastId = id || `toast-${++nextToastNumber}`;
  const toast: Toast = { id: toastId, message, type, action };
  const existingIndex = toasts.value.findIndex((_toast) => _toast.id === toastId);

  if (existingIndex === -1) {
    toasts.value = [...toasts.value, toast];
  } else {
    const newToasts = [...toasts.value];
    newToasts[existingIndex] = toast;
    toasts.value = newToasts;
  }

  const existingTimeout = timeouts.get(toastId);

  if (typeof existingTimeout !== 'undefined') {
    clearTimeout(existingTimeout);
    timeouts.delete(toastId);
  }

  if (duration > 0) {
    timeouts.set(toastId, setTimeout(() => dismissToast(toastId), duration));
  }

  return toastId;
}

export function dismissToast(id: string) {
  const timeout = timeouts.get(id);

  if (typeof timeout !== 'undefined') {
    clearTimeout(timeout);
    timeouts.delete(id);
  }

  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}
