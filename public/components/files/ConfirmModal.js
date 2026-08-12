export default function ConfirmModal({
  state,
  onClose
}) {
  const isOpen = Boolean(state?.isOpen);
  return h(Fragment, null, h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-40 w-screen h-screen inset-0 bg-gray-900/60`
  }), h("section", {
    class: `fixed ${isOpen ? 'block' : 'hidden'} z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 max-w-[calc(100vw-2rem)] bg-slate-600 text-white rounded-xl px-8 py-6 drop-shadow-lg`,
    role: "dialog",
    "aria-modal": "true"
  }, h("h1", {
    class: "text-2xl font-semibold my-5"
  }, state?.title), h("p", {
    class: "py-5 my-2 border-y border-slate-500 text-slate-100"
  }, state?.message), h("footer", {
    class: "flex justify-between gap-3"
  }, h("button", {
    class: `min-h-11 px-5 py-2 cursor-pointer rounded-lg text-on-color ${state?.isDangerous ? 'bg-red-600 hover:bg-red-500' : 'bg-accent hover:bg-accent-hover'}`,
    onClick: () => state?.onConfirm(),
    type: "button"
  }, state?.confirmLabel), h("button", {
    class: "min-h-11 px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white cursor-pointer rounded-lg",
    onClick: () => onClose(),
    type: "button"
  }, "Cancel"))));
}