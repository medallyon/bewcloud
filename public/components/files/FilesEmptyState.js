export default function FilesEmptyState({
  itemPluralLabel,
  isTrash,
  onClickUpload
}) {
  return h("section", {
    class: "flex flex-col items-center gap-3 px-6 py-16 text-center"
  }, h("img", {
    src: "/public/images/directory.svg",
    alt: "",
    class: "white opacity-40",
    width: 40,
    height: 40
  }), h("p", {
    class: "text-slate-300"
  }, isTrash ? `Nothing in the trash — deleted ${itemPluralLabel} land here.` : `No ${itemPluralLabel} here yet.`), onClickUpload && !isTrash ? h("button", {
    class: "button",
    type: "button",
    onClick: onClickUpload
  }, "Upload ", itemPluralLabel) : null);
}