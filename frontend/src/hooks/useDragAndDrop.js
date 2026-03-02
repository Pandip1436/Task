import { useState, useRef, useCallback } from "react";

/**
 * useDragAndDrop
 * Manages drag-and-drop state for a Kanban board.
 * Uses HTML5 native DnD API — no external library required.
 *
 * Returns drag state + handler factories to spread onto task cards and column drop zones.
 */
export function useDragAndDrop({ tasks, setTasks, onMoveTask }) {
  // Which task is currently being dragged
  const [draggedTask, setDraggedTask] = useState(null);
  // Which column the dragged task started in
  const [sourceColumnId, setSourceColumnId] = useState(null);
  // Which column is currently being hovered as a drop target
  const [overColumnId, setOverColumnId] = useState(null);
  // Which task id we're hovering between (for reorder indicator)
  const [overTaskId, setOverTaskId] = useState(null);
  // "before" or "after" the overTaskId
  const [dropPosition, setDropPosition] = useState(null);

  // Debounce ref to avoid flickering on dragover
  const dragOverTimer = useRef(null);

  const resetDragState = useCallback(() => {
    setDraggedTask(null);
    setSourceColumnId(null);
    setOverColumnId(null);
    setOverTaskId(null);
    setDropPosition(null);
    if (dragOverTimer.current) clearTimeout(dragOverTimer.current);
  }, []);

  /* ─── Task card drag handlers ─────────────────────────────────── */

  const getTaskDragHandlers = useCallback(
    (task, columnId) => ({
      draggable: true,

      onDragStart: (e) => {
        setDraggedTask(task);
        setSourceColumnId(columnId);
        // Set drag image opacity via a clone trick
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("taskId", task._id);
        e.dataTransfer.setData("sourceColumnId", columnId);
        // Let the browser paint the element as ghost first
        setTimeout(() => {
          setOverColumnId(columnId);
        }, 0);
      },

      onDragEnd: () => {
        resetDragState();
      },
    }),
    [resetDragState]
  );

  /* ─── Column drop zone handlers ───────────────────────────────── */

  const getColumnDropHandlers = useCallback(
    (columnId) => ({
      onDragOver: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (overColumnId !== columnId) {
          setOverColumnId(columnId);
        }
      },

      onDragEnter: (e) => {
        e.preventDefault();
        setOverColumnId(columnId);
      },

      onDragLeave: (e) => {
        // Only clear if we truly left the column (not just entered a child)
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOverColumnId((prev) => (prev === columnId ? null : prev));
        }
      },

      onDrop: (e) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("taskId");
        const srcColId = e.dataTransfer.getData("sourceColumnId");

        if (!taskId || !srcColId) {
          resetDragState();
          return;
        }

        // Find the dragged task object
        const srcTasks = tasks[srcColId] || [];
        const task = srcTasks.find((t) => t._id === taskId);
        if (!task) {
          resetDragState();
          return;
        }

        const isSameColumn = srcColId === columnId;

        setTasks((prev) => {
          const srcList = [...(prev[srcColId] || [])];
          const destList = isSameColumn
            ? srcList
            : [...(prev[columnId] || [])];

          // Remove from source
          const srcIndex = srcList.findIndex((t) => t._id === taskId);
          if (srcIndex === -1) return prev;
          srcList.splice(srcIndex, 1);

          // Determine insertion index based on overTaskId / dropPosition
          let destIndex = destList.length; // default: append to end

          if (overTaskId && overTaskId !== taskId) {
            const overIndex = destList.findIndex((t) => t._id === overTaskId);
            if (overIndex !== -1) {
              destIndex =
                dropPosition === "before" ? overIndex : overIndex + 1;
            }
          }

          if (isSameColumn) {
            // Re-insert in same list (already removed above)
            srcList.splice(destIndex, 0, { ...task, column: columnId });
            return { ...prev, [columnId]: srcList };
          } else {
            destList.splice(destIndex, 0, { ...task, column: columnId });
            return {
              ...prev,
              [srcColId]: srcList,
              [columnId]: destList,
            };
          }
        });

        // Persist to backend
        onMoveTask(taskId, columnId, srcColId);
        resetDragState();
      },
    }),
    [tasks, overColumnId, overTaskId, dropPosition, resetDragState, setTasks, onMoveTask]
  );

  /* ─── Individual task drop-target handlers (for ordering) ─────── */

  const getTaskDropHandlers = useCallback(
    (task, columnId) => ({
      onDragOver: (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggedTask || draggedTask._id === task._id) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const pos = e.clientY < midY ? "before" : "after";

        setOverTaskId(task._id);
        setDropPosition(pos);
        setOverColumnId(columnId);
      },

      onDragLeave: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOverTaskId(null);
          setDropPosition(null);
        }
      },
    }),
    [draggedTask]
  );

  return {
    draggedTask,
    sourceColumnId,
    overColumnId,
    overTaskId,
    dropPosition,
    getTaskDragHandlers,
    getColumnDropHandlers,
    getTaskDropHandlers,
  };
}