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
import { getBoard } from "../services/board.service";
import {
  createActivityLog, getActivityLogs, clearBoardActivityLogs, deleteActivityLog,
} from "../services/activity.service";

import TaskModal          from "../components/TaskModal";
import KanbanColumn       from "../components/KanbanColumn";
import { useBoardSocket } from "../hooks/useBoardSocket";

// Separated sub-components
import OverlayCard        from "../components/OverlayCard";
import BoardSwitcher      from "../components/BoardSwitcher";
import StatsBar           from "../components/StatsBar";
import ActivityLog        from "../components/ActivityLog";
import MobileFilterSheet  from "../components/MobileFilterSheet";
import DeleteColumnModal  from "../components/DeleteColumnModal";
import AITaskGenerator from "../components/AITaskGenerator";

// ─── Drop animation config ────────────────────────────────────────────────────
const DROP_ANIMATION = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }),
};

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
  const [deleteColumnId,    setDeleteColumnId]    = useState(null);

  // Activity log
  const [activityLog, setActivityLog] = useState([]);
  useBoardSocket(boardId, setTasks, setColumns, setModalTask, setActivityLog, navigate);

  // ── Log activity ────────────────────────────────────────────────────────────

  const logActivity = useCallback(async (type, message, entityType = null, entityId = null) => {
  try {
    await createActivityLog({ boardId, type, message, entityType, entityId });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}, [boardId]);

  // ── Load activity logs on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!boardId) return;
    getActivityLogs(boardId)
      .then(res => setActivityLog(res.data))
      .catch(err => console.error("Failed to load activity logs:", err));
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

  // ── Load board data ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
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

const addTasks = async (aiTasks) => {

  if (!Array.isArray(aiTasks)) return;

  const firstColumnId = columns[0]?._id;
  if (!firstColumnId) return;

  try {

    const createdTasks = await Promise.all(
      aiTasks.map(task => {

        const payload = {
          title: typeof task === "string" ? task : task.title,
          priority: task.priority || "medium",
          columnId: firstColumnId,
          boardId: boardId
        };

        // console.log("Creating AI task:", payload); // debug

        return createTask(payload);

      })
    );

    setTasks(prev => ({
      ...prev,
      [firstColumnId]: [
        ...(prev[firstColumnId] || []),
        ...createdTasks.map(res => res.data)
      ]
    }));

  } catch (err) {
    console.error("Failed to create AI tasks", err);
  }
};

// ── DnD sensors ─────────────────────────────────────────────────────────────
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 4
    }
  }),
  useSensor(TouchSensor, {
    activationConstraint: {
      delay: 120,
      tolerance: 6
    }
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates
  })
);
const taskColumnMap = useMemo(() => {
  const map = {};
  Object.entries(tasks).forEach(([colId, list]) => {
    list.forEach(task => {
      map[task._id] = colId;
    });
  });
  return map;
}, [tasks]);



  const findColumnOfTask = useCallback((taskId) => {
    const entry = Object.entries(tasksRef.current).find(([, list]) => list.some(t => t._id === taskId));
    return entry ? entry[0] : null;
  }, []);

  const handleDragStart = useCallback(({ active }) => {
    const data = active.data.current;
    if (data?.type === "task") {
      setActiveTask({ ...data.task });
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
    const destColId =
  overData?.type === "column"
    ? over.id
    : findColumnOfTask(over.id);
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

  // ── Column management ───────────────────────────────────────────────────────
  const addColumn = async () => {
    if (!newColumn.trim()) return;
    try {
      const res = await createColumn({ name: newColumn, boardId });
      setColumns(prev => [...prev, res.data]);
      logActivity("create", `Column "${newColumn}" created`);
      setNewColumn("");
      setShowAddColumn(false);
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
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

  const handleDeleteColumn = (columnId) => setDeleteColumnId(columnId);

  const confirmDeleteColumn = async () => {
    const colName = columns.find(c => c._id === deleteColumnId)?.name || "column";
    try {
      await deleteColumn(deleteColumnId);
      setColumns(prev => prev.filter(c => c._id !== deleteColumnId));
      setTasks(prev => { const u = { ...prev }; delete u[deleteColumnId]; return u; });
      logActivity("delete", `Column "${colName}" deleted`);
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      setError("Failed to delete column");
    }
    setDeleteColumnId(null);
  };

  const toggleCollapseColumn = (columnId) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) next.delete(columnId); else next.add(columnId);
      return next;
    });
  };

  // ── Task management ─────────────────────────────────────────────────────────
  const addTask = async (columnId) => {
    if (!newTask[columnId]?.trim()) return;
    const title = newTask[columnId];
    try {
      const res = await createTask({ title, columnId, boardId });
      setTasks(prev => ({ ...prev, [columnId]: [...(prev[columnId] || []), res.data] }));
      logActivity("create", `Task "${title}" created`);
      setNewTask(prev => ({ ...prev, [columnId]: "" }));
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      setError("Failed to add task");
    }
  };

  const handleDeleteTask = async (taskId) => {
    const taskTitle = Object.values(tasks).flat().find(t => t._id === taskId)?.title || "Task";
    try {
      await deleteTask(taskId);
      setTasks(prev => {
        const updated = {};
        for (const columnId in prev) {
          updated[columnId] = prev[columnId].filter(task => task._id !== taskId);
        }
        return updated;
      });
      logActivity("delete", `Task "${taskTitle}" deleted`);
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      setError("Failed to delete task");
    }
  };

  // ── Activity log actions ────────────────────────────────────────────────────
  const handleClearActivity = useCallback(async () => {
    try {
      await clearBoardActivityLogs(boardId);
      setActivityLog([]);
    } catch {
      setError("Failed to clear activity logs");
    }
  }, [boardId]);

  const handleDeleteActivityEntry = useCallback(async (logId) => {
    try {
      await deleteActivityLog(logId);
      setActivityLog(prev => prev.filter(e => e._id !== logId));
    } catch {
      setError("Failed to delete activity entry");
    }
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const handleKeyPress = (e, action) => { if (e.key === "Enter") action(); };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (priorityFilter !== "all") count++;
    if (sortBy !== "default")     count++;
    if (dueDateFilter !== "all")  count++;
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
    if (priorityFilter !== "all") list = list.filter(t => t.priority === priorityFilter);
    if (dueDateFilter !== "all") {
      const now        = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
      if (dueDateFilter === "overdue")  list = list.filter(t => t.dueDate && new Date(t.dueDate) < todayStart);
      if (dueDateFilter === "today")    list = list.filter(t => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd);
      if (dueDateFilter === "upcoming") list = list.filter(t => t.dueDate && new Date(t.dueDate) > todayEnd);
    }
    const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, undefined: 3 };
    if (sortBy === "priority") list.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));
    if (sortBy === "dueDate")  list.sort((a, b) => !a.dueDate ? 1 : !b.dueDate ? -1 : new Date(a.dueDate) - new Date(b.dueDate));
    if (sortBy === "title")    list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    if (sortBy === "created")  list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list;
  }, [selectedUserFilter, searchQuery, priorityFilter, dueDateFilter, sortBy]);

  const totalSearchMatches = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    return Object.values(tasks).flat().filter(t =>
      t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ).length;
  }, [tasks, searchQuery]);

  // ── Loading state ───────────────────────────────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={`min-h-screen transition-colors duration-300 ${darkMode ? "bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950" : "bg-gradient-to-br from-indigo-300 via-purple-300 to-pink-300"}`}>

        {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
        <div className={`sticky top-0 z-20 backdrop-blur-xl border-b shadow-lg transition-colors duration-300 ${darkMode ? "bg-gray-900/80 border-gray-700/50" : "bg-white/70 border-gray-200/50"}`}>
          <div className="max-w-[2000px] mx-auto px-3 sm:px-5 md:px-6 lg:px-8 py-3 md:py-4">
            <div className="flex items-center justify-between gap-2 md:gap-4">

              {/* Left: back + board switcher */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
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

                <BoardSwitcher currentBoardId={boardId} darkMode={darkMode} projectId={projectId} />

                <p className={`text-[10px] sm:text-xs hidden md:block flex-shrink-0 ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                  Drag &amp; drop · click to edit
                </p>
              </div>

              {/* Right: action buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
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

                {/* Column count badge */}
                <div className={`hidden sm:block px-3 md:px-4 py-1.5 rounded-xl border ${darkMode ? "bg-gray-800/60 border-gray-600 text-gray-300" : "bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-200/50 text-gray-700"}`}>
                  <span className="text-xs sm:text-sm font-medium">
                    {columns.length} {columns.length === 1 ? "Column" : "Columns"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ ERROR BANNER ════════════════════════════════════════════════════ */}
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

        {/* ══ STATS BAR ═══════════════════════════════════════════════════════ */}
        <StatsBar tasks={tasks} columns={columns} darkMode={darkMode} />
        <AITaskGenerator addTasks={addTasks} />

        {/* ══ DESKTOP FILTER BAR ══════════════════════════════════════════════ */}
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

              {/* User filter */}
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

              {/* Priority filter */}
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

              {/* Due date filter */}
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

              {/* Sort */}
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

        {/* ══ MOBILE CONTROLS ════════════════════════════════════════════════ */}
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

        {/* ══ ADD COLUMN ══════════════════════════════════════════════════════ */}
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

        {/* ══ KANBAN BOARD ════════════════════════════════════════════════════ */}
        <div className="max-w-500 mx-auto px-3 sm:px-5 md:px-6 lg:px-8 pb-24 md:pb-12">
          <div
              className="flex gap-3 sm:gap-4 md:gap-5 lg:gap-6 overflow-x-auto pb-4 sm:pb-6 -mx-3 px-3 sm:mx-0 sm:px-0 items-start snap-x snap-mandatory md:snap-none"
              
            >
            {columns.map((col, index) => {
              const columnTasks   = Array.isArray(tasks[col._id]) ? tasks[col._id] : [];
              const filteredTasks = filterTasks(columnTasks);
              const isCollapsed   = collapsedColumns.has(col._id);
              return (
                <div key={col._id} className="snap-start shrink-0  sm:w-100 md:w-80 lg:w-80 xl:w-90">
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

        {/* ══ DELETE COLUMN MODAL ═════════════════════════════════════════════ */}
        {deleteColumnId && (
          <DeleteColumnModal
            onConfirm={confirmDeleteColumn}
            onCancel={() => setDeleteColumnId(null)}
          />
        )}

        {/* ══ TASK MODAL ══════════════════════════════════════════════════════ */}
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

        {/* ══ ACTIVITY LOG ════════════════════════════════════════════════════ */}
        {showActivityLog && (
          <ActivityLog
            log={activityLog}
            onClose={() => setShowActivityLog(false)}
            onClear={handleClearActivity}
            onDeleteEntry={handleDeleteActivityEntry}
          />
        )}

        {/* ══ MOBILE FILTER SHEET ═════════════════════════════════════════════ */}
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
          .custom-scrollbar, .scrollbar-none {
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

        [data-dnd-kit-draggable] {
  user-select: none;
}
      `}</style>
    </DndContext>
  );
}