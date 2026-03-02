/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { socketService } from "../services/socket.service";

export default function LiveIndicator({ darkMode }) {
  const [status, setStatus] = useState("connecting"); 

  useEffect(() => {
    const socket = socketService.connect();

    const onConnect    = () => setStatus("connected");
    const onDisconnect = () => setStatus("disconnected");

    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);

    // Set initial status
    setStatus(socket.connected ? "connected" : "connecting");

    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  const config = {
    connected:    { dot: "bg-emerald-400", ring: "ring-emerald-400/30", label: "Live",         pulse: true  },
    connecting:   { dot: "bg-amber-400",   ring: "ring-amber-400/30",   label: "Connecting…",  pulse: true  },
    disconnected: { dot: "bg-red-400",     ring: "ring-red-400/30",     label: "Offline",      pulse: false },
  };

  const { dot, label, pulse } = config[status];

  return (
    <div
      title={`WebSocket: ${label}`}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold select-none transition-colors ${
        darkMode
          ? "bg-gray-800/80 border-gray-700 text-gray-300"
          : "bg-white/70 border-gray-200 text-gray-600"
      }`}
    >
      <span className={`relative flex h-2 w-2`}>
        {pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dot} opacity-60`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dot}`} />
      </span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}