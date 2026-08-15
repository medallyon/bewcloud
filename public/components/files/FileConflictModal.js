export default function FileConflictModal({
  isOpen,
  existingFileName,
  onReplace,
  onSkip,
  onReplaceAll
}) {
  if (!isOpen) {
    return null;
  }
  return h("div", {
    class: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  }, h("div", {
    class: "bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
  }, h("h3", {
    class: "text-lg font-semibold mb-4 text-gray-900"
  }, "File Already Exists"), h("p", {
    class: "text-gray-600 mb-6"
  }, "The file ", h("strong", {
    class: "text-gray-900"
  }, existingFileName), ' ', "already exists in this location. What would you like to do?"), h("div", {
    class: "flex flex-col sm:flex-row gap-3"
  }, h("button", {
    onClick: onReplace,
    class: "flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors",
    type: "button"
  }, "Replace"), h("button", {
    onClick: onSkip,
    class: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors",
    type: "button"
  }, "Skip"), h("button", {
    onClick: onReplaceAll,
    class: "flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors",
    type: "button"
  }, "Replace All"))));
}