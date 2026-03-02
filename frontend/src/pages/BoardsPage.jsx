/* eslint-disable no-unused-vars */
import { useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import {
  getBoardsByProject,
  createBoard,
  deleteBoard,
  updateBoard,
} from "../services/board.service";
import { getProjectById } from "../services/project.service";
import { socketService } from "../services/socket.service";

export default function BoardsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [projectName, setProjectName] = useState("");
  const [boards, setBoards]           = useState([]);
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);
  const [viewMode, setViewMode]       = useState("grid");
  const [showForm, setShowForm]       = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteModal, setDeleteModal] = useState({ open: false, boardId: null });

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [boardsRes, projectRes] = await Promise.all([
        getBoardsByProject(projectId),
        getProjectById(projectId),
      ]);
      setBoards(boardsRes.data);
      setProjectName(projectRes.data.name);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }
      setError("Failed to load boards");
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => {
    if (!localStorage.getItem("token")) { navigate("/login"); return; }
    load();
  }, [load, navigate]);

  // ── Real-time: join project room ──────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;

    const socket = socketService.connect();
    const room   = `project:${projectId}`;
    socketService.joinBoard(room);

    // Other clients' creates arrive here (sender is excluded by x-socket-id)
    const handleCreated = ({ board }) =>
      setBoards(prev =>
        prev.some(b => b._id === board._id) ? prev : [...prev, board]
      );

    const handleUpdated = ({ board }) =>
      setBoards(prev => prev.map(b => b._id === board._id ? board : b));

    const handleDeleted = ({ boardId }) => {
      setBoards(prev => prev.filter(b => b._id !== boardId));
      setDeleteModal(prev =>
        prev.boardId === boardId ? { open: false, boardId: null } : prev
      );
    };

    socket.on("board:created", handleCreated);
    socket.on("board:updated", handleUpdated);
    socket.on("board:deleted", handleDeleted);

    return () => {
      socket.off("board:created", handleCreated);
      socket.off("board:updated", handleUpdated);
      socket.off("board:deleted", handleDeleted);
      socketService.leaveBoard(room);
    };
  }, [projectId]);

  // ── Form ──────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setName("");
    setDescription("");
    setEditingId(null);
    setShowForm(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true);
      const payload = { name: name.trim(), description };

      if (editingId) {
        const res = await updateBoard(editingId, payload);
        // Apply locally — other clients get it via socket
        setBoards(prev => prev.map(b => b._id === editingId ? res.data : b));
      } else {
        const res = await createBoard({ ...payload, projectId });
        // Creator is excluded from their own socket broadcast, so add locally
        setBoards(prev =>
          prev.some(b => b._id === res.data._id) ? prev : [...prev, res.data]
        );
      }

      resetForm();
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }
      setError("Failed to save board");
      load(); // fallback resync
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (b) => {
    setEditingId(b._id);
    setName(b.name);
    setDescription(b.description || "");
    setShowForm(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteClick = (id) => setDeleteModal({ open: true, boardId: id });

  const confirmDelete = async () => {
    const id = deleteModal.boardId;
    // Optimistically close modal and remove from list
    setDeleteModal({ open: false, boardId: null });
    setBoards(prev => prev.filter(b => b._id !== id));

    try {
      await deleteBoard(id);
      // Other clients notified via socket
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }
      setError("Failed to delete board");
      load(); // restore the board on error
    }
  };

  const filteredBoards = boards.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="w-20 h-20 border-4 border-indigo-200/20 rounded-full"></div>
            <div className="absolute top-0 left-0 w-20 h-20 border-4 border-t-indigo-500 border-r-indigo-500 rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-lg font-semibold text-indigo-200">Loading your boards...</p>
        </div>
      </div>
    );
  }

  // ── Gradient palette ──────────────────────────────────────────────────────
  const gradients = [
    { from: "from-indigo-500",  to: "to-purple-600",  shadow: "shadow-indigo-500/20"  },
    { from: "from-cyan-500",    to: "to-blue-600",    shadow: "shadow-cyan-500/20"    },
    { from: "from-violet-500",  to: "to-fuchsia-600", shadow: "shadow-violet-500/20"  },
    { from: "from-emerald-500", to: "to-teal-600",    shadow: "shadow-emerald-500/20" },
    { from: "from-rose-500",    to: "to-pink-600",    shadow: "shadow-rose-500/20"    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">

      {/* ── Header ── */}
      <div className="sticky top-0 z-30 backdrop-blur-2xl bg-slate-900/60 border-b border-indigo-500/20 shadow-2xl shadow-indigo-500/5">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

            <div className="flex items-center gap-4 w-full sm:w-auto">
              <button
                onClick={() => navigate("/")}
                className="group flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border border-indigo-500/30 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/20"
              >
                <svg className="w-4 h-4 text-indigo-300 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-semibold text-indigo-200 hidden sm:inline">Go To Projects</span>
              </button>

              <div className="h-8 w-px bg-indigo-500/20 hidden sm:block" />

              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/30">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 bg-clip-text text-transparent">
                    {projectName || "Project"}
                  </h1>
                  <p className="text-xs text-indigo-400">Manage boards</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Live indicator */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 border border-indigo-500/20 rounded-xl">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="text-xs font-semibold text-emerald-300 hidden sm:inline">Live</span>
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-1 p-1 bg-slate-800/50 rounded-lg border border-indigo-500/20">
                {["grid", "list"].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    title={`${mode} view`}
                    className={`p-2 rounded-md transition-all ${viewMode === mode ? "bg-indigo-500 text-white shadow-lg" : "text-indigo-300 hover:text-indigo-200"}`}
                  >
                    {mode === "grid" ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              <div className="px-4 py-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl">
                <span className="text-sm font-bold text-indigo-200">
                  {boards.length} {boards.length === 1 ? "Board" : "Boards"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Error banner ── */}
        {error && (
          <div className="mb-6 bg-red-500/10 backdrop-blur-xl border border-red-500/30 rounded-2xl p-4 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-red-300 text-sm">Error</h3>
                <p className="text-sm text-red-200/80">{error}</p>
              </div>
            </div>
            <button onClick={() => setError(null)} className="p-1 text-red-300 hover:text-red-100 rounded-lg hover:bg-red-500/20 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Search ── */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search boards by name or description..."
              className="w-full bg-slate-800/50 backdrop-blur-xl border-2 border-indigo-500/30 focus:border-indigo-500 pl-12 pr-4 py-3.5 rounded-xl outline-none text-indigo-100 placeholder-indigo-400/50 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-indigo-500/20 transition-colors">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-indigo-300/70 pl-1">
              {filteredBoards.length} {filteredBoards.length === 1 ? "result" : "results"} for "{searchQuery}"
            </p>
          )}
        </div>

        {/* ── Create / Edit form ── */}
        <div className={`mb-8 overflow-hidden transition-all duration-500 ${showForm ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
          <form onSubmit={submit} className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-2xl border border-indigo-500/30 p-6 rounded-2xl shadow-2xl shadow-indigo-500/10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={editingId
                      ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      : "M12 6v6m0 0v6m0-6h6m-6 0H6"
                    } />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-indigo-100">
                  {editingId ? "Edit Board" : "Create New Board"}
                </h3>
              </div>
              <button type="button" onClick={resetForm} className="p-2 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-500/10 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-indigo-300 mb-2">Board Name *</label>
                <input
                  className="w-full bg-slate-900/50 border-2 border-indigo-700/50 focus:border-indigo-500 px-4 py-3 rounded-xl outline-none text-indigo-100 placeholder-indigo-400/40 transition-all"
                  placeholder="e.g., Product Roadmap"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-indigo-300 mb-2">Description</label>
                <input
                  className="w-full bg-slate-900/50 border-2 border-indigo-700/50 focus:border-indigo-500 px-4 py-3 rounded-xl outline-none text-indigo-100 placeholder-indigo-400/40 transition-all"
                  placeholder="Brief description (optional)"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-xl font-bold shadow-lg hover:shadow-indigo-500/30 transform hover:scale-105 active:scale-95 transition-all disabled:cursor-not-allowed disabled:scale-100"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Saving...
                  </span>
                ) : editingId ? "Update Board" : "Create Board"}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-indigo-200 rounded-xl font-semibold transition-all">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ── Empty state ── */}
        {filteredBoards.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500/30 rounded-full mb-6 animate-pulse">
              <svg className="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-indigo-200 mb-2">
              {searchQuery ? "No boards found" : "No boards yet"}
            </h3>
            <p className="text-indigo-300/70 mb-8 max-w-md mx-auto">
              {searchQuery
                ? `No boards match "${searchQuery}". Try a different search term.`
                : "Get started by creating your first board."}
            </p>
            {!showForm && !searchQuery && (
              <button
                onClick={() => setShowForm(true)}
                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-lg hover:shadow-indigo-500/30 transform hover:scale-105 transition-all"
              >
                Create Your First Board
              </button>
            )}
          </div>
        )}

        {/* ── Delete modal ── */}
        {deleteModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl shadow-2xl p-6">
              <h2 className="text-lg font-semibold text-white">Delete Board Permanently?</h2>
              <p className="text-gray-400 mt-3 text-sm leading-relaxed">
                This board and all related tasks will be permanently deleted.
                <span className="block mt-2 text-red-400 font-medium">This action cannot be undone.</span>
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setDeleteModal({ open: false, boardId: null })}
                  className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition shadow-lg"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Board grid / list ── */}
        {filteredBoards.length > 0 && (
          <div className={viewMode === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            : "space-y-4"
          }>
            {filteredBoards.map((b, index) => {
              const gradient = gradients[index % gradients.length];

              return viewMode === "grid" ? (
                /* ── Grid card ── */
                <div
                  key={b._id}
                  className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-indigo-500/30 rounded-2xl overflow-hidden hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02] transition-all duration-300"
                  style={{ animation: `slideUp 0.3s ease-out ${index * 0.05}s backwards` }}
                >
                  <Link to={`/boards/${b._id}`} className="block">
                    <div className={`bg-gradient-to-r ${gradient.from} ${gradient.to} p-6 relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="relative flex items-start justify-between">
                        <h3 className="text-xl font-bold text-white line-clamp-2 flex-1 group-hover:scale-105 transition-transform origin-left">{b.name}</h3>
                        <svg className="w-6 h-6 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="p-6">
                      <p className="text-sm text-indigo-300/70 line-clamp-3 mb-6 min-h-[60px]">
                        {b.description || "No description provided"}
                      </p>
                      <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                        <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span className="text-xs font-bold text-indigo-300 truncate">{projectName}</span>
                      </div>
                    </div>
                  </Link>
                  <div className="px-6 pb-6 flex gap-2">
                    <button
                      onClick={e => { e.preventDefault(); startEdit(b); }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-xl transition-all text-sm font-semibold"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={e => { e.preventDefault(); handleDeleteClick(b._id); }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all text-sm font-semibold"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                /* ── List row ── */
                <div
                  key={b._id}
                  className="group bg-gradient-to-r from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-indigo-500/30 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300"
                  style={{ animation: `slideUp 0.2s ease-out ${index * 0.03}s backwards` }}
                >
                  <div className="flex items-center p-6 gap-6">
                    <Link to={`/boards/${b._id}`} className="flex items-center gap-6 flex-1 min-w-0">
                      <div className={`p-4 bg-gradient-to-br ${gradient.from} ${gradient.to} rounded-xl shadow-lg ${gradient.shadow} flex-shrink-0`}>
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-indigo-100 mb-1 truncate group-hover:text-indigo-50 transition-colors">{b.name}</h3>
                        <p className="text-sm text-indigo-300/70 line-clamp-1">{b.description || "No description"}</p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={() => startEdit(b)}
                        className="p-3 bg-slate-700/50 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-xl transition-all"
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(b._id)}
                        className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <Link to={`/boards/${b._id}`}>
                        <svg className="w-6 h-6 text-indigo-400 group-hover:text-indigo-300 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── FAB ── */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="fixed bottom-8 right-8 p-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full shadow-2xl shadow-indigo-500/40 hover:shadow-indigo-500/60 transform hover:scale-110 active:scale-95 transition-all duration-300 z-40 group"
          title="Create new board"
        >
          <svg className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        .animate-slideUp   { animation: slideUp   0.4s ease-out; }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }
      `}</style>
    </div>
  );
}