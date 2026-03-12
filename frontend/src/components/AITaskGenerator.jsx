import { useState } from "react";
import axios from "axios";

export default function AITaskGenerator({ addTasks }) {
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);

  const generateTasks = async () => {
    if (!goal.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/ai/generate-tasks`, { goal });
      addTasks(res.data.tasks);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "Build login system",
    "Set up CI/CD pipeline",
    "Design REST API",
    "Create onboarding flow",
    "Migrate to TypeScript",
  ];

  return (
    <div className="w-full pb-3 mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-4">

      {/* Card */}
      <div
        className="rounded-2xl border border-white/90 overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 2px 12px rgba(120,80,220,0.08), 0 8px 32px rgba(120,80,220,0.06), inset 0 1px 0 rgba(255,255,255,0.95)",
        }}
      >

        {/* Top accent bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-violet-500 via-purple-400 to-fuchsia-500" />

        <div className="px-5 py-4">

          {/* ── Header ── */}
          <div className="flex items-center gap-3 mb-4">

            {/* Icon */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-violet-300/40">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>

            {/* Title + subtitle */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-indigo-950 tracking-tight leading-snug">
                AI Task Generator
              </p>
              <p className="text-xs text-gray-400 font-normal mt-0.5 truncate">
                Describe a goal — AI builds the task breakdown
              </p>
            </div>

            {/* Badge */}
            <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-widest text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2.5 py-0.5">
              ✦ AI Powered
            </span>
          </div>

          {/* ── Input + Button ── */}
          <div className="flex gap-2 mb-3">
            <input
              id="Ai"
              name="Aitask"
              type="text"
              placeholder="e.g. Build a user authentication system"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generateTasks()}
              className="flex-1 h-10 px-3.5 text-sm font-normal text-gray-800 placeholder-gray-400 bg-white/85 border border-gray-200 rounded-xl outline-none transition-all duration-150 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 focus:bg-white"
            />
            <button
              onClick={generateTasks}
              disabled={loading || !goal.trim()}
              className="h-10 px-4 flex items-center gap-1.5 text-white text-xs font-bold rounded-xl transition-all duration-150 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 whitespace-nowrap bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-600 shadow-md shadow-violet-300/50"
            >
              {loading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Generate Tasks
                </>
              )}
            </button>
          </div>

          {/* ── Quick start ── */}
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-gray-500 mb-2">
            Quick start
          </p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {quickPrompts.map((p) => (
              <button
                key={p}
                onClick={() => setGoal(p)}
                className="px-3 py-1 text-xs font-medium text-gray-500 bg-white/75 border border-gray-200 rounded-lg transition-all duration-150 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700"
              >
                {p}
              </button>
            ))}
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center gap-2 pt-3 border-t border-black/6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow shadow-emerald-200 flex-shrink-0" />
            <p className="text-xs text-gray-500 flex-1 truncate">
              Tasks are auto-assigned priority, deadlines &amp; subtasks
            </p>
            <span className="text-[11px] font-semibold text-violet-500 bg-violet-50 rounded-md px-2 py-0.5 flex-shrink-0">
              GPT-4o
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}