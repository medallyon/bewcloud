import { signal } from '@preact/signals';
const DEFAULT_DURATION_IN_MILLISECONDS = 5_000;
export const toasts = signal([]);
const timeouts = new Map();
let nextToastNumber = 0;
export function showToast({
  message,
  type = 'info',
  duration = DEFAULT_DURATION_IN_MILLISECONDS,
  id,
  action
}) {
  const toastId = id || `toast-${++nextToastNumber}`;
  const toast = {
    id: toastId,
    message,
    type,
    action
  };
  const existingIndex = toasts.value.findIndex(_toast => _toast.id === toastId);
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
export function dismissToast(id) {
  const timeout = timeouts.get(id);
  if (typeof timeout !== 'undefined') {
    clearTimeout(timeout);
    timeouts.delete(id);
  }
  toasts.value = toasts.value.filter(toast => toast.id !== id);
}