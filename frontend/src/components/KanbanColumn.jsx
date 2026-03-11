/* eslint-disable no-unused-vars */
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Column colour palette ────────────────────────────────────────────────────
const COLUMN_COLORS = [
  { from: "from-blue-500",    to: "to-cyan-500",    accent: "#3b82f6" },
  { from: "from-purple-500",  to: "to-pink-500",    accent: "#a855f7" },
  { from: "from-emerald-500", to: "to-teal-500",    accent: "#10b981" },
  { from: "from-orange-500",  to: "to-red-500",     accent: "#f97316" },
  { from: "from-indigo-500",  to: "to-purple-500",  accent: "#6366f1" },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────
function formatDate(ds) {
  if (!ds) return null;
  return new Date(ds).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// Highlight matching search text in a string
function HighlightText({ text, query }) {
  if (!query || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}
// Each card registers itself as both a draggable source AND a sortable drop
// target via useSortable — so reordering within a column happens automatically.
export function SortableTaskCard({ task, accent, onTaskClick, searchQuery = "" }) {
  const {
    attributes,    // a11y + role props
    listeners,     // pointer / keyboard listeners that start the drag
    setNodeRef,    // attach to the card DOM node
    transform,     // CSS transform applied while dragging
    transition,    // CSS transition string for smooth snap-back
    isDragging,    // true while this card is the active draggable
  } = useSortable({
    id: task._id,
    // Pass the full task object so DragOverlay can render a rich preview
    data: { type: "task", task, columnId: task.column },
  });

  const style = {
  transform: CSS.Transform.toString(
    transform ? { ...transform, scaleX: 1, scaleY: 1 } : null
  ),
  transition,
  zIndex: isDragging ? 10 : undefined,
  touchAction: "none",   
};

  return (
    <div
        ref={setNodeRef}
        style={style}
        className={`
          group bg-white rounded-xl border select-none touch-none
        transition-[border-color,box-shadow,opacity] duration-150
        ${
          isDragging
            ? "opacity-40 border-dashed border-gray-300 shadow-none"
            : "border-gray-200 hover:shadow-md hover:border-gray-300 hover:-translate-y-px cursor-pointer"
        }
      `}
      // Only fire click when it was a genuine tap, not the end of a drag
      onClick={() => !isDragging && onTaskClick(task)}
    >
      {/* ── Drag-handle row ───────────────────────────────────────────────── */}
      {/* listeners + attributes go on the handle, not the whole card, so that
          clicking the card body still opens the modal without starting a drag. */}
      <div
  {...listeners}
  {...attributes}
  className="flex items-center px-3 pt-3 pb-0 cursor-grab active:cursor-grabbing touch-none"
        onClick={(e) => e.stopPropagation()} // don't open modal when grabbing
        aria-label="Drag task"
      >
        <span className="opacity-0 group-hover:opacity-30 transition-opacity">
          {/* Six-dot grip icon */}
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="7"  cy="4"  r="1.4" />
            <circle cx="13" cy="4"  r="1.4" />
            <circle cx="7"  cy="10" r="1.4" />
            <circle cx="13" cy="10" r="1.4" />
            <circle cx="7"  cy="16" r="1.4" />
            <circle cx="13" cy="16" r="1.4" />
          </svg>
        </span>
      </div>

      {/* ── Card body ─────────────────────────────────────────────────────── */}
      <div className="px-3 pb-3 pt-1.5">
        <p className="text-gray-800 font-medium leading-snug mb-2 text-sm sm:text-base">
          <HighlightText text={task.title} query={searchQuery} />
        </p>

        {task.description && (
          <p className="text-gray-400 text-xs sm:text-sm line-clamp-2 mb-2">
            <HighlightText text={task.description} query={searchQuery} />
          </p>
        )}

        {/* ── Badges ── */}
        <div className="flex flex-wrap items-center gap-1.5">
          {task.priority && (
            <span
              className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                task.priority === "high"
                  ? "bg-red-100 text-red-700"
                  : task.priority === "medium"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </span>
          )}

          {task.dueDate && (
            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[11px] font-semibold flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(task.dueDate)}
            </span>
          )}

          {task.attachments?.length > 0 && (
            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[11px] font-semibold flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {task.attachments.length}
            </span>
          )}

          {task.comments?.length > 0 && (
            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[11px] font-semibold flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {task.comments.length}
            </span>
          )}
        </div>

        {/* ── Assignee avatars ── */}
        {task.assignedTo?.length > 0 && (
          <div className="flex -space-x-1.5 mt-2">
            {task.assignedTo.slice(0, 3).map((user) => (
              <div
                key={user._id}
                title={user.name}
                className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm"
              >
                {initials(user.name)}
              </div>
            ))}
            {task.assignedTo.length > 3 && (
              <div className="w-6 h-6 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white">
                +{task.assignedTo.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────
export default function KanbanColumn({
  column,
  columnIndex,
  tasks,
  newTaskInput,
  onNewTaskChange,
  onAddTask,
  onEditColumn,
  onDeleteColumn,
  onTaskClick,
  onKeyPress,
  activeTaskId,       // _id of the task being dragged right now (from TasksPage)
  isCollapsed = false,
  onToggleCollapse,
  searchQuery = "",
}) {
  const colors = COLUMN_COLORS[columnIndex % COLUMN_COLORS.length];

  // Debug: log when isCollapsed changes
  // console.log(`KanbanColumn ${column.name} - isCollapsed:`, isCollapsed);

  // useDroppable makes the tasks container a valid drop zone.
  // When a draggable hovers over this column (but not over any of its child
  // sortable items) the column itself is the "over" target.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: column._id,
    data: { type: "column", columnId: column._id },
  });

  // IDs list fed to SortableContext — must stay stable references
  const taskIds = tasks.map((t) => t._id);

  // Show the drop-over highlight when hovering over the column droppable
  // OR over any of its sortable children (the latter is caught by dnd-kit
  // automatically because SortableContext registers child sensors).
  const isDragOver = isOver;

  return (
    <div className="w-[300px] sm:w-[320px] lg:w-[360px] flex-shrink-0 flex flex-col">
      <div
        className="bg-white/80 backdrop-blur-sm rounded-2xl border shadow-xl overflow-hidden flex flex-col h-full transition-all duration-200"
        style={
          isDragOver
            ? {
                border: `2px solid ${colors.accent}`,
                boxShadow: `0 0 0 4px ${colors.accent}18, 0 20px 60px -10px ${colors.accent}28`,
                transform: "scale(1.01)",
              }
            : { border: "1px solid rgba(209,213,219,0.5)" }
        }
      >
        {/* ── Column Header ── */}
        <div className={`bg-gradient-to-r ${colors.from} ${colors.to} p-4 sm:p-5`}>
          {column.isEditing ? (
            <div className="flex gap-2">
              <input
                className="flex-1 bg-white/95 px-3 sm:px-4 py-2 rounded-lg font-semibold text-gray-800 outline-none shadow-inner text-sm"
                value={column.editName}
                onChange={(e) => onEditColumn(column._id, e.target.value)}
                onKeyPress={(e) =>
                  onKeyPress(e, () => onEditColumn(column._id, null, true))
                }
                autoFocus
              />
              <button
                onClick={() => onEditColumn(column._id, null, true)}
                className="px-3 sm:px-4 bg-white text-green-600 rounded-lg hover:bg-green-50 transition-colors shadow-md font-bold"
                aria-label="Save column name"
              >
                ✓
              </button>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 sm:gap-3">
                <h2 className="font-bold text-white text-base sm:text-lg tracking-wide">
                  {column.name}
                </h2>
                <div className="px-2.5 py-0.5 bg-white/20 rounded-full">
                  <span className="text-xs font-bold text-white">{isCollapsed ? '−' : tasks.length}</span>
                </div>
              </div>
              <div className="flex gap-1.5 sm:gap-2">
                {/* Collapse / expand toggle */}
                <button
                  onClick={() => onToggleCollapse?.(column._id)}
                  className="p-1.5 sm:p-2 bg-white/20 hover:bg-white/35 rounded-lg transition-colors"
                  aria-label={isCollapsed ? "Expand column" : "Collapse column"}
                  title={isCollapsed ? "Expand" : "Collapse"}
                >
                  <svg
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-white transition-transform duration-200 ${isCollapsed ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => onEditColumn(column._id)}
                  className="p-1.5 sm:p-2 bg-white/20 hover:bg-white/35 rounded-lg transition-colors"
                  aria-label="Edit column"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => onDeleteColumn(column._id)}
                  className="p-1.5 sm:p-2 bg-white/20 hover:bg-red-500 rounded-lg transition-colors"
                  aria-label="Delete column"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Droppable + Sortable task list ── */}
        {!isCollapsed && (
        <div
          ref={setDropRef}
          className="flex-1 p-3 sm:p-4 overflow-y-auto max-h-[calc(100vh-400px)] custom-scrollbar transition-colors duration-200 min-h-[80px]"
          style={{
            backgroundColor: isDragOver ? `${colors.accent}0d` : "transparent",
          }}
        >
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.length === 0 ? (
              /* ── Empty state ── */
              <div
                className={`
                  flex flex-col items-center justify-center py-10 sm:py-14
                  rounded-xl min-h-[100px] transition-all duration-200
                  ${isDragOver
                    ? "border-2 border-dashed"
                    : "border-2 border-transparent"
                  }
                `}
                style={isDragOver ? { borderColor: colors.accent } : {}}
              >
                {isDragOver ? (
                  <>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mb-2 animate-bounce"
                      style={{ backgroundColor: `${colors.accent}20` }}
                    >
                      <svg className="w-5 h-5" style={{ color: colors.accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                          d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: colors.accent }}>
                      Drop here
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 sm:w-7 sm:h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-400 text-xs sm:text-sm font-medium">No tasks yet</p>
                    <p className="text-gray-300 text-[11px] mt-0.5">
                      Drag a task here or add one below
                    </p>
                  </>
                )}
              </div>
            ) : (
              /* ── Task cards ── */
              
              <div className="space-y-2">
                {tasks.map((task) => (
                  <SortableTaskCard
                    key={task._id}
                    task={task}
                    accent={colors.accent}
                    onTaskClick={onTaskClick}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            )}
          </SortableContext>
        </div>
        )} {/* end !isCollapsed */}

        {/* ── Add task input ── */}
        {!isCollapsed && (
        <div className="p-3 sm:p-4 border-t border-gray-100 bg-gray-50/60">
          <div className="flex gap-2">
            <input
              className="flex-1 bg-white border-2 border-gray-200 focus:border-indigo-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg outline-none transition-colors placeholder-gray-400 text-xs sm:text-sm font-medium"
              placeholder="Add a task…"
              value={newTaskInput || ""}
              onChange={(e) => onNewTaskChange(column._id, e.target.value)}
              onKeyPress={(e) => onKeyPress(e, () => onAddTask(column._id))}
            />
            <button
              onClick={() => onAddTask(column._id)}
              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all font-bold"
              aria-label="Add task"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>
        </div>
        )} {/* end !isCollapsed add-task */}
      </div>
    </div>
  );
}