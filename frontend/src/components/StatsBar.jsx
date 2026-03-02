// components/StatsBar.jsx
import { useMemo } from "react";

export default function StatsBar({ tasks, columns, darkMode }) {
  const allTasks = useMemo(() => Object.values(tasks).flat(), [tasks]);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const stats = useMemo(() => {
    const todoCol = columns.find(c =>
      c.name?.toLowerCase().includes('to do') ||
      c.name?.toLowerCase().includes('todo') ||
      c.name?.toLowerCase() === 'backlog'
    );
    const inProgressCol = columns.find(c =>
      c.name?.toLowerCase().includes('in progress') ||
      c.name?.toLowerCase().includes('doing') ||
      c.name?.toLowerCase().includes('wip')
    );
    const doneCol = columns.find(c =>
      c.name?.toLowerCase().includes('done') ||
      c.name?.toLowerCase().includes('complete') ||
      c.name?.toLowerCase().includes('finished')
    );

    return {
      total:      allTasks.length,
      todo:       todoCol ? (tasks[todoCol._id] || []).length : 0,
      inProgress: inProgressCol ? (tasks[inProgressCol._id] || []).length : 0,
      done:       doneCol ? (tasks[doneCol._id] || []).length : 0,
      high:       allTasks.filter(t => t.priority === "high").length,
      medium:     allTasks.filter(t => t.priority === "medium").length,
      low:        allTasks.filter(t => t.priority === "low").length,
      overdue:    allTasks.filter(t => t.dueDate && new Date(t.dueDate) < today).length,
    };
  }, [allTasks, tasks, columns]);

  const items = [
    { label: "Total Tasks", value: stats.total,      color: "from-indigo-500 to-purple-500",   icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { label: "To Do",       value: stats.todo,       color: "from-blue-400 to-cyan-500",       icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
    { label: "In Progress", value: stats.inProgress, color: "from-yellow-400 to-orange-500",   icon: "M13 10V3L4 14h7v7l9-11h-7z" },
    { label: "Done",        value: stats.done,       color: "from-green-500 to-emerald-600",   icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
    { label: "High",        value: stats.high,       color: "from-red-500 to-rose-600",        icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
    { label: "Medium",      value: stats.medium,     color: "from-amber-400 to-yellow-500",    icon: "M13 10V3L4 14h7v7l9-11h-7z" },
    { label: "Low",         value: stats.low,        color: "from-emerald-400 to-teal-500",    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
    { label: "Overdue",     value: stats.overdue,    color: "from-orange-500 to-red-600",      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  ];

  return (
    <div className="max-w-[2000px] mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3">
      <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 sm:grid sm:grid-cols-4 md:grid-cols-8 sm:gap-3 scrollbar-none">
        {items.map(({ label, value, color, icon }) => (
          <div
            key={label}
            className={`backdrop-blur-sm rounded-xl sm:rounded-2xl p-2.5 sm:p-3 lg:p-4 border shadow-md flex items-center gap-2 sm:gap-3 flex-shrink-0 min-w-[110px] sm:min-w-0 transition-colors duration-300 ${darkMode ? "bg-gray-800/70 border-gray-700/50" : "bg-white/70 border-white/50"}`}
          >
            <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
              </svg>
            </div>
            <div className="min-w-0">
              <p className={`text-lg sm:text-xl md:text-2xl font-bold leading-none ${darkMode ? "text-gray-100" : "text-gray-800"}`}>{value}</p>
              <p className={`text-[9px] sm:text-[10px] md:text-xs font-medium mt-0.5 truncate ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}