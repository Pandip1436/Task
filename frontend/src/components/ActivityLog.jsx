// components/ActivityLog.jsx
import { useState } from "react";

const ICONS = {
  move:   "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
  create: "M12 6v6m0 0v6m0-6h6m-6 0H6",
  delete: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  edit:   "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
};

const COLORS = {
  move:   "bg-blue-100 text-blue-600",
  create: "bg-green-100 text-green-600",
  delete: "bg-red-100 text-red-600",
  edit:   "bg-yellow-100 text-yellow-600",
};

export default function ActivityLog({ log, onClose, onClear, onDeleteEntry }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearingBusy, setClearingBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleClearConfirmed = async () => {
    setClearingBusy(true);
    try {
      await onClear();
      setConfirmClear(false);
    } finally {
      setClearingBusy(false);
    }
  };

  const handleDeleteConfirmed = async (entryId) => {
    setDeletingId(entryId);
    try {
      await onDeleteEntry(entryId);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] sm:max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 sm:px-5 py-3 sm:py-4">
          {confirmClear ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-white text-sm font-semibold">Clear all logs?</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearConfirmed}
                  disabled={clearingBusy}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5"
                >
                  {clearingBusy && (
                    <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  Yes, clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  disabled={clearingBusy}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Board Activity
                {log.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-white/25 rounded-full text-[10px] font-bold">{log.length}</span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {log.length > 0 && (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/15 hover:bg-red-500/80 border border-white/20 hover:border-red-400 rounded-lg transition-all text-white text-xs font-semibold"
                    title="Clear all activity logs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="hidden sm:inline">Clear all</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                  aria-label="Close activity log"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-3 sm:p-4">
          {log.length === 0 ? (
            <div className="text-center py-10 sm:py-12">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-400 text-sm">No activity yet</p>
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {log.map((entry) => (
                <div key={entry._id}>
                  <div className="group flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${COLORS[entry.type] ?? "bg-gray-100 text-gray-500"}`}>
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICONS[entry.type] ?? ICONS.edit} />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-gray-700">{entry.message}</p>
                      <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">
                        {entry._id?.startsWith?.("temp-")
                          ? "Saving…"
                          : new Date(entry.createdAt).toLocaleString()}
                      </p>
                      {entry.user?.name && (
                        <p className="text-[10px] text-gray-400">{entry.user.name}</p>
                      )}
                    </div>
                    {!entry._id?.startsWith?.("temp-") && (
                      <button
                        onClick={() => setConfirmDeleteId(entry._id)}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Delete this entry"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {confirmDeleteId === entry._id && (
                    <div className="mx-2.5 mb-1.5 flex items-center justify-between gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-xs text-red-700 font-medium">Delete this entry?</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDeleteConfirmed(entry._id)}
                          disabled={deletingId === entry._id}
                          className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1"
                        >
                          {deletingId === entry._id && (
                            <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deletingId === entry._id}
                          className="px-2.5 py-1 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}