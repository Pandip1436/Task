// components/DeleteColumnModal.jsx

export default function DeleteColumnModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl shadow-2xl p-6">
        <h2 className="text-lg font-semibold text-white">
          Delete Column Permanently?
        </h2>
        <p className="text-gray-400 mt-3 text-sm leading-relaxed">
          Delete this column and all its tasks?
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition shadow-lg"
          >
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
}