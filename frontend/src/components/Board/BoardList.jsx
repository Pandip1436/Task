import { useState, useEffect, useRef } from "react";
import UserAssignmentDropdown from "./UserAssignmentDropdown";
import {
  updateTask,
  uploadAttachments,
  deleteAttachment,
  getDownloadUrl,
  addComment,
  deleteComment,
} from "../services/task.service";

// ─── Constants ────────────────────────────────────────────────────────────────
const LABEL_OPTIONS = [
  { id: "bug",      name: "Bug",      color: "#ef4444", bg: "#fee2e2" },
  { id: "feature",  name: "Feature",  color: "#3b82f6", bg: "#dbeafe" },
  { id: "design",   name: "Design",   color: "#a855f7", bg: "#f3e8ff" },
  { id: "backend",  name: "Backend",  color: "#f97316", bg: "#ffedd5" },
  { id: "frontend", name: "Frontend", color: "#06b6d4", bg: "#cffafe" },
  { id: "urgent",   name: "Urgent",   color: "#dc2626", bg: "#fef2f2" },
  { id: "review",   name: "Review",   color: "#d97706", bg: "#fef3c7" },
  { id: "docs",     name: "Docs",     color: "#059669", bg: "#d1fae5" },
];

const COLUMN_ACCENT = ["#3b82f6", "#a855f7", "#10b981", "#f97316", "#6366f1"];

const TABS = ["Details", "Subtasks", "Files", "Comments"];

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function toDateInputValue(date) {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

function formatDate(ds) {
  if (!ds) return "N/A";
  return new Date(ds).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatCommentTime(ds) {
  if (!ds) return "";
  const diff  = Date.now() - new Date(ds);
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return formatDate(ds);
}

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

function formatTimer(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function initials(name) {
  if (!name) return "?";
  const p = name.trim().split(" ");
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

// ─── Small sub-components ─────────────────────────────────────────────────────
function TabButton({ label, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
        active ? "text-indigo-600 border-indigo-600" : "text-gray-500 hover:text-gray-700 border-transparent"
      }`}
    >
      {label}
      {count != null && count > 0 && (
        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
          active ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-500"
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function ProgressRing({ pct }) {
  const r = 20, circ = 2 * Math.PI * r;
  return (
    <svg width="52" height="52" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="26" cy="26" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke={pct === 100 ? "#10b981" : "#6366f1"} strokeWidth="4"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      <text
        x="26" y="26" textAnchor="middle" dominantBaseline="central"
        fill="#374151"
        style={{
          fontSize: 10, fontWeight: 700,
          transform: "rotate(90deg)", transformOrigin: "26px 26px",
        }}
      >
        {pct}%
      </text>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TaskModal({ task, columns, onClose, onSave, onDelete, onError }) {
  const [tab,     setTab]     = useState("Details");
  const [saving,  setSaving]  = useState(false);
  const [copied,  setCopied]  = useState(false);

  // ── Core fields ─────────────────────────────────────────────────────────────
  const [modalData, setModalData] = useState({
    title:            task.title            || "",
    description:      task.description      || "",
    priority:         task.priority         || "medium",
    dueDate:          toDateInputValue(task.dueDate),
    columnId:         task.column           || "",
    attachments:      task.attachments      || [],
    comments:         task.comments         || [],
    assignedTo:       task.assignedTo       || [],
    // New fields
    labels:           task.labels           || [],
    subtasks:         task.subtasks         || [],
    estimatedMinutes: task.estimatedMinutes || "",
    trackedSeconds:   task.trackedSeconds   || 0,
  });

  // ── Input state ─────────────────────────────────────────────────────────────
  const [newSubtask,     setNewSubtask]     = useState("");
  const [editingSubId,   setEditingSubId]   = useState(null);
  const [editingSubText, setEditingSubText] = useState("");
  const [newComment,     setNewComment]     = useState("");

  // ── Live timer ──────────────────────────────────────────────────────────────
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setModalData(prev => ({ ...prev, trackedSeconds: prev.trackedSeconds + 1 }));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const completedCount = modalData.subtasks.filter(s => s.done).length;
  const subtaskPct     = modalData.subtasks.length
    ? Math.round((completedCount / modalData.subtasks.length) * 100) : 0;

  const estMins       = parseInt(modalData.estimatedMinutes) || 0;
  const trackedMins   = Math.floor(modalData.trackedSeconds / 60);
  const timeProgress  = estMins > 0 ? Math.min(100, Math.round((trackedMins / estMins) * 100)) : 0;

  const dueDateStatus = (() => {
    if (!modalData.dueDate) return null;
    const due  = new Date(modalData.dueDate);
    const now  = new Date(); now.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due - now) / 86400000);
    if (diff < 0)   return { label: `${Math.abs(diff)}d overdue`, cls: "text-red-600 bg-red-50 border-red-200" };
    if (diff === 0) return { label: "Due today",       cls: "text-orange-600 bg-orange-50 border-orange-200" };
    if (diff <= 3)  return { label: `Due in ${diff}d`, cls: "text-yellow-600 bg-yellow-50 border-yellow-200" };
    return             { label: `Due in ${diff}d`,     cls: "text-green-600 bg-green-50 border-green-200" };
  })();

  // ── Subtasks ─────────────────────────────────────────────────────────────────
  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setModalData(p => ({
      ...p,
      subtasks: [...p.subtasks, { id: Date.now(), text: newSubtask.trim(), done: false }],
    }));
    setNewSubtask("");
  };

  const toggleSubtask = (id) =>
    setModalData(p => ({ ...p, subtasks: p.subtasks.map(s => s.id === id ? { ...s, done: !s.done } : s) }));

  const deleteSubtask = (id) =>
    setModalData(p => ({ ...p, subtasks: p.subtasks.filter(s => s.id !== id) }));

  const saveSubtaskEdit = (id) => {
    if (!editingSubText.trim()) return;
    setModalData(p => ({
      ...p,
      subtasks: p.subtasks.map(s => s.id === id ? { ...s, text: editingSubText.trim() } : s),
    }));
    setEditingSubId(null);
    setEditingSubText("");
  };

  // ── Labels ────────────────────────────────────────────────────────────────────
  const toggleLabel = (id) =>
    setModalData(p => ({
      ...p,
      labels: p.labels.includes(id) ? p.labels.filter(l => l !== id) : [...p.labels, id],
    }));

  // ── Attachments ───────────────────────────────────────────────────────────────
  const handleFileAttach = (e) => {
    const newAtts = Array.from(e.target.files).map(file => ({
      id: Date.now() + Math.random(),
      name: file.name, size: file.size, type: file.type,
      url: URL.createObjectURL(file), file,
    }));
    setModalData(p => ({ ...p, attachments: [...p.attachments, ...newAtts] }));
  };

  const removeAttachment = async (att) => {
    try {
      if (att._id) await deleteAttachment(task._id, att._id);
      setModalData(p => ({
        ...p, attachments: p.attachments.filter(a => (a.id ?? a._id) !== (att.id ?? att._id)),
      }));
    } catch { onError("Failed to delete attachment"); }
  };

  // ── Users ─────────────────────────────────────────────────────────────────────
const handleAssignUsers = (user) => {
  const prev = Array.isArray(modalData.assignedTo)
    ? modalData.assignedTo
    : [];

  const alreadyAssigned = prev.some(
    (p) => String(p._id) === String(user._id)
  );

  if (alreadyAssigned) return prev;

  const updated = [...prev, user];

  setModalData((p) => ({
    ...p,
    assignedTo: updated,
  }));

  return updated;
};


  const handleUnassignUser = (userId) => {
    const updated = modalData.assignedTo.filter(u => u._id !== userId);
    setModalData(p => ({ ...p, assignedTo: updated }));
    return updated;
  };

  // ── Comments ──────────────────────────────────────────────────────────────────
  const handleAddComment = async () => {
    const text = newComment.trim();
    if (!text) return;
    const temp = {
      _id: "temp-" + Date.now(), text,
      createdAt: new Date().toISOString(),
      author: JSON.parse(localStorage.getItem("user") || "{}"),
    };
    const prev = modalData.comments;
    setModalData(p => ({ ...p, comments: [...p.comments, temp] }));
    setNewComment("");
    try {
      const res = await addComment(task._id, { text });
      setModalData(p => ({ ...p, comments: p.comments.map(c => c._id === temp._id ? res.data : c) }));
    } catch {
      setModalData(p => ({ ...p, comments: prev }));
      onError("Failed to add comment");
    }
  };

  const handleDeleteComment = async (id) => {
    const prev = modalData.comments;
    setModalData(p => ({ ...p, comments: p.comments.filter(c => c._id !== id) }));
    try { await deleteComment(task._id, id); }
    catch {
      setModalData(p => ({ ...p, comments: prev }));
      onError("Failed to delete comment");
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!modalData.title.trim()) { onError("Task title is required"); return; }
    setSaving(true);
    try {
      await updateTask(task._id, {
        title:            modalData.title,
        description:      modalData.description,
        priority:         modalData.priority,
        dueDate:          modalData.dueDate,
        columnId:         modalData.columnId,
        assignedTo:       modalData.assignedTo.map(u => u._id),
        labels:           modalData.labels,
        subtasks:         modalData.subtasks,
        estimatedMinutes: modalData.estimatedMinutes,
        trackedSeconds:   modalData.trackedSeconds,
      });
      const newFiles = modalData.attachments.filter(a => a.file).map(a => a.file);
      if (newFiles.length > 0) await uploadAttachments(task._id, newFiles);
      onSave();
      onClose();
    } catch { onError("Failed to update task"); }
    finally { setSaving(false); }
  };

  // ── Copy task ID ──────────────────────────────────────────────────────────────
  const copyTaskId = () => {
    navigator.clipboard?.writeText(task._id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden"
        style={{ animation: "slideUp 0.25s ease-out" }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── HEADER ── */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 sm:px-6 py-4 flex items-start gap-4 flex-shrink-0">
          <div className="flex-1 min-w-0">
            {/* Task ID + copy */}
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-white/50 text-[11px] font-mono tracking-wider select-none">
                #{task._id?.slice(-6).toUpperCase()}
              </span>
              <button onClick={copyTaskId} title="Copy task ID" className="p-0.5 rounded hover:bg-white/20 transition-colors">
                {copied
                  ? <svg className="w-3 h-3 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  : <svg className="w-3 h-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                }
              </button>
            </div>
            <h2 className="text-base sm:text-xl font-bold text-white truncate leading-tight">{task.title}</h2>
            {/* Active label chips */}
            {modalData.labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {modalData.labels.map(lid => {
                  const l = LABEL_OPTIONS.find(o => o.id === lid);
                  return l ? (
                    <span key={lid} className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: l.bg, color: l.color }}>
                      {l.name}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex-shrink-0" aria-label="Close">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Subtask progress strip ── */}
        {modalData.subtasks.length > 0 && (
          <div className="h-1.5 bg-gray-100 flex-shrink-0">
            <div
              className="h-full transition-all duration-500 rounded-r-full"
              style={{ width: `${subtaskPct}%`, background: subtaskPct === 100 ? "#10b981" : "#6366f1" }}
            />
          </div>
        )}

        {/* ── TABS ── */}
        <div className="flex border-b border-gray-200 px-2 sm:px-4 overflow-x-auto flex-shrink-0 bg-white">
          {TABS.map(t => (
            <TabButton
              key={t} label={t} active={tab === t}
              count={
                t === "Subtasks" ? modalData.subtasks.length    :
                t === "Files"    ? modalData.attachments.length :
                t === "Comments" ? modalData.comments.length    : null
              }
              onClick={() => setTab(t)}
            />
          ))}
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4 sm:p-6 space-y-5">

            {/* ═══════════════ DETAILS ═══════════════ */}
            {tab === "Details" && (<>

              {/* Title */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Title *</label>
                <input
                  type="text"
                  className="w-full bg-gray-50 border-2 border-gray-200 focus:border-indigo-400 px-3 sm:px-4 py-2.5 rounded-xl outline-none transition-all text-base font-medium"
                  value={modalData.title}
                  onChange={e => setModalData(p => ({ ...p, title: e.target.value }))}
                  placeholder="Task title…"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
                <textarea
                  rows={3}
                  className="w-full bg-gray-50 border-2 border-gray-200 focus:border-indigo-400 px-3 sm:px-4 py-2.5 rounded-xl outline-none transition-all resize-none text-sm"
                  value={modalData.description}
                  onChange={e => setModalData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Add a description…"
                />
              </div>

              {/* Priority + Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Priority</label>
                  <div className="flex gap-1.5">
                    {["low", "medium", "high"].map(p => (
                      <button
                        key={p}
                        onClick={() => setModalData(d => ({ ...d, priority: p }))}
                        className={`flex-1 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all ${
                          modalData.priority === p
                            ? p === "high"   ? "bg-red-500 text-white shadow-md"
                            : p === "medium" ? "bg-yellow-500 text-white shadow-md"
                            :                  "bg-green-500 text-white shadow-md"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Due Date
                    {dueDateStatus && (
                      <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] border ${dueDateStatus.cls}`}>
                        {dueDateStatus.label}
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    className="w-full bg-gray-50 border-2 border-gray-200 focus:border-indigo-400 px-3 sm:px-4 py-2 rounded-xl outline-none transition-all text-sm"
                    value={modalData.dueDate}
                    onChange={e => setModalData(p => ({ ...p, dueDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* ── LABELS ── */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Labels</label>
                <div className="flex flex-wrap gap-2">
                  {LABEL_OPTIONS.map(l => {
                    const active = modalData.labels.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        onClick={() => toggleLabel(l.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-all ${
                          active ? "shadow-sm scale-105" : "opacity-50 hover:opacity-80"
                        }`}
                        style={{ background: active ? l.bg : "transparent", color: l.color, borderColor: l.color }}
                      >
                        {active && "✓ "}{l.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── STATUS (column selector) ── */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Status</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {columns.map((col, idx) => {
                    const accent = COLUMN_ACCENT[idx % COLUMN_ACCENT.length];
                    const active = modalData.columnId === col._id;
                    return (
                      <button
                        key={col._id}
                        onClick={() => setModalData(p => ({ ...p, columnId: col._id }))}
                        className="px-3 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all text-white"
                        style={{
                          background: accent,
                          opacity: active ? 1 : 0.65,
                          transform: active ? "scale(1.04)" : "scale(1)",
                          boxShadow: active ? `0 0 0 3px ${accent}40` : "none",
                        }}
                      >
                        {col.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── TIME TRACKING ── */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Time Tracking</label>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Estimate */}
                  <div className="flex-1 w-full">
                    <p className="text-[11px] text-gray-400 mb-1 font-medium">Estimate (minutes)</p>
                    <input
                      type="number" min="0" step="15"
                      className="w-full bg-white border-2 border-gray-200 focus:border-indigo-400 px-3 py-1.5 rounded-lg outline-none transition-all text-sm"
                      placeholder="e.g. 60"
                      value={modalData.estimatedMinutes}
                      onChange={e => setModalData(p => ({ ...p, estimatedMinutes: e.target.value }))}
                    />
                    {estMins > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                          <span>{trackedMins}m tracked</span>
                          <span>{estMins}m estimate · {timeProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${timeProgress}%`,
                              background: timeProgress >= 100 ? "#ef4444" : "#6366f1",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Live timer */}
                  <div className="flex sm:flex-col items-center gap-3 sm:gap-2 flex-shrink-0">
                    <span className="font-mono text-xl font-bold text-gray-700 tabular-nums">
                      {formatTimer(modalData.trackedSeconds)}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setTimerRunning(r => !r)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          timerRunning
                            ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                            : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                        }`}
                      >
                        {timerRunning ? "⏸ Pause" : "▶ Start"}
                      </button>
                      <button
                        onClick={() => { setTimerRunning(false); setModalData(p => ({ ...p, trackedSeconds: 0 })); }}
                        className="px-2 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
                        title="Reset"
                      >↺</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── ASSIGNEES ── */}
              <UserAssignmentDropdown
                assignedUsers={modalData.assignedTo || []}
                onAssign={handleAssignUsers}
                onUnassign={handleUnassignUser}
              />

              {/* ── TASK META ── */}
              <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Task Information</h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div><p className="text-gray-400 mb-0.5">Created</p><p className="font-medium text-gray-700">{formatDate(task.createdAt)}</p></div>
                  <div><p className="text-gray-400 mb-0.5">Updated</p><p className="font-medium text-gray-700">{formatDate(task.updatedAt)}</p></div>
                  <div><p className="text-gray-400 mb-0.5">Task ID</p><p className="font-mono text-gray-600 text-[11px]">#{task._id?.slice(-8).toUpperCase()}</p></div>
                  <div><p className="text-gray-400 mb-0.5">Comments</p><p className="font-medium text-gray-700">{modalData.comments.length}</p></div>
                </div>
              </div>
            </>)}

            {/* ═══════════════ SUBTASKS ═══════════════ */}
            {tab === "Subtasks" && (<>
              {/* Progress ring summary */}
              {modalData.subtasks.length > 0 && (
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                  <ProgressRing pct={subtaskPct} />
                  <div>
                    <p className="text-sm font-bold text-gray-800">
                      {completedCount} / {modalData.subtasks.length} completed
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {subtaskPct === 100 ? "🎉 All subtasks done!" : `${modalData.subtasks.length - completedCount} remaining`}
                    </p>
                  </div>
                </div>
              )}

              {/* Add subtask */}
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 bg-gray-50 border-2 border-gray-200 focus:border-indigo-400 px-3 py-2 rounded-xl outline-none transition-all text-sm"
                  placeholder="Add a subtask…"
                  value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addSubtask()}
                />
                <button
                  onClick={addSubtask}
                  disabled={!newSubtask.trim()}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white rounded-xl transition-all font-bold"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>

              {/* Subtask list */}
              {modalData.subtasks.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  <svg className="w-10 h-10 mx-auto text-gray-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <p className="text-gray-400 text-sm font-medium">No subtasks yet</p>
                  <p className="text-gray-300 text-xs mt-0.5">Break this task into smaller steps</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {modalData.subtasks.map(sub => (
                    <div
                      key={sub.id}
                      className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        sub.done ? "bg-green-50 border-green-100" : "bg-white border-gray-200 hover:border-indigo-200"
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSubtask(sub.id)}
                        className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          sub.done ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-indigo-400"
                        }`}
                      >
                        {sub.done && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                      </button>

                      {/* Text / inline edit */}
                      {editingSubId === sub.id ? (
                        <input
                          autoFocus
                          type="text"
                          className="flex-1 bg-white border border-indigo-300 rounded-lg px-2 py-1 text-sm outline-none"
                          value={editingSubText}
                          onChange={e => setEditingSubText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter")  saveSubtaskEdit(sub.id);
                            if (e.key === "Escape") { setEditingSubId(null); setEditingSubText(""); }
                          }}
                        />
                      ) : (
                        <span className={`flex-1 text-sm leading-snug ${sub.done ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {sub.text}
                        </span>
                      )}

                      {/* Actions */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {editingSubId === sub.id
                          ? <button onClick={() => saveSubtaskEdit(sub.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            </button>
                          : <button onClick={() => { setEditingSubId(sub.id); setEditingSubText(sub.text); }} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                        }
                        <button onClick={() => deleteSubtask(sub.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>)}

            {/* ═══════════════ FILES ═══════════════ */}
            {tab === "Files" && (<>
              <label className="cursor-pointer flex items-center justify-center gap-2 px-4 py-5 bg-gradient-to-br from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border-2 border-dashed border-indigo-300 hover:border-indigo-400 rounded-xl transition-all text-indigo-700 font-medium text-sm w-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Click or drop to upload files
                <input type="file" multiple className="hidden" onChange={handleFileAttach} accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.zip" />
              </label>

              {modalData.attachments.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  <svg className="w-10 h-10 mx-auto text-gray-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <p className="text-gray-400 text-sm">No files attached yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {modalData.attachments.map(att => {
                    const key   = att._id || att.id;
                    const src   = att._id ? `http://localhost:3000/api${att.url}` : att.url;
                    const dlUrl = att._id ? getDownloadUrl(task._id, att._id) : att.url;
                    return (
                      <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-indigo-200 group transition-colors">
                        <div className="flex-shrink-0">
                          {att.type?.startsWith("image/") ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200">
                              <img src={src} alt={att.originalName || att.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{att.originalName || att.name}</p>
                          <p className="text-xs text-gray-400">{formatFileSize(att.size)}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={dlUrl} download={att.originalName || att.name} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg" onClick={e => e.stopPropagation()}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </a>
                          <button onClick={() => removeAttachment(att)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>)}

            {/* ═══════════════ COMMENTS ═══════════════ */}
            {tab === "Comments" && (<>
              {/* Input row */}
              <div className="flex gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                  {initials(JSON.parse(localStorage.getItem("user") || "{}").name)}
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-gray-50 border-2 border-gray-200 focus:border-indigo-400 px-3 py-2 rounded-xl outline-none transition-all text-sm"
                    placeholder="Write a comment…"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddComment()}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Comments list */}
              {modalData.comments.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  <svg className="w-10 h-10 mx-auto text-gray-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-gray-400 text-sm">No comments yet — be the first!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {modalData.comments.map(c => (
                    <div key={c._id} className="flex gap-3 group">
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {initials(c.author?.name)}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-200 hover:border-indigo-200 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-700">{c.author?.name || "User"}</span>
                            <span className="text-[10px] text-gray-400">{formatCommentTime(c.createdAt)}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteComment(c._id)}
                            className="p-1 hover:bg-red-50 text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed break-words">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>)}

          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            onClick={() => { onDelete(task._id); onClose(); }}
            className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm order-2 sm:order-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Task
          </button>
          <div className="flex gap-2 order-1 sm:order-2">
            <button onClick={onClose} className="flex-1 sm:flex-none px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold text-sm transition-all">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all text-sm flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Saving…
                </>
              ) : "Save Changes"}
            </button>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}