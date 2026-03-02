/* eslint-disable react-hooks/set-state-in-effect */
// components/BoardSwitcher.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getBoard, getBoardsByProject } from "../services/board.service";

export default function BoardSwitcher({ currentBoardId, darkMode, projectId }) {
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [currentBoardName, setCurrentBoardName] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!currentBoardId) return;
    setLoading(true);
    setCurrentBoardName("");
    setBoards([]);
    getBoard(currentBoardId)
      .then(res => {
        const board = res.data;
        setCurrentBoardName(board?.name || "");
        const projectId = board?.project?._id || board?.project;
        if (!projectId) return Promise.reject("no project");
        return getBoardsByProject(projectId);
      })
      .then(res => setBoards(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentBoardId]);

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

  const displayName = currentBoardName || boards.find(b => b._id === currentBoardId)?.name || "Board";

  const switchTo = (id) => {
    setOpen(false);
    navigate(`/boards/${id}`);
  };

  return (
    <div className="relative flex-shrink-0" ref={ref}>
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
        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        <span className="max-w-[80px] sm:max-w-[120px] md:max-w-[160px] truncate">
          {loading ? "Loading…" : displayName}
        </span>
        {boards.length >= 2 && (
          <svg
            className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""} ${darkMode ? "text-gray-400" : "text-gray-400"}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && boards.length >= 2 && (
        <div
          className={`absolute left-0 top-full mt-2 z-50 min-w-[200px] sm:min-w-[240px] max-w-xs rounded-2xl border shadow-2xl overflow-hidden ${
            darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          }`}
          role="listbox"
          aria-label="Select a board"
        >
          <div className={`px-3 py-2.5 border-b text-[11px] font-bold uppercase tracking-wider ${
            darkMode ? "border-gray-700 text-gray-400 bg-gray-900/50" : "border-gray-100 text-gray-400 bg-gray-50/80"
          }`}>
            Switch Board
          </div>

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