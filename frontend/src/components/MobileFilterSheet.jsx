// components/MobileFilterSheet.jsx

export default function MobileFilterSheet({
  show, onClose,
  priorityFilter, setPriorityFilter,
  dueDateFilter, setDueDateFilter,
  sortBy, setSortBy,
  darkMode,
}) {
  if (!show) return null;
  const dm = darkMode;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-stretch sm:justify-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full sm:w-[380px] sm:h-full max-h-[90vh] sm:max-h-none rounded-t-2xl sm:rounded-none sm:rounded-l-2xl shadow-2xl overflow-hidden flex flex-col ${dm ? "bg-gray-900" : "bg-white"}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className={`w-10 h-1 rounded-full ${dm ? "bg-gray-600" : "bg-gray-300"}`} />
        </div>

        <div className={`px-4 sm:px-5 py-3 sm:py-4 border-b flex items-center justify-between ${dm ? "border-gray-700" : "border-gray-100"}`}>
          <h3 className={`font-bold text-base sm:text-lg ${dm ? "text-gray-100" : "text-gray-800"}`}>Filters &amp; Sort</h3>
          <button onClick={onClose} className={`p-1.5 sm:p-2 rounded-lg transition-colors ${dm ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-5 sm:space-y-6">
          {/* Priority */}
          <div>
            <label className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-2 sm:mb-3 block ${dm ? "text-gray-400" : "text-gray-400"}`}>Priority</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "all",    label: "All",  icon: "●",  active: "bg-gray-700 text-white",   inactive: dm ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700" },
                { value: "high",   label: "High", icon: "🔴", active: "bg-red-600 text-white",     inactive: dm ? "bg-red-900/40 text-red-300" : "bg-red-50 text-gray-700" },
                { value: "medium", label: "Med",  icon: "🟡", active: "bg-yellow-500 text-white",  inactive: dm ? "bg-yellow-900/40 text-yellow-300" : "bg-yellow-50 text-gray-700" },
                { value: "low",    label: "Low",  icon: "🟢", active: "bg-green-600 text-white",   inactive: dm ? "bg-green-900/40 text-green-300" : "bg-green-50 text-gray-700" },
              ].map(({ value, label, icon, active, inactive }) => (
                <button key={value} onClick={() => setPriorityFilter(value)}
                  className={`flex flex-col items-center gap-1 py-3 sm:py-4 rounded-xl font-semibold transition-all text-xs sm:text-sm ${priorityFilter === value ? active : inactive}`}
                >
                  <span className="text-base sm:text-lg">{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-2 sm:mb-3 block ${dm ? "text-gray-400" : "text-gray-400"}`}>Due Date</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "all",      label: "All tasks",  icon: "📅", active: "bg-gray-700 text-white",      inactive: dm ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700" },
                { value: "overdue",  label: "Overdue",    icon: "🔥", active: "bg-red-600 text-white",        inactive: dm ? "bg-red-900/40 text-red-300" : "bg-red-50 text-gray-700" },
                { value: "today",    label: "Due Today",  icon: "⏰", active: "bg-orange-500 text-white",     inactive: dm ? "bg-orange-900/40 text-orange-300" : "bg-orange-50 text-gray-700" },
                { value: "upcoming", label: "Upcoming",   icon: "🗓️", active: "bg-blue-600 text-white",      inactive: dm ? "bg-blue-900/40 text-blue-300" : "bg-blue-50 text-gray-700" },
              ].map(({ value, label, icon, active, inactive }) => (
                <button key={value} onClick={() => setDueDateFilter(value)}
                  className={`flex items-center gap-2 px-3 py-3 sm:py-3.5 rounded-xl font-semibold transition-all text-sm ${dueDateFilter === value ? active : inactive}`}
                >
                  <span className="text-base">{icon}</span>{label}
                  {dueDateFilter === value && (
                    <svg className="w-3.5 h-3.5 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Sort By */}
          <div>
            <label className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-2 sm:mb-3 block ${dm ? "text-gray-400" : "text-gray-400"}`}>Sort By</label>
            <div className="grid grid-cols-1 gap-2">
              {[
                { value: "default",  label: "Default Order" },
                { value: "priority", label: "Priority (High → Low)" },
                { value: "dueDate",  label: "Due Date (Earliest First)" },
                { value: "title",    label: "Title (A → Z)" },
                { value: "created",  label: "Created (Newest First)" },
              ].map(({ value, label }) => (
                <button key={value} onClick={() => setSortBy(value)}
                  className={`flex items-center justify-between px-4 py-2.5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all ${
                    sortBy === value
                      ? "bg-indigo-600 text-white shadow-md"
                      : dm ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span>{label}</span>
                  {sortBy === value && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`p-4 sm:p-5 border-t ${dm ? "border-gray-700" : "border-gray-100"}`}>
          <button onClick={onClose} className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg text-sm sm:text-base">
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}