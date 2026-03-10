/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, TouchSensor,
  useSensor, useSensors, closestCorners, defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import {
  getColumnsByBoard, createColumn, updateColumn, deleteColumn,
} from "../services/column.service";
import {
  getTasksByColumn, createTask, updateTask, deleteTask,
} from "../services/task.service";
import { getBoard, getBoardsByProject } from "../services/board.service";
import { createActivityLog, getActivityLogs, clearBoardActivityLogs, deleteActivityLog } from "../services/activity.service";


import TaskModal     from "../components/TaskModal";
import KanbanColumn, { SortableTaskCard } from "../components/KanbanColumn";
import { useBoardSocket } from "../hooks/useBoardSocket";

// ─── DragOverlay ghost card ───────────────────────────────────────────────────
function OverlayCard({ task }) {
  if (!task) return null;
  return (
    <div
      className="bg-white rounded-xl border-2 border-indigo-400 shadow-2xl p-3 sm:p-4 w-[240px] sm:w-[280px] lg:w-[320px] rotate-2 opacity-95 cursor-grabbing"
      style={{ boxShadow: "0 24px 48px -8px rgba(99,102,241,0.4), 0 8px 20px -4px rgba(0,0,0,0.2)" }}
    >
      <p className="text-gray-800 font-semibold text-xs sm:text-sm lg:text-base leading-snug mb-1">{task.title}</p>
      {task.description && <p className="text-gray-400 text-xs line-clamp-1 mb-2">{task.description}</p>}
      {task.priority && (
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold ${
          task.priority === "high" ? "bg-red-100 text-red-700" :
          task.priority === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
        }`}>
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
      )}
    </div>
  );
}

const DROP_ANIMATION = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }),
};

// ─── Board Switcher ───────────────────────────────────────────────────────────
function BoardSwitcher({ currentBoardId, darkMode, projectId }) {
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [currentBoardName, setCurrentBoardName] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  // Step 1: fetch current board to get its name + projectId
  // Step 2: fetch all sibling boards in that project
  useEffect(() => {
    if (!currentBoardId) return;
    setLoading(true);
    setCurrentBoardName("");
    setBoards([]);
    getBoard(currentBoardId)
      .then(res => {
        const board = res.data;
        // Store the name directly so we always have it
        setCurrentBoardName(board?.name || "");
        const projectId = board?.project?._id || board?.project;
        if (!projectId) return Promise.reject("no project");
        return getBoardsByProject(projectId);
      })
      .then(res => setBoards(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentBoardId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  // Use direct name from getBoard, fallback to finding it in the boards list
  const displayName = currentBoardName || boards.find(b => b._id === currentBoardId)?.name || "Board";

  const switchTo = (id) => {
    setOpen(false);
    navigate(`/boards/${id}`);
  };

  return (
    <div className="relative flex-shrink-0"  ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        disabled={loading || boards.length < 2}
        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border font-semibold text-xs sm:text-sm transition-all shadow-sm select-none ${
          darkMode
            ? "bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700 disabled:opacity-40"
            : "bg-white/80 border-gray-200 text-gray-700 hover:bg-white disabled:opacity-40"
        } ${open ? (darkMode ? "ring-2 ring-indigo-500" : "ring-2 ring-indigo-300") : ""}`}
        title="Switch board"
        aria-label="Switch board"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {/* Board grid icon */}
        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>

        {/* Current board name — truncated */}
        <span className="max-w-[80px] sm:max-w-[120px] md:max-w-[160px] truncate ">
          {loading ? "Loading…" : displayName}
        </span>

        {/* Chevron */}
        {boards.length >= 2 && (
          <svg
            className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""} ${darkMode ? "text-gray-400" : "text-gray-400"}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {open && boards.length >= 2 && (
        <div
          className={`absolute left-0 top-full mt-2 z-50 min-w-[200px] sm:min-w-[240px] max-w-xs rounded-2xl border shadow-2xl overflow-hidden ${
            darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          }`}
          role="listbox"
          aria-label="Select a board"
        >
          {/* Header */}
          <div className={`px-3 py-2.5 border-b text-[11px] font-bold uppercase tracking-wider ${
            darkMode ? "border-gray-700 text-gray-400 bg-gray-900/50" : "border-gray-100 text-gray-400 bg-gray-50/80"
          }`}>
            Switch Board
          </div>

          {/* Board list */}
          <ul className="max-h-64 overflow-y-auto py-1.5">
            {boards.map(board => {
              const isCurrent = board._id === currentBoardId;
              return (
                <li key={board._id}>
                  <button
                    onClick={() => !isCurrent && switchTo(board._id)}
                    role="option"
                    aria-selected={isCurrent}
                    disabled={isCurrent}
                    className={`w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-left transition-colors text-sm font-medium ${
                      isCurrent
                        ? darkMode
                          ? "bg-indigo-900/40 text-indigo-300 cursor-default"
                          : "bg-indigo-50 text-indigo-700 cursor-default"
                        : darkMode
                          ? "text-gray-200 hover:bg-gray-700 cursor-pointer"
                          : "text-gray-700 hover:bg-gray-50 cursor-pointer"
                    }`}
                  >
                    {/* Color dot / initial avatar */}
                    <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm ${
                      isCurrent
                        ? "bg-gradient-to-br from-indigo-500 to-purple-600"
                        : "bg-gradient-to-br from-gray-400 to-gray-500"
                    }`}>
                      {board.name?.trim()[0]?.toUpperCase() || "B"}
                    </span>

                    <span className="flex-1 min-w-0 truncate">{board.name}</span>

                    {isCurrent && (
                      <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        darkMode ? "bg-indigo-700/60 text-indigo-300" : "bg-indigo-100 text-indigo-600"
                      }`}>
                        Current
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Footer — all boards link */}
          <div className={`border-t ${darkMode ? "border-gray-700" : "border-gray-100"}`}>
            <button
              onClick={() => { setOpen(false); navigate(projectId ? `/projects/${projectId}` : "/"); }}
              className={`w-full flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs font-semibold transition-colors ${
                darkMode ? "text-gray-400 hover:text-indigo-400 hover:bg-gray-700/50" : "text-gray-400 hover:text-indigo-600 hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              View all boards
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({ tasks, columns, darkMode }) {
  const allTasks = useMemo(() => Object.values(tasks).flat(), [tasks]);
  const today = new Date(); today.setHours(0,0,0,0);

  const stats = useMemo(() => {
    // Find column IDs by common naming patterns
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
// ─── Activity Log ─────────────────────────────────────────────────────────────
function ActivityLog({ log, onClose, onClear, onDeleteEntry }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearingBusy, setClearingBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null); 
  const [deletingId, setDeletingId] = useState(null);

  const icons = {
    move:   "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
    create: "M12 6v6m0 0v6m0-6h6m-6 0H6",
    delete: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    edit:   "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  };
  const colors = {
    move:   "bg-blue-100 text-blue-600",
    create: "bg-green-100 text-green-600",
    delete: "bg-red-100 text-red-600",
    edit:   "bg-yellow-100 text-yellow-600",
  };

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

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 sm:px-5 py-3 sm:py-4">
          {confirmClear ? (
            /* Inline clear confirmation — replaces normal header row */
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
            /* Normal header row */
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

        {/* ── Body ── */}
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
                  {/* Normal entry row */}
                  <div className="group flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[entry.type] ?? "bg-gray-100 text-gray-500"}`}>
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icons[entry.type] ?? icons.edit} />
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
                    {/* Delete button — visible on hover, hidden for temp entries */}
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

                  {/* Inline delete confirmation — slides in below the entry */}
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



// ─── Mobile Filter Sheet ──────────────────────────────────────────────────────
function MobileFilterSheet({
  show, onClose,
  priorityFilter, setPriorityFilter,
  dueDateFilter, setDueDateFilter,
  sortBy, setSortBy,
  darkMode,
}) {
  if (!show) return null;
  const dm = darkMode;
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-stretch sm:justify-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
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

          <div>
            <label className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-2 sm:mb-3 block ${dm ? "text-gray-400" : "text-gray-400"}`}>Due Date</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "all",      label: "All tasks",    icon: "📅", active: "bg-gray-700 text-white",      inactive: dm ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700" },
                { value: "overdue",  label: "Overdue",      icon: "🔥", active: "bg-red-600 text-white",        inactive: dm ? "bg-red-900/40 text-red-300" : "bg-red-50 text-gray-700" },
                { value: "today",    label: "Due Today",    icon: "⏰", active: "bg-orange-500 text-white",     inactive: dm ? "bg-orange-900/40 text-orange-300" : "bg-orange-50 text-gray-700" },
                { value: "upcoming", label: "Upcoming",     icon: "🗓️", active: "bg-blue-600 text-white",      inactive: dm ? "bg-blue-900/40 text-blue-300" : "bg-blue-50 text-gray-700" },
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

// ─── Main TasksPage ───────────────────────────────────────────────────────────
export default function TasksPage() {
  const { boardId } = useParams();
  const navigate    = useNavigate();

  const [columns,   setColumns]   = useState([]);
  const [tasks,     setTasks]     = useState({});
  const [newColumn, setNewColumn] = useState("");
  const [newTask,   setNewTask]   = useState({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [modalTask, setModalTask] = useState(null);
  const [projectId, setProjectId] = useState(null);

  // Filter / search
  const [selectedUserFilter, setSelectedUserFilter] = useState("all");
  const [availableUsers,     setAvailableUsers]     = useState([]);
  const [searchQuery,        setSearchQuery]        = useState("");
  const [priorityFilter,     setPriorityFilter]     = useState("all");
  const [dueDateFilter,      setDueDateFilter]      = useState("all");
  const [sortBy,             setSortBy]             = useState("default");

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("kanban_dark") === "true"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("kanban_dark", darkMode); } catch { /* empty */ }
  }, [darkMode]);

  // UI panels
  const [showActivityLog,   setShowActivityLog]   = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showAddColumn,     setShowAddColumn]     = useState(false);
  const [collapsedColumns,  setCollapsedColumns]  = useState(new Set());
  const [deleteColumnId, setDeleteColumnId] = useState(null);

  // Activity log
  const [activityLog, setActivityLog] = useState([]);
 useBoardSocket(boardId, setTasks, setColumns, setModalTask, setActivityLog, navigate);

// Replace logActivity function with:
const logActivity = useCallback(async (type, message, entityType = null, entityId = null) => {
  // Optimistic entry for the local client only
  const tempId = `temp-${Date.now()}`;
  const tempEntry = {
    _id:       tempId,
    type,
    message,
    createdAt: new Date().toISOString(),
    user:      JSON.parse(localStorage.getItem("user") || "{}"),
  };

  // Add immediately for the user performing the action
  setActivityLog(prev => [tempEntry, ...prev]);

  try {
    const response = await createActivityLog({ boardId, type, message, entityType, entityId });
    const saved = response.data;

    // Swap the temp entry for the real persisted one
    setActivityLog(prev => prev.map(e => e._id === tempId ? saved : e));

    // Other clients will receive "activity:created" via socket and add it
    // themselves — they never see the temp entry, so no deduplication needed
    // on their side.
  } catch (err) {
    console.error("Failed to log activity:", err);
    // Remove the temp entry if the save failed
    setActivityLog(prev => prev.filter(e => e._id !== tempId));
  }
}, [boardId]);

// Add effect to load logs on mount
useEffect(() => {
  const loadActivityLogs = async () => {
    try {
      const response = await getActivityLogs(boardId);
      setActivityLog(response.data);
    } catch (error) {
      console.error("Failed to load activity logs:", error);
    }
  };
  
  if (boardId) {
    loadActivityLogs();
  }
}, [boardId]);

  // dnd-kit
  const [activeTask,  setActiveTask]  = useState(null);
  const [activeColId, setActiveColId] = useState(null);
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // Auth guard
  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/login");
  }, [navigate]);

  // Load board data (also fetches projectId for back navigation)
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Grab projectId from the board if we don't have it yet
      if (!projectId) {
        getBoard(boardId)
          .then(res => {
            const pid = res.data?.project?._id || res.data?.project;
            if (pid) setProjectId(pid);
          })
          .catch(() => {});
      }
      const colRes  = await getColumnsByBoard(boardId);
      setColumns(colRes.data);
      const results = await Promise.all(
        colRes.data.map(col => getTasksByColumn(col._id).then(res => ({ id: col._id, data: res.data })))
      );
      const map = {};
      results.forEach(({ id, data }) => { map[id] = data; });
      setTasks(map);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token"); localStorage.removeItem("user");
        navigate("/login"); return;
      }
      setError(err.message || "Failed to load board data");
    } finally {
      setLoading(false);
    }
  }, [boardId, navigate]);

  useEffect(() => { load(); }, [load]);

  // Reset filters when board changes
  useEffect(() => {
    setSearchQuery("");
    setPriorityFilter("all");
    setDueDateFilter("all");
    setSortBy("default");
    setSelectedUserFilter("all");
    setCollapsedColumns(new Set());
    setActivityLog([]);
  }, [boardId]);

  // Derive available users
  useEffect(() => {
    const map = new Map();
    Object.values(tasks).forEach(list =>
      list.forEach(t => t.assignedTo?.forEach(u => { if (u?._id) map.set(u._id, u); }))
    );
    setAvailableUsers([...map.values()]);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor,  { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,    { activationConstraint: { delay: 250, tolerance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findColumnOfTask = useCallback((taskId) => {
    const entry = Object.entries(tasksRef.current).find(([, list]) => list.some(t => t._id === taskId));
    return entry ? entry[0] : null;
  }, []);

  const handleDragStart = useCallback(({ active }) => {
    const data = active.data.current;
    if (data?.type === "task") {
      setActiveTask(data.task);
      setActiveColId(data.columnId ?? findColumnOfTask(active.id));
    }
  }, [findColumnOfTask]);

  const handleDragOver = useCallback(({ active, over }) => {
    if (!over || active.id === over.id) return;
    const srcColId  = findColumnOfTask(active.id);
    const overData  = over.data.current;
    const destColId = overData?.type === "column" ? over.id : findColumnOfTask(over.id);
    if (!srcColId || !destColId) return;
    setTasks(prev => {
      const srcList  = [...(prev[srcColId]  || [])];
      const destList = srcColId === destColId ? srcList : [...(prev[destColId] || [])];
      const srcIdx   = srcList.findIndex(t  => t._id === active.id);
      const overIdx  = destList.findIndex(t => t._id === over.id);
      if (srcIdx === -1) return prev;
      if (srcColId === destColId) {
        if (overIdx === -1) return prev;
        return { ...prev, [srcColId]: arrayMove(srcList, srcIdx, overIdx) };
      }
      const [movedTask] = srcList.splice(srcIdx, 1);
      const insertAt = overIdx === -1 ? destList.length : overIdx;
      destList.splice(insertAt, 0, { ...movedTask, column: destColId });
      return { ...prev, [srcColId]: srcList, [destColId]: destList };
    });
  }, [findColumnOfTask]);

  const handleDragEnd = useCallback(async ({ active, over }) => {
    const srcColId  = activeColId;
    const taskTitle = activeTask?.title || "Task";
    setActiveTask(null);
    setActiveColId(null);
    if (!over) return;
    const overData  = over.data.current;
    const destColId = overData?.type === "column" ? over.id : findColumnOfTask(active.id);
    if (!srcColId || !destColId || srcColId === destColId) return;
    const destColName = columns.find(c => c._id === destColId)?.name || "column";
    logActivity("move", `"${taskTitle}" moved to ${destColName}`);
    try {
      await updateTask(active.id, { columnId: destColId });
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      setError("Failed to move task — reverting changes");
      load();
    }
  }, [activeColId, activeTask, columns, findColumnOfTask, load, logActivity, navigate]);

  // Column management
const addColumn = async () => {
  if (!newColumn.trim()) return;

  try {
    const res = await createColumn({ name: newColumn, boardId });

    const createdColumn = res.data; 

  
    setColumns(prev => [...prev, createdColumn]);

    logActivity("create", `Column "${newColumn}" created`);

    setNewColumn("");
    setShowAddColumn(false);

  } catch (err) {
    if (err.response?.status === 401) {
      navigate("/login");
      return;
    }
    setError("Failed to add column");
  }
};

  const handleEditColumn = (columnId, editName = null, save = false) => {
    if (save) {
      const col = columns.find(c => c._id === columnId);
      if (!col?.editName) return;
      updateColumn(columnId, { name: col.editName })
        .then(() => {
          logActivity("edit", `Column renamed to "${col.editName}"`);
          setColumns(cs => cs.map(c => c._id === columnId
            ? { ...c, name: c.editName, isEditing: false, editName: "" } : c));
        })
        .catch(err => {
          if (err.response?.status === 401) { navigate("/login"); return; }
          setError("Failed to update column");
        });
    } else if (editName !== null) {
      setColumns(cs => cs.map(c => c._id === columnId ? { ...c, editName } : c));
    } else {
      setColumns(cs => cs.map(c => c._id === columnId ? { ...c, isEditing: true, editName: c.name } : c));
    }
  };

 const handleDeleteColumn = (columnId) => {
  setDeleteColumnId(columnId);
};
const confirmDeleteColumn = async () => {
  const colName =
    columns.find(c => c._id === deleteColumnId)?.name || "column";

  try {
    await deleteColumn(deleteColumnId);

    setColumns(prev => prev.filter(c => c._id !== deleteColumnId));

    setTasks(prev => {
      const updated = { ...prev };
      delete updated[deleteColumnId];
      return updated;
    });

    logActivity("delete", `Column "${colName}" deleted`);

  } catch (err) {
    if (err.response?.status === 401) {
      navigate("/login");
      return;
    }
    setError("Failed to delete column");
  }

  setDeleteColumnId(null);
};

  const toggleCollapseColumn = (columnId) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  };

  // Task management
 const addTask = async (columnId) => {
  if (!newTask[columnId]?.trim()) return;

  const title = newTask[columnId];

  try {
    const res = await createTask({ title, columnId, boardId });

    const createdTask = res.data; 
    setTasks(prev => ({
      ...prev,
      [columnId]: [...(prev[columnId] || []), createdTask]
    }));

    logActivity("create", `Task "${title}" created`);
    setNewTask(prev => ({ ...prev, [columnId]: "" }));
  } catch (err) {
    if (err.response?.status === 401) {
      navigate("/login");
      return;
    }
    setError("Failed to add task");
  }
};

 const handleDeleteTask = async (taskId) => {
  const taskTitle =
    Object.values(tasks)
      .flat()
      .find(t => t._id === taskId)?.title || "Task";
  try {
    await deleteTask(taskId);
    setTasks(prev => {
      const updated = {};
      for (const columnId in prev) {
        updated[columnId] = prev[columnId].filter(
          task => task._id !== taskId
        );
      }
      return updated;
    });
    logActivity("delete", `Task "${taskTitle}" deleted`);
  } catch (err) {
    if (err.response?.status === 401) {
      navigate("/login");
      return;
    }
    setError("Failed to delete task");
  }
};
  const handleClearActivity = useCallback(async () => {
  try {
    await clearBoardActivityLogs(boardId);
    setActivityLog([]);
  } catch (err) {
    setError("Failed to clear activity logs");
  }
}, [boardId]);

const handleDeleteActivityEntry = useCallback(async (logId) => {
  try {
    await deleteActivityLog(logId);
    setActivityLog(prev => prev.filter(e => e._id !== logId));
    // Other clients notified via socket — see backend patch
  } catch (err) {
    setError("Failed to delete activity entry");
  }
}, []);



  const handleKeyPress = (e, action) => { if (e.key === "Enter") action(); };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (priorityFilter !== "all")  count++;
    if (sortBy !== "default")      count++;
    if (dueDateFilter !== "all")   count++;
    return count;
  }, [priorityFilter, sortBy, dueDateFilter]);

  const filterTasks = useCallback((taskList) => {
    let list = [...taskList];
    if (selectedUserFilter !== "all") {
      list = list.filter(t => t.assignedTo?.some(u => u._id === selectedUserFilter));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
      );
    }
    if (priorityFilter !== "all") {
      list = list.filter(t => t.priority === priorityFilter);
    }
    if (dueDateFilter !== "all") {
      const now   = new Date();
      const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
      const todayEnd   = new Date(now); todayEnd.setHours(23,59,59,999);
      if (dueDateFilter === "overdue") {
        list = list.filter(t => t.dueDate && new Date(t.dueDate) < todayStart);
      } else if (dueDateFilter === "today") {
        list = list.filter(t => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd);
      } else if (dueDateFilter === "upcoming") {
        list = list.filter(t => t.dueDate && new Date(t.dueDate) > todayEnd);
      }
    }
    const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, undefined: 3 };
    if (sortBy === "priority") {
      list.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));
    } else if (sortBy === "dueDate") {
      list.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    } else if (sortBy === "title") {
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortBy === "created") {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    return list;
  }, [selectedUserFilter, searchQuery, priorityFilter, dueDateFilter, sortBy]);

  const totalSearchMatches = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    return Object.values(tasks).flat().filter(t =>
      t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ).length;
  }, [tasks, searchQuery]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${darkMode ? "bg-gray-900" : "bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50"}`}>
        <div className="text-center">
          <div className={`inline-block animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 border-4 mb-4 ${darkMode ? "border-gray-700 border-t-indigo-400" : "border-indigo-200 border-t-indigo-600"}`} />
          <p className={`text-lg sm:text-xl md:text-2xl font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>Loading your board…</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={`min-h-screen transition-colors duration-300 ${darkMode ? "bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950" : "bg-gradient-to-br from-indigo-300 via-purple-300 to-pink-300"}`}>

        {/* ══════════════════════════════════════════════════════════════
            HEADER
            ══════════════════════════════════════════════════════════════ */}
        <div className={`sticky top-0 z-20 backdrop-blur-xl border-b shadow-lg transition-colors duration-300 ${darkMode ? "bg-gray-900/80 border-gray-700/50" : "bg-white/70 border-gray-200/50"}`}>
          <div className="max-w-[2000px] mx-auto px-3 sm:px-5 md:px-6 lg:px-8 py-3 md:py-4">
            <div className="flex items-center justify-between gap-2 md:gap-4">

              {/* Left: back + board switcher + title */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Back button */}
                <button
                  onClick={() => navigate(projectId ? `/projects/${projectId}` : -1)}
                  className={`group flex items-center gap-1.5 transition-all duration-200 flex-shrink-0 ${darkMode ? "text-gray-400 hover:text-indigo-400" : "text-gray-600 hover:text-indigo-600"}`}
                  aria-label="Go back"
                >
                  <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="font-medium hidden sm:inline text-sm">Go To Boards</span>
                </button>

                <div className={`h-5 sm:h-7 md:h-8 w-px flex-shrink-0 ${darkMode ? "bg-gray-600" : "bg-gray-300"}`} />

                {/* ── Board Switcher ── */}
                <BoardSwitcher currentBoardId={boardId} darkMode={darkMode} projectId={projectId} />

                {/* Subtitle — hidden on xs, shown sm+ */}
                <p className={`text-[10px] sm:text-xs hidden md:block flex-shrink-0 ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                  Drag &amp; drop · click to edit
                </p>
              </div>

              {/* Right: action buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
                {/* Dragging indicator */}
                {activeTask && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-100 rounded-xl border border-indigo-200 animate-pulse">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span className="text-xs font-semibold text-indigo-700 hidden md:inline">Moving…</span>
                  </div>
                )}

                {/* Dark mode toggle */}
                <button
                  onClick={() => setDarkMode(d => !d)}
                  className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl border transition-all shadow-sm ${
                    darkMode
                      ? "bg-gray-800 border-gray-600 text-yellow-400 hover:bg-gray-700"
                      : "bg-white/70 border-gray-200 text-gray-600 hover:bg-white"
                  }`}
                  title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.592-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.592z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Mobile filter button */}
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className={`relative md:hidden flex items-center gap-1 px-2.5 py-2 rounded-xl border transition-all shadow-sm ${darkMode ? "bg-gray-800 border-gray-600 text-gray-300" : "bg-white/70 border-gray-200 text-gray-600 hover:bg-white"}`}
                  aria-label="Filters"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <span className="hidden sm:inline text-sm font-medium">Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-indigo-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* Activity log button */}
                <button
                  onClick={() => setShowActivityLog(true)}
                  className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 md:px-4 py-2 md:py-2 rounded-xl border transition-all text-sm font-medium shadow-sm ${darkMode ? "bg-gray-800 border-gray-600 text-gray-300 hover:text-indigo-400" : "bg-white/70 border-gray-200 text-gray-600 hover:text-indigo-600 hover:bg-white"}`}
                  title="Activity Log"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden sm:inline">Activity</span>
                  {activityLog.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-indigo-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {activityLog.length > 99 ? "99+" : activityLog.length}
                    </span>
                  )}
                </button>

                {/* Mobile add column button */}
                <button
                  onClick={() => setShowAddColumn(v => !v)}
                  className="sm:hidden flex items-center gap-1 px-2.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl shadow-sm text-sm font-semibold"
                  aria-label="Add column"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>

                {/* Columns count badge */}
                <div className={`hidden sm:block px-3 md:px-4 py-1.5 rounded-xl border ${darkMode ? "bg-gray-800/60 border-gray-600 text-gray-300" : "bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-200/50 text-gray-700"}`}>
                  <span className="text-xs sm:text-sm font-medium">
                    {columns.length} {columns.length === 1 ? "Column" : "Columns"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="max-w-[2000px] mx-auto px-3 sm:px-6 lg:px-8 mt-3">
            <div className={`border-l-4 border-red-500 rounded-r-xl p-3 sm:p-4 flex items-start justify-between shadow-sm ${darkMode ? "bg-red-900/30" : "bg-red-50"}`}>
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className={`text-xs sm:text-sm ${darkMode ? "text-red-300" : "text-red-700"}`}>{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0 ml-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Stats bar ── */}
        <StatsBar tasks={tasks} columns={columns} darkMode={darkMode} />

        {/* ── Desktop filter bar ── */}
        <div className="hidden md:block max-w-[2000px] mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-4">
          <div className={`backdrop-blur-xl rounded-2xl border shadow-xl p-3 sm:p-4 transition-colors duration-300 ${darkMode ? "bg-gray-800/80 border-gray-700/60" : "bg-white/90 border-gray-200/60"}`}>

            <div className="flex gap-3 mb-3">
              <div className="relative flex-1">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search tasks by title or description…"
                  className={`w-full border-2 focus:border-indigo-400 pl-11 sm:pl-12 pr-10 py-2.5 sm:py-3 rounded-xl outline-none transition-all text-sm placeholder-gray-400 font-medium shadow-sm ${darkMode ? "bg-gray-700/80 border-gray-600 text-gray-100 focus:bg-gray-700" : "bg-gray-50/80 border-gray-200/80 focus:bg-white text-gray-800"}`}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 transition-colors group">
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCollapsedColumns(new Set(columns.map(c => c._id)))}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-3 border rounded-xl font-semibold transition-all text-xs sm:text-sm shadow-sm ${darkMode ? "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600" : "bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 border-gray-200 text-gray-700"}`}
                  title="Collapse all columns"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  <span className="hidden lg:inline">Collapse</span>
                </button>
                <button
                  onClick={() => setCollapsedColumns(new Set())}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-3 border rounded-xl font-semibold transition-all text-xs sm:text-sm shadow-sm ${darkMode ? "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600" : "bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 border-gray-200 text-gray-700"}`}
                  title="Expand all columns"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <span className="hidden lg:inline">Expand</span>
                </button>
              </div>
            </div>

            {searchQuery && (
              <div className="flex items-center gap-2 px-3 py-1.5 mb-3 bg-indigo-50/80 border border-indigo-200/60 rounded-lg text-xs text-indigo-700 font-semibold w-fit">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {totalSearchMatches} {totalSearchMatches === 1 ? "match" : "matches"} found
              </div>
            )}

            <div className="flex flex-wrap gap-3 items-center">

              {availableUsers.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 mr-1">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className={`text-[11px] font-bold uppercase tracking-wide ${darkMode ? "text-gray-400" : "text-gray-500"}`}>User</span>
                  </div>
                  <button
                    onClick={() => setSelectedUserFilter("all")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all text-xs shadow-sm ${selectedUserFilter === "all" ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md scale-105" : darkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    All
                    <span className="px-1.5 py-0.5 bg-white/25 rounded-full text-[10px] font-bold">{Object.values(tasks).flat().length}</span>
                  </button>
                  {availableUsers.map(user => {
                    const count = Object.values(tasks).flat().filter(t => t.assignedTo?.some(u => u._id === user._id)).length;
                    return (
                      <button key={user._id} onClick={() => setSelectedUserFilter(user._id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all text-xs shadow-sm ${selectedUserFilter === user._id ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md scale-105" : darkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                      >
                        <div className="w-5 h-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-[10px]">
                          {user.name?.trim().split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase() || "?"}
                        </div>
                        <span className="max-w-[80px] truncate">{user.name}</span>
                        <span className="px-1.5 py-0.5 bg-white/25 rounded-full text-[10px] font-bold">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className={`w-px h-8 ${darkMode ? "bg-gray-600" : "bg-gray-200"}`} />

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 mr-1">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className={`text-[11px] font-bold uppercase tracking-wide ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Priority</span>
                </div>
                {[
                  { value: "all",    label: "All",  icon: "●",  activeCls: "from-gray-400 to-gray-500",       inactiveCls: darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700" },
                  { value: "high",   label: "High", icon: "🔴", activeCls: "from-red-500 to-rose-600",        inactiveCls: darkMode ? "bg-red-900/40 text-red-300" : "bg-red-100 text-gray-700" },
                  { value: "medium", label: "Med",  icon: "🟡", activeCls: "from-yellow-500 to-orange-500",   inactiveCls: darkMode ? "bg-yellow-900/40 text-yellow-300" : "bg-yellow-100 text-gray-700" },
                  { value: "low",    label: "Low",  icon: "🟢", activeCls: "from-green-500 to-emerald-600",   inactiveCls: darkMode ? "bg-green-900/40 text-green-300" : "bg-green-100 text-gray-700" },
                ].map(({ value, label, icon, activeCls, inactiveCls }) => (
                  <button key={value} onClick={() => setPriorityFilter(value)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all text-xs shadow-sm ${priorityFilter === value ? `bg-gradient-to-r ${activeCls} text-white shadow-md scale-105` : inactiveCls}`}
                  >
                    <span className="text-sm">{icon}</span>{label}
                  </button>
                ))}
              </div>

              <div className={`w-px h-8 ${darkMode ? "bg-gray-600" : "bg-gray-200"}`} />

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 mr-1">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className={`text-[11px] font-bold uppercase tracking-wide ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Due</span>
                </div>
                {[
                  { value: "all",      label: "All",      icon: "📅", activeCls: "from-gray-400 to-gray-500",       inactiveCls: darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700" },
                  { value: "overdue",  label: "Overdue",  icon: "🔥", activeCls: "from-red-500 to-rose-600",        inactiveCls: darkMode ? "bg-red-900/40 text-red-300" : "bg-red-100 text-gray-700" },
                  { value: "today",    label: "Today",    icon: "⏰", activeCls: "from-orange-400 to-amber-500",    inactiveCls: darkMode ? "bg-orange-900/40 text-orange-300" : "bg-orange-100 text-gray-700" },
                  { value: "upcoming", label: "Upcoming", icon: "🗓️", activeCls: "from-blue-500 to-indigo-600",    inactiveCls: darkMode ? "bg-blue-900/40 text-blue-300" : "bg-blue-100 text-gray-700" },
                ].map(({ value, label, icon, activeCls, inactiveCls }) => (
                  <button key={value} onClick={() => setDueDateFilter(value)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all text-xs shadow-sm ${dueDateFilter === value ? `bg-gradient-to-r ${activeCls} text-white shadow-md scale-105` : inactiveCls}`}
                  >
                    <span className="text-sm">{icon}</span>{label}
                  </button>
                ))}
              </div>

              <div className={`w-px h-8 ${darkMode ? "bg-gray-600" : "bg-gray-200"}`} />

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  <span className={`text-[11px] font-bold uppercase tracking-wide ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Sort</span>
                </div>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className={`border-2 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 transition-all cursor-pointer shadow-sm ${darkMode ? "bg-gray-700 border-gray-600 text-gray-200 hover:border-indigo-400" : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 text-gray-700 hover:border-indigo-300"}`}
                >
                  <option value="default">Default Order</option>
                  <option value="priority">Priority (High → Low)</option>
                  <option value="dueDate">Due Date (Earliest First)</option>
                  <option value="title">Title (A → Z)</option>
                  <option value="created">Created (Newest First)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Mobile controls ── */}
        <div className="md:hidden max-w-[2000px] mx-auto px-3 sm:px-5 space-y-2 pb-2">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks…"
              className={`w-full border-2 focus:border-indigo-400 pl-10 sm:pl-11 pr-10 py-2.5 sm:py-3 rounded-xl outline-none transition-all text-sm sm:text-base placeholder-gray-400 font-medium shadow-sm ${darkMode ? "bg-gray-800 border-gray-600 text-gray-100 focus:bg-gray-700" : "bg-white/80 border-gray-200 focus:bg-white"}`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {searchQuery && (
              <p className="text-xs sm:text-sm text-indigo-400 font-semibold mt-1.5 ml-1">
                {totalSearchMatches} {totalSearchMatches === 1 ? "match" : "matches"} found
              </p>
            )}
          </div>

          {availableUsers.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className={`text-[11px] sm:text-xs font-bold uppercase tracking-wide ${darkMode ? "text-gray-400" : "text-gray-500"}`}>User</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button onClick={() => setSelectedUserFilter("all")}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all ${selectedUserFilter === "all" ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md" : darkMode ? "bg-gray-700 border border-gray-600 text-gray-300" : "bg-white/80 border border-gray-200 text-gray-700"}`}
                >
                  All
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${selectedUserFilter === "all" ? "bg-white/25" : darkMode ? "bg-gray-600" : "bg-gray-100"}`}>
                    {Object.values(tasks).flat().length}
                  </span>
                </button>
                {availableUsers.map(user => {
                  const count = Object.values(tasks).flat().filter(t => t.assignedTo?.some(u => u._id === user._id)).length;
                  const isActive = selectedUserFilter === user._id;
                  return (
                    <button key={user._id} onClick={() => setSelectedUserFilter(user._id)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all ${isActive ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md" : darkMode ? "bg-gray-700 border border-gray-600 text-gray-300" : "bg-white/80 border border-gray-200 text-gray-700"}`}
                    >
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-[9px] sm:text-[10px] flex-shrink-0">
                        {user.name?.trim().split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase() || "?"}
                      </div>
                      <span className="max-w-[72px] sm:max-w-[100px] truncate">{user.name}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-white/25" : darkMode ? "bg-gray-600" : "bg-gray-100"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(priorityFilter !== "all" || sortBy !== "default" || dueDateFilter !== "all") && (
            <div className="flex items-center gap-2 flex-wrap">
              {priorityFilter !== "all" && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold capitalize">
                  {priorityFilter}
                  <button onClick={() => setPriorityFilter("all")}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              )}
              {dueDateFilter !== "all" && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold capitalize">
                  {dueDateFilter === "upcoming" ? "Upcoming" : dueDateFilter === "today" ? "Due Today" : "Overdue"}
                  <button onClick={() => setDueDateFilter("all")}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              )}
              {sortBy !== "default" && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                  Sorted
                  <button onClick={() => setSortBy("default")}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Add column ── */}
        <div className={`max-w-[2000px] mx-auto px-3 sm:px-5 md:px-6 lg:px-8 py-2 sm:py-3 md:py-4 ${!showAddColumn ? 'hidden sm:block' : ''}`}>
          <div className={`backdrop-blur-sm rounded-2xl border p-3 sm:p-4 lg:p-5 shadow-xl transition-colors duration-300 ${darkMode ? "bg-gray-800/60 border-gray-700/50" : "bg-white/60 border-gray-200/50"}`}>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-3 flex-1">
                <div className="p-2 sm:p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <input
                  className={`flex-1 border-2 focus:border-indigo-400 px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 rounded-xl outline-none transition-all placeholder-gray-400 font-medium shadow-sm text-sm sm:text-base ${darkMode ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-white/80 border-gray-200"}`}
                  placeholder="Add a new column…"
                  value={newColumn}
                  onChange={e => setNewColumn(e.target.value)}
                  onKeyPress={e => handleKeyPress(e, addColumn)}
                  autoFocus={showAddColumn}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={addColumn} className="flex-1 sm:flex-none px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 md:py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all text-sm sm:text-base">
                  Add Column
                </button>
                <button onClick={() => setShowAddColumn(false)} className={`sm:hidden px-3 py-2 rounded-xl text-sm font-medium ${darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Kanban board ── */}
        <div className="max-w-[2000px] mx-auto px-3 sm:px-5 md:px-6 lg:px-8 pb-24 md:pb-12">
          <div className="flex gap-3 sm:gap-4 md:gap-5 lg:gap-6 overflow-x-auto pb-4 sm:pb-6 -mx-3 px-3 sm:mx-0 sm:px-0 items-start snap-x snap-mandatory md:snap-none">
            {columns.map((col, index) => {
              const columnTasks   = Array.isArray(tasks[col._id]) ? tasks[col._id] : [];
              const filteredTasks = filterTasks(columnTasks);
              const isCollapsed   = collapsedColumns.has(col._id);

              return (
                <div key={col._id} className="snap-start flex-shrink-0 w-[85vw] sm:w-[340px] md:w-[300px] lg:w-[320px] xl:w-[360px]">
                  <KanbanColumn
                    column={col}
                    columnIndex={index}
                    tasks={filteredTasks}
                    newTaskInput={newTask[col._id]}
                    onNewTaskChange={(colId, val) => setNewTask(prev => ({ ...prev, [colId]: val }))}
                    onAddTask={addTask}
                    onEditColumn={handleEditColumn}
                    onDeleteColumn={handleDeleteColumn}
                    onTaskClick={setModalTask}
                    onKeyPress={handleKeyPress}
                    activeTaskId={activeTask?._id}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={toggleCollapseColumn}
                    searchQuery={searchQuery}
                  />
                </div>
              );
            })}

            {columns.length === 0 && (
              <div className="w-full flex items-center justify-center py-16 sm:py-24 md:py-32">
                <div className="text-center px-4">
                  <div className={`inline-flex items-center justify-center w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full mb-5 sm:mb-6 ${darkMode ? "bg-gray-800" : "bg-gradient-to-br from-indigo-100 to-purple-100"}`}>
                    <svg className={`w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 ${darkMode ? "text-indigo-400" : "text-indigo-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                  </div>
                  <h3 className={`text-xl sm:text-2xl md:text-3xl font-bold mb-2 ${darkMode ? "text-gray-200" : "text-gray-800"}`}>No columns yet</h3>
                  <p className={`text-sm sm:text-base mb-5 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>Create your first column to get started</p>
                  <button
                    onClick={() => setShowAddColumn(true)}
                    className="sm:hidden px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-md text-sm"
                  >
                    Add a column
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        {deleteColumnId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl shadow-2xl p-6">

      <h2 className="text-lg font-semibold text-white">
        Delete Project Permanently?
      </h2>

      <p className="text-gray-400 mt-3 text-sm leading-relaxed">
         Delete this column and all its tasks?
      </p>

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={() => setDeleteColumnId(null)}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
        >
          Cancel
        </button>

        <button
          onClick={confirmDeleteColumn}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition shadow-lg"
        >
          Delete Permanently
        </button>
      </div>

    </div>
  </div>
)}


        {/* ── Task modal ── */}
        {modalTask && (
          <TaskModal
            task={modalTask}
            columns={columns}
            onClose={() => setModalTask(null)}
            onSave={load}
            onDelete={handleDeleteTask}
            onError={setError}
          />
        )}

        {/* ── Activity log panel ── */}
        {showActivityLog && (
            <ActivityLog
              log={activityLog}
              onClose={() => setShowActivityLog(false)}
              onClear={handleClearActivity}          
              onDeleteEntry={handleDeleteActivityEntry}  
            />
          )}

        {/* ── Mobile filter sheet ── */}
        <MobileFilterSheet
          show={showMobileFilters}
          onClose={() => setShowMobileFilters(false)}
          priorityFilter={priorityFilter}
          setPriorityFilter={setPriorityFilter}
          dueDateFilter={dueDateFilter}
          setDueDateFilter={setDueDateFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          darkMode={darkMode}
        />

      </div>

      <DragOverlay dropAnimation={DROP_ANIMATION}>
        <OverlayCard task={activeTask} />
      </DragOverlay>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        @media (max-width: 640px) {
          .custom-scrollbar,
          .scrollbar-none {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .custom-scrollbar::-webkit-scrollbar,
          .scrollbar-none::-webkit-scrollbar { display: none; }
        }

        @media (max-width: 640px) {
          button { min-height: 40px; }
          input, textarea, select { min-height: 44px; }
        }

        @media (max-width: 640px) {
          .snap-x { scroll-padding-left: 12px; }
        }

        [data-dnd-kit-draggable] { user-select: none; }
      `}</style>
    </DndContext>
  );
}
