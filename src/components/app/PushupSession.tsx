import { useCallback, useEffect, useRef, useState } from "react";

type Landmark = { x: number; y: number; z: number; visibility?: number };

const CONNECTIONS: [number, number][] = [
  // arms
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  // torso + legs
  [11, 23],
  [23, 25],
  [25, 27],
  [12, 24],
  [24, 26],
  [26, 28],
  [11, 12],
  [23, 24],
];

/** Every detected rep is worth exactly one minute, credited live. */
export const MINUTES_PER_REP = 1;

export function PushupSession({
  onRep,
  onFinish,
  onCancel,
}: {
  /** Fired the instant a rep completes — credits MINUTES_PER_REP immediately. */
  onRep: (minutes: number) => void;
  onFinish: (result: { reps: number; seconds: number; minutes: number }) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef<"up" | "down">("up");
  const repsRef = useRef(0);
  const doneRef = useRef(false);
  const startRef = useRef(0);
  const onRepRef = useRef(onRep);
  onRepRef.current = onRep;

  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [reps, setReps] = useState(0);
  const [status, setStatus] = useState("Camera off");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ reps: number; seconds: number; minutes: number } | null>(
    null,
  );

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    stop();
    setRunning(false);
    const seconds = Math.round((performance.now() - startRef.current) / 1000);
    setResult({
      reps: repsRef.current,
      seconds,
      minutes: repsRef.current * MINUTES_PER_REP,
    });
  }, [stop]);

  const begin = useCallback(async () => {
    doneRef.current = false;
    repsRef.current = 0;
    phaseRef.current = "up";
    setReps(0);
    setResult(null);
    setStatus("Loading pose model…");
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      startRef.current = performance.now();
      setRunning(true);
      setStatus("Get into position — side view works best.");

      const loop = () => {
        if (doneRef.current) return;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const res = landmarker.detectForVideo(video, performance.now());
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const lm = res.landmarks?.[0] as Landmark[] | undefined;

        if (lm) {
          ctx.strokeStyle = "#E8B62C";
          ctx.fillStyle = "#FFFFFF";
          ctx.lineWidth = Math.max(1.5, canvas.width / 500);
          for (const [a, b] of CONNECTIONS) {
            const p = lm[a];
            const q = lm[b];
            if (!p || !q) continue;
            ctx.beginPath();
            ctx.moveTo(p.x * canvas.width, p.y * canvas.height);
            ctx.lineTo(q.x * canvas.width, q.y * canvas.height);
            ctx.stroke();
          }
          for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
            const p = lm[i];
            if (!p) continue;
            ctx.beginPath();
            ctx.arc(p.x * canvas.width, p.y * canvas.height, ctx.lineWidth * 1.6, 0, Math.PI * 2);
            ctx.fill();
          }

          // rep detection: shoulder height relative to elbow height
          const sy = (lm[11].y + lm[12].y) / 2;
          const ey = (lm[13].y + lm[14].y) / 2;
          const d = sy - ey; // negative when shoulders above elbows
          if (phaseRef.current === "up" && d > -0.02) {
            phaseRef.current = "down";
            setStatus("Down");
          } else if (phaseRef.current === "down" && d < -0.09) {
            // full down-to-up cycle = one rep = one minute, credited now
            phaseRef.current = "up";
            repsRef.current += 1;
            setReps(repsRef.current);
            setStatus("Up · +1 min");
            onRepRef.current(MINUTES_PER_REP);
          }
        } else {
          setStatus("No person detected");
        }

        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      setStatus("Camera or pose model unavailable.");
    }
  }, [facing]);

  // Restart the stream when the camera is flipped mid-session.
  const flipCamera = useCallback(async () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (!running) return;
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: next }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
    } catch {
      setStatus("Could not switch camera.");
    }
  }, [facing, running]);

  useEffect(() => stop, [stop]);

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-center sheet-solid px-6">
        <div className="label-caps">Session complete</div>
        <div className="mt-4 font-mono text-6xl">{result.reps}</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          REPS · {result.seconds}s ELAPSED
        </div>
        <div className="mt-6 hairline-top pt-4 font-mono text-sm">
          <span style={{ color: "var(--accent)" }}>+{result.minutes} MIN EARNED</span>
        </div>
        <button
          onClick={() => onFinish(result)}
          className="mt-8 w-full border border-[var(--accent)] py-3 font-mono text-sm tracking-widest text-[var(--accent)]"
        >
          RETURN
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col sheet-solid">
      <header className="flex items-center justify-between px-5 py-4 hairline-bottom">
        <div>
          <div className="label-caps">Pushup session</div>
          <h2 className="font-display text-lg">1 pushup = 1 minute</h2>
        </div>
        <button
          onClick={() => {
            stop();
            onCancel();
          }}
          className="label-caps hover:text-foreground"
        >
          Close
        </button>
      </header>

      <div className="relative flex-1 overflow-hidden bg-[#14161A]">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />

        <div className="absolute left-5 top-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/70">
            Reps
          </div>
          <div className="font-mono text-5xl leading-none text-white">{reps}</div>
          <div className="mt-1 font-mono text-xs" style={{ color: "#E8B62C" }}>
            +{reps * MINUTES_PER_REP} MIN EARNED
          </div>
        </div>

        {/* camera switch is always available during capture */}
        <button
          onClick={flipCamera}
          className="absolute right-4 top-4 border border-white/40 bg-black/30 px-3 py-2 font-mono text-[11px] tracking-widest text-white backdrop-blur"
        >
          {facing === "user" ? "FRONT" : "BACK"} ⇄
        </button>

        <p className="absolute inset-x-0 bottom-4 text-center font-mono text-xs text-white/70">
          {status}
        </p>
      </div>

      <div className="flex gap-3 px-5 py-5 hairline-top">
        {!running ? (
          <button
            onClick={begin}
            className="w-full border border-[var(--accent)] py-3 font-mono text-sm tracking-widest text-[var(--accent)]"
          >
            START
          </button>
        ) : (
          <button
            onClick={finish}
            className="w-full border border-[var(--destructive)] py-3 font-mono text-sm tracking-widest lift"
            style={{ color: "var(--destructive)" }}
          >
            STOP
          </button>
        )}
      </div>
    </div>
  );
}
