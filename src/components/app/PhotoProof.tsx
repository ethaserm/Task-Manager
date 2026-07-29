import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import type { Task } from "@/lib/app-state";

type Verdict = { verdict: "APPROVED" | "REJECTED"; reason: string } | null;

export function PhotoProof({
  task,
  onClose,
  onApproved,
}: {
  task: Task;
  onClose: () => void;
  onApproved: (thumb: string, reason: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (mode: "user" | "environment") => {
    setError(null);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: false,
      });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
    } catch {
      setError("Camera unavailable — allow camera access to submit proof.");
    }
  }, []);

  useEffect(() => {
    start("environment");
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [start]);

  function flipCamera() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (!shot) start(next);
  }

  function capture() {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    const w = 800;
    const scale = w / v.videoWidth;
    c.width = w;
    c.height = v.videoHeight * scale;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    setShot(c.toDataURL("image/jpeg", 0.7));
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function submit() {
    if (!shot) return;
    setBusy(true);
    setVerdict(null);
    try {
      const res = await fetch("/api/verify-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskName: task.name, criteria: task.criteria, image: shot }),
      });
      const data = (await res.json()) as { verdict: "APPROVED" | "REJECTED"; reason: string };
      setVerdict(data);
      if (data.verdict === "APPROVED") onApproved(shot, data.reason);
    } catch {
      setVerdict({ verdict: "REJECTED", reason: "Verification failed. Try again." });
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    setShot(null);
    setVerdict(null);
    start(facing);
  }

  const approved = verdict?.verdict === "APPROVED";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        {shot ? (
          <img src={shot} alt="Captured proof" className="h-full w-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
          />
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <div className="rounded-full bg-black/50 px-4 py-2 text-center backdrop-blur">
            <div className="font-display text-sm font-semibold text-white">{task.name}</div>
            <div className="text-[11px] font-medium text-[var(--accent)]">+{task.minutes} min</div>
          </div>
          {!shot ? (
            <button
              onClick={flipCamera}
              className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
              aria-label="Flip camera"
            >
              <RefreshCw size={18} />
            </button>
          ) : (
            <span className="h-10 w-10" />
          )}
        </div>

        {task.criteria && !shot && (
          <p className="absolute inset-x-6 bottom-6 rounded-2xl bg-black/60 px-4 py-3 text-center text-sm text-white/90 backdrop-blur">
            {task.criteria}
          </p>
        )}

        {error && (
          <p className="absolute inset-x-6 bottom-6 rounded-2xl bg-black/70 px-4 py-3 text-center text-sm text-white">
            {error}
          </p>
        )}
      </div>

      <div className="bg-[var(--bg)] px-5 pt-4 safe-bottom">
        {verdict && (
          <div
            className="mb-4 flex items-start gap-3 rounded-2xl p-4"
            style={{
              background: approved ? "var(--earn-soft)" : "rgba(255,107,107,0.12)",
            }}
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
              style={{
                background: approved ? "var(--accent)" : "var(--danger)",
                color: approved ? "#ffffff" : "#fff",
              }}
            >
              {approved ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
            </span>
            <span>
              <span
                className="block text-sm font-bold"
                style={{ color: approved ? "var(--accent)" : "var(--danger)" }}
              >
                {approved ? `Approved · +${task.minutes} min` : "Not approved"}
              </span>
              <span className="mt-0.5 block text-sm text-[var(--muted)]">{verdict.reason}</span>
            </span>
          </div>
        )}

        {approved ? (
          <button
            onClick={onClose}
            className="glow w-full rounded-2xl bg-[var(--accent)] py-4 text-lg font-bold text-white active:scale-[0.98]"
          >
            Nice — done
          </button>
        ) : !shot ? (
          <button
            onClick={capture}
            disabled={!!error}
            className="glow w-full rounded-2xl bg-[var(--accent)] py-4 text-lg font-bold text-white disabled:opacity-30 disabled:shadow-none active:scale-[0.98]"
          >
            Take photo
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={retake}
              className="flex-1 rounded-2xl bg-[var(--surface-2)] py-4 text-base font-semibold text-[var(--text)] active:scale-[0.98]"
            >
              Retake
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="glow flex-1 rounded-2xl bg-[var(--accent)] py-4 text-base font-bold text-white disabled:opacity-40 active:scale-[0.98]"
            >
              {busy ? "Checking…" : "Submit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
