import { useCallback, useEffect, useRef, useState } from "react";
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
      setError("Camera unavailable. Allow camera access to submit proof.");
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col sheet-solid">
      <header className="flex items-center justify-between px-5 py-4 hairline-bottom">
        <div>
          <div className="label-caps">Proof required</div>
          <h2 className="font-display text-lg">{task.name}</h2>
        </div>
        <button onClick={onClose} className="label-caps hover:text-foreground">
          Close
        </button>
      </header>

      <div className="relative flex-1 overflow-hidden bg-[#14161A]">
        {shot ? (
          <img src={shot} alt="Captured proof" className="h-full w-full object-contain" />
        ) : (
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        )}

        {!shot && (
          <button
            onClick={flipCamera}
            className="absolute right-4 top-4 border border-white/40 bg-black/30 px-3 py-2 font-mono text-[11px] tracking-widest text-white backdrop-blur"
          >
            {facing === "user" ? "FRONT" : "BACK"} ⇄
          </button>
        )}

        {error && (
          <p className="absolute inset-x-0 bottom-6 px-6 text-center text-sm text-white/80">
            {error}
          </p>
        )}
      </div>

      <div className="px-5 py-5 hairline-top">
        {verdict && (
          <div
            className="mb-4 flex items-start gap-3 border-l-2 pl-3"
            style={{
              borderColor: verdict.verdict === "APPROVED" ? "var(--accent)" : "var(--destructive)",
            }}
          >
            <span
              className="font-mono text-xs tracking-widest"
              style={{
                color: verdict.verdict === "APPROVED" ? "var(--accent)" : "var(--destructive)",
              }}
            >
              {verdict.verdict}
            </span>
            <span className="text-sm text-muted-foreground">{verdict.reason}</span>
          </div>
        )}

        <div className="mb-3 flex items-center justify-between font-mono text-xs text-muted-foreground">
          <span>+{task.minutes} MIN</span>
          <span>UNLIMITED ATTEMPTS</span>
        </div>

        {verdict?.verdict === "APPROVED" ? (
          <button
            onClick={onClose}
            className="w-full border border-[var(--accent)] py-3 font-mono text-sm tracking-widest text-[var(--accent)]"
          >
            DONE
          </button>
        ) : !shot ? (
          <button
            onClick={capture}
            disabled={!!error}
            className="w-full border border-[var(--accent)] py-3 font-mono text-sm tracking-widest text-[var(--accent)] disabled:opacity-40"
          >
            CAPTURE
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={retake}
              className="flex-1 border border-[var(--hairline)] py-3 font-mono text-sm tracking-widest text-muted-foreground"
            >
              RETAKE
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="flex-1 border border-[var(--accent)] py-3 font-mono text-sm tracking-widest text-[var(--accent)] disabled:opacity-40"
            >
              {busy ? "VERIFYING…" : "SUBMIT"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
