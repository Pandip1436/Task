// src/hooks/useBoardSocket.js
import { useEffect, useRef, useCallback } from "react";
import { socketService } from "../services/socket.service";

export function useBoardSocket(
  boardId,
  setTasks,
  setColumns,
  setModalTask,
  setActivityLog,
  navigate        
) {
  const socketReady = useRef(false);

  // ── Task helpers ─────────────────────────────────────────────────────────
  const upsertTask = useCallback((task, columnId) => {
    const colId = columnId ?? task.column?.toString?.() ?? task.column;
    if (!colId) return;
    setTasks((prev) => {
      const updated = {};
      for (const [cid, list] of Object.entries(prev)) {
        updated[cid] = list.filter((t) => t._id !== task._id);
      }
      updated[colId] = [...(updated[colId] ?? []), task];
      return updated;
    });
    setModalTask((prev) => (prev?._id === task._id ? task : prev));
  }, [setTasks, setModalTask]);

  const removeTask = useCallback((taskId, columnId) => {
    setTasks((prev) => {
      if (columnId && prev[columnId]) {
        return { ...prev, [columnId]: prev[columnId].filter((t) => t._id !== taskId) };
      }
      const updated = {};
      for (const [cid, list] of Object.entries(prev)) {
        updated[cid] = list.filter((t) => t._id !== taskId);
      }
      return updated;
    });
    setModalTask((prev) => (prev?._id === taskId ? null : prev));
  }, [setTasks, setModalTask]);

  const moveTask = useCallback(({ task, taskId, columnId }) => {
    const resolvedId = taskId ?? task?._id;
    setTasks((prev) => {
      const updated = {};
      for (const [cid, list] of Object.entries(prev)) {
        updated[cid] = list.filter((t) => t._id !== resolvedId);
      }
      if (task) {
        updated[columnId] = [...(updated[columnId] ?? []), { ...task, column: columnId }];
      }
      return updated;
    });
    if (task) {
      setModalTask((prev) => (prev?._id === resolvedId ? { ...task, column: columnId } : prev));
    }
  }, [setTasks, setModalTask]);

  // ── Comment helpers ──────────────────────────────────────────────────────
  const applyComment = useCallback(({ taskId, comment }, action) => {
    const patch = (comments) => {
      if (action === "add")    return [...comments, comment];
      if (action === "update") return comments.map((c) => (c._id === comment._id ? comment : c));
      return comments;
    };
    setTasks((prev) => {
      const updated = {};
      for (const [cid, list] of Object.entries(prev)) {
        updated[cid] = list.map((t) =>
          t._id !== taskId ? t : { ...t, comments: patch(t.comments ?? []) }
        );
      }
      return updated;
    });
    setModalTask((prev) =>
      prev?._id !== taskId ? prev : { ...prev, comments: patch(prev.comments ?? []) }
    );
  }, [setTasks, setModalTask]);

  const removeComment = useCallback(({ taskId, commentId }) => {
    setTasks((prev) => {
      const updated = {};
      for (const [cid, list] of Object.entries(prev)) {
        updated[cid] = list.map((t) =>
          t._id !== taskId ? t : { ...t, comments: (t.comments ?? []).filter((c) => c._id !== commentId) }
        );
      }
      return updated;
    });
    setModalTask((prev) =>
      prev?._id !== taskId ? prev
        : { ...prev, comments: (prev.comments ?? []).filter((c) => c._id !== commentId) }
    );
  }, [setTasks, setModalTask]);

  // ── Column helpers ───────────────────────────────────────────────────────
  const upsertColumn = useCallback((column) => {
    setColumns((prev) => {
      const exists = prev.some((c) => c._id === column._id);
      return exists ? prev.map((c) => (c._id === column._id ? column : c)) : [...prev, column];
    });
    setTasks((prev) => (prev[column._id] ? prev : { ...prev, [column._id]: [] }));
  }, [setColumns, setTasks]);

  const removeColumn = useCallback(({ columnId }) => {
    setColumns((prev) => prev.filter((c) => c._id !== columnId));
    setTasks((prev) => {
      const { [columnId]: _dropped, ...rest } = prev;
      return rest;
    });
  }, [setColumns, setTasks]);

  // ── Activity helpers ─────────────────────────────────────────────────────
  const addActivity = useCallback((activity) => {
    if (!setActivityLog) return;
    setActivityLog((prev) => {
      const alreadyExists = prev.some((e) => e._id === activity._id);
      if (alreadyExists) return prev;
      return [activity, ...prev];
    });
  }, [setActivityLog]);

  // ── Mount / unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!boardId) return;

    const socket = socketService.connect();
    socketService.joinBoard(boardId);
    socketReady.current = true;

    const handlers = {
      // Tasks
      "task:created":    ({ task, columnId })   => upsertTask(task, columnId),
      "task:updated":    ({ task, columnId })   => upsertTask(task, columnId),
      "task:deleted":    ({ taskId, columnId }) => removeTask(taskId, columnId),
      "task:moved":      (payload)              => moveTask(payload),

      // Comments
      "comment:added":   (payload) => applyComment(payload, "add"),
      "comment:updated": (payload) => applyComment(payload, "update"),
      "comment:deleted": (payload) => removeComment(payload),

      // Columns
      "column:created":  ({ column }) => upsertColumn(column),
      "column:updated":  ({ column }) => upsertColumn(column),
      "column:deleted":  (payload)   => removeColumn(payload),

      // Activity
      "activity:created": ({ activity }) => addActivity(activity),
      "activity:cleared": ()             => setActivityLog?.([]),
      "activity:deleted": ({ logId })    => setActivityLog?.(prev => prev.filter(e => e._id !== logId)),

      // Board
      "board:updated": () => {}, // BoardSwitcher re-fetches on its own
      "board:deleted": ({ boardId: deletedId, projectId: pid }) => {
        if (deletedId === boardId) {
          navigate?.(pid ? `/projects/${pid}` : "/");
        }
      },
    };

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event, handler);
      }
      socketService.leaveBoard(boardId);
      socketReady.current = false;
    };
  }, [
    boardId,
    navigate,
    upsertTask, removeTask, moveTask,
    applyComment, removeComment,
    upsertColumn, removeColumn,
    addActivity, setActivityLog,
  ]);

  return { socketReady: socketReady.current };
}