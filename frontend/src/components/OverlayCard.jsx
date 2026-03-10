// components/OverlayCard.jsx
export default function OverlayCard({ task }) {
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