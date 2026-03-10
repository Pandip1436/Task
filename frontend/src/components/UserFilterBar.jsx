export default function UserFilterBar({
  availableUsers,
  selectedUserFilter,
  onFilterChange,
  tasks,
}) {
  const getUserInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getTotalTaskCount = () => {
    return Object.values(tasks).reduce(
      (sum, taskList) => sum + taskList.length,
      0
    );
  };

  const getUserTaskCount = (userId) => {
    return Object.values(tasks).reduce((sum, taskList) => {
      return (
        sum +
        taskList.filter((task) => task.assignedTo?.some((u) => u._id === userId))
          .length
      );
    }, 0);
  };

  if (availableUsers.length === 0) {
    return null;
  }

  return (
    <div className="max-w-[2000px] mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
      <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/50 p-3 sm:p-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Header */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <span className="text-xs sm:text-sm font-semibold text-gray-700">
                Filter by User:
              </span>
            </div>

            {/* Clear Filter Button - Mobile (Top Right) */}
            {selectedUserFilter !== "all" && (
              <button
                onClick={() => onFilterChange("all")}
                className="sm:hidden flex items-center gap-1.5 px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-all text-xs"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Clear
              </button>
            )}
          </div>

          {/* Filter Buttons Container */}
          <div className="flex flex-col sm:flex-row sm:flex-1 gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* All Tasks Button */}
              <button
                onClick={() => onFilterChange("all")}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-sm flex-1 sm:flex-initial justify-center sm:justify-start ${
                  selectedUserFilter === "all"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <svg
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span className="hidden xs:inline">All Tasks</span>
                <span className="xs:hidden">All</span>
                <span className="px-1.5 sm:px-2 py-0.5 bg-white/20 rounded-full text-[10px] sm:text-xs">
                  {getTotalTaskCount()}
                </span>
              </button>

              {/* User Filter Buttons */}
              {availableUsers.map((user) => {
                const userTaskCount = getUserTaskCount(user._id);

                return (
                  <button
                    key={user._id}
                    onClick={() => onFilterChange(user._id)}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-sm flex-1 sm:flex-initial justify-center sm:justify-start min-w-0 ${
                      selectedUserFilter === user._id
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-[10px] sm:text-xs flex-shrink-0">
                      {getUserInitials(user.name)}
                    </div>
                    <span className="truncate">{user.name}</span>
                    <span className="px-1.5 sm:px-2 py-0.5 bg-white/20 rounded-full text-[10px] sm:text-xs flex-shrink-0">
                      {userTaskCount}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Clear Filter Button - Desktop */}
            {selectedUserFilter !== "all" && (
              <button
                onClick={() => onFilterChange("all")}
                className="hidden sm:flex items-center gap-2 ml-auto px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-all text-sm"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}