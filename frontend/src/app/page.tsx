"use client";

import { useState, useCallback, useRef } from "react";

type Status = "idle" | "queued" | "downloading" | "completed" | "failed";

interface TaskState {
  taskId: string | null;
  status: Status;
  progress: string;
  filename: string | null;
  downloadUrl: string | null;
  error: string | null;
}

const HACK_MESSAGES = [
  "INICIANDO CONEXIÓN...",
  "BYPASSING FIREWALL...",
  "EXTRAYENDO DATA...",
  "DESENCRIPTANDO STREAM...",
  "RUTEANDO PAQUETES...",
  "DESCARGANDO BLOQUES...",
  "RECONSTRUYENDO ARCHIVO...",
];

function randHackMsg(): string {
  return HACK_MESSAGES[Math.floor(Math.random() * HACK_MESSAGES.length)];
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    downloading: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
    completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    failed: "bg-rose-500/20 text-rose-400 border-rose-500/40",
    idle: "bg-slate-500/20 text-slate-400 border-slate-500/40",
  };
  const c = colors[status] || colors.idle;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-mono uppercase tracking-widest border ${c}`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          status === "completed"
            ? "bg-emerald-500 animate-pulse"
            : status === "failed"
              ? "bg-rose-500 animate-pulse"
              : status === "downloading"
                ? "bg-cyan-500 animate-ping"
                : "bg-yellow-500 animate-pulse"
        }`}
      />
      {status}
    </span>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [task, setTask] = useState<TaskState>({
    taskId: null,
    status: "idle",
    progress: "",
    filename: null,
    downloadUrl: null,
    error: null,
  });

  const pollingRef = useRef<number | null>(null);
  const [hackText, setHackText] = useState("");

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    async (taskId: string) => {
      try {
        const res = await fetch(`/api/status/${taskId}`);
        if (!res.ok) {
          stopPolling();
          setTask((t) => ({ ...t, status: "failed", error: "Error al consultar estado" }));
          return;
        }
        const data = await res.json();
        setHackText(randHackMsg());

        if (data.status === "failed") {
          stopPolling();
          setTask((t) => ({
            ...t,
            status: "failed",
            error: data.error || "La tarea falló inesperadamente.",
          }));
          return;
        }

        if (data.status === "completed") {
          stopPolling();
          setTask({
            taskId,
            status: "completed",
            progress: "",
            filename: data.filename,
            downloadUrl: data.download_url,
            error: null,
          });
          return;
        }

        setTask((t) => ({ ...t, status: data.status as Status }));
      } catch {
        stopPolling();
        setTask((t) => ({ ...t, status: "failed", error: "Pérdida de conexión con el servidor." }));
      }
    },
    [stopPolling]
  );

  const handleDownload = async () => {
    if (!url.trim()) return;

    setTask({ taskId: null, status: "queued", progress: "", filename: null, downloadUrl: null, error: null });
    setHackText("INICIANDO CONEXIÓN...");

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), quality: "best" }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setTask((t) => ({
          ...t,
          status: "failed",
          error: err.detail || err.message || "Error desconocido en el servidor.",
        }));
        return;
      }

      const data = (await res.json()) as { task_id: string; status: string };
      setTask((t) => ({ ...t, taskId: data.task_id, status: data.status as Status }));
      pollStatus(data.task_id);
      pollingRef.current = window.setInterval(() => pollStatus(data.task_id), 1500);
    } catch {
      setTask((t) => ({ ...t, status: "failed", error: "No se pudo conectar al backend." }));
    }
  };

  const triggerFileDownload = async () => {
    if (!task.downloadUrl) return;
    try {
      const res = await fetch(task.downloadUrl);
      if (!res.ok) throw new Error("Fallback failed");
      const blob = await res.blob();
      const filename = task.filename || "video.mp4";
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(task.downloadUrl, "_blank");
    }
  };

  const reset = () => {
    stopPolling();
    setUrl("");
    setTask({ taskId: null, status: "idle", progress: "", filename: null, downloadUrl: null, error: null });
    setHackText("");
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4 py-12">
      {/* Scanlines overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 4px)",
        }}
      />

      {/* Grid background */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow behind card */}
      <div className="pointer-events-none fixed z-[2] h-[600px] w-[600px] rounded-full bg-cyan-500/5 blur-[150px]" />

      <div className="relative z-10 w-full max-w-xl">
        {/* Badge + Title */}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-950/30 px-4 py-1.5 backdrop-blur-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-cyan-400 tracking-widest uppercase">
              Sistema Operativo
            </span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">
              CapturaClip
            </span>
          </h1>
          <p className="max-w-sm text-sm text-slate-500">
            Extrae medios de YouTube e Instagram directamente a tu dispositivo local.
          </p>
        </div>

        {/* Main card */}
        <div
          className="relative overflow-hidden rounded-2xl border border-cyan-500/10 bg-slate-900/40 p-1 backdrop-blur-md"
          style={{
            boxShadow:
              "0 0 30px rgba(6,182,212,0.06), 0 0 60px rgba(217,70,239,0.03), inset 0 0 30px rgba(6,182,212,0.02)",
          }}
        >
          {/* Top accent line */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

          <div className="p-6 sm:p-8">
            {/* URL Input */}
            <label className="mb-2 block text-xs font-mono uppercase tracking-widest text-cyan-400/70">
              // URL del vídeo
            </label>
            <div className="relative mb-6">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && task.status === "idle") handleDownload();
                }}
                placeholder="https://youtube.com/watch?v=..."
                disabled={task.status === "downloading" || task.status === "queued"}
                className="w-full rounded-lg border border-cyan-500/20 bg-slate-950/60 px-4 py-3.5 text-sm font-mono text-cyan-100 placeholder-cyan-700/50 outline-none transition-all duration-300 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {/* Corner decorations */}
              
              <div className="absolute -left-0.5 top-0 h-3 w-3 border-l border-t border-cyan-500/40" />
              <div className="absolute -right-0.5 bottom-0 h-3 w-3 border-b border-r border-cyan-500/40" />
            </div>

            {/* Action Button */}
            {task.status === "idle" && (
              <button
                onClick={handleDownload}
                disabled={!url.trim()}
                className="group relative w-full overflow-hidden rounded-lg border border-cyan-500/30 bg-gradient-to-r from-cyan-600/20 to-fuchsia-600/20 py-3.5 text-sm font-mono uppercase tracking-widest text-cyan-300 transition-all duration-300 hover:border-cyan-400/60 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] focus:outline-none focus:ring-2 focus:ring-cyan-400/30 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                    <polyline points="7,11 12,16 17,11" />
                    <line x1="12" y1="16" x2="12" y2="4" />
                  </svg>
                  Iniciar Extracción
                </span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 transition-transform duration-500 group-hover:translate-x-0" />
              </button>
            )}

            {task.status === "downloading" && (
              <button
                disabled
                className="relative w-full overflow-hidden rounded-lg border border-cyan-500/20 bg-cyan-950/20 py-3.5 text-sm font-mono tracking-widest text-cyan-400"
              >
                {/* Spinner */}
                <span className="absolute left-4 top-1/2 -translate-y-1/2">
                  <svg className="h-4 w-4 animate-spin text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </span>
                <span className="animate-pulse">{hackText}</span>
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-cyan-500 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" style={{ width: "100%" }} />
              </button>
            )}

            {task.status === "completed" && (
              <div className="flex gap-3">
                <button
                  onClick={triggerFileDownload}
                  className="relative flex-1 overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-950/30 py-3.5 text-sm font-mono uppercase tracking-widest text-emerald-400 transition-all duration-300 hover:border-emerald-400/60 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Descargar Archivo
                  </span>
                </button>
                <button
                  onClick={reset}
                  className="rounded-lg border border-slate-700/50 bg-slate-900/30 px-5 text-sm font-mono uppercase tracking-widest text-slate-400 transition-all hover:border-slate-600 hover:text-slate-300 focus:outline-none"
                >
                  Nueva
                </button>
              </div>
            )}

            {task.status === "failed" && (
              <div className="flex gap-3">
                <button
                  onClick={reset}
                  className="flex-1 rounded-lg border border-slate-700/50 bg-slate-900/30 py-3.5 text-sm font-mono uppercase tracking-widest text-slate-400 transition-all hover:border-slate-600 hover:text-slate-300 focus:outline-none"
                >
                  Reintentar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status card */}
        {task.taskId && task.status !== "idle" && (
          <div className="mt-4 rounded-xl border border-slate-800/50 bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <StatusBadge status={task.status} />
              <span className="text-[10px] font-mono text-slate-600">
                ID: {task.taskId?.slice(0, 8)}...
              </span>
            </div>

            {task.status === "downloading" && (
              <div className="mt-3 font-mono text-xs">
                <div className="mb-1 h-1 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-1/3 animate-[slideRight_2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500" />
                </div>
                <p className="truncate text-cyan-500/60">{hackText}</p>
              </div>
            )}

            {task.status === "completed" && task.filename && (
              <div className="mt-3 flex items-center gap-2 font-mono text-xs text-emerald-400/80">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v6a2 2 0 01-2 2H5z" />
                </svg>
                {task.filename}
              </div>
            )}

            {task.status === "failed" && task.error && (
              <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2">
                <p className="font-mono text-xs text-rose-400">
                  <span className="font-bold">[CRITICAL]</span> {task.error}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer decoration */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-cyan-500/20" />
          <div className="flex gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-500/40" />
            <div className="h-1.5 w-1.5 rounded-full bg-fuchsia-500/40" />
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/40" />
          </div>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-cyan-500/20" />
        </div>
      </div>
    </main>
  );
}
