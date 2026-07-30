import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RefreshCw, X } from "lucide-react";

type Landmark = { x: number; y: number; z: number; visibility?: number };

const CONNECTIONS: [number, number][] = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
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

const VIS = 0.5; // landmark confidence floor
const MIN_REP_MS = 400; // ignore jitter faster than a real rep
const SMOOTH = 0.4; // EMA weight on the new frame
const LOST_MS = 2000; // no body for this long = auto-pause
const REST_MS = 20000; // this long without a rep counts as a rest between sets
const DECAY = 0.0015; // how fast the calibrated range forgets old extremes
const STRAIGHT_MIN = 145; // hip angle below this is a sagging/piked back

/** Interior angle at `b` in degrees. */
function angleAt(a: Landmark, b: Landmark, c: Landmark) {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (!mag) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

const seen = (l?: Landmark) => !!l && (l.visibility ?? 1) > VIS;

/**
 * True when the torso lies closer to horizontal than vertical — i.e. they are
 * actually down in a plank, not standing or climbing off a chair. Without this
 * gate, getting into position swings the signal wildly, which both counts
 * phantom reps and poisons the calibrated range.
 */
function inPushupPosture(lm: Landmark[]) {
  const sx: number[] = [];
  const sy: number[] = [];
  const hx: number[] = [];
  const hy: number[] = [];
  for (const i of [11, 12]) {
    if (seen(lm[i])) {
      sx.push(lm[i].x);
      sy.push(lm[i].y);
    }
  }
  for (const i of [23, 24]) {
    if (seen(lm[i])) {
      hx.push(lm[i].x);
      hy.push(lm[i].y);
    }
  }
  if (!sx.length || !hx.length) return false;
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const dx = Math.abs(avg(sx) - avg(hx));
  const dy = Math.abs(avg(sy) - avg(hy));
  return dx > dy;
}

function fmtClock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function PushupSession({
  best = 0,
  onRep,
  onFinish,
  onCancel,
}: {
  /** Personal best reps, shown as a live target. */
  best?: number;
  /** Fired the instant a rep completes — credits MINUTES_PER_REP immediately. */
  onRep: (minutes: number) => void;
  onFinish: (result: { reps: number; seconds: number; minutes: number; sets: number }) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
  const repsRef = useRef(0);
  const doneRef = useRef(false);
  const pausedRef = useRef(false);
  const autoPausedRef = useRef(false);
  const lastTsRef = useRef(0);
  const lastRepRef = useRef(0);
  const lastSeenRef = useRef(0);
  const onRepRef = useRef(onRep);
  onRepRef.current = onRep;

  // Clock that excludes paused stretches.
  const startRef = useRef(0);
  const pausedAtRef = useRef(0);
  const pausedTotalRef = useRef(0);

  // Rep state machine + running calibration of this person's real range of motion.
  const phaseRef = useRef<"up" | "down">("up");
  const valRef = useRef<number | null>(null);
  const loRef = useRef(Infinity);
  const hiRef = useRef(-Infinity);
  const formOkRef = useRef(true);
  // A rest of REST_MS or more starts a new set.
  const setsRef = useRef(1);
  const lastRestRef = useRef(0);
  const postureLostRef = useRef(0);

  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [reps, setReps] = useState(0);
  const [sets, setSets] = useState(1);
  const [depth, setDepth] = useState(0); // 0 = locked out, 1 = bottom of the rep
  const [calibrated, setCalibrated] = useState(false);
  const [status, setStatus] = useState("Ready when you are");
  const [hint, setHint] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [paused, setPaused] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{
    reps: number;
    seconds: number;
    minutes: number;
    sets: number;
  } | null>(null);

  const beep = useCallback(() => {
    try {
      const ctx = audioRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      /* audio is a nicety, never fatal */
    }
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
  }, []);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    stop();
    setRunning(false);
    const raw = performance.now() - startRef.current - pausedTotalRef.current;
    setResult({
      reps: repsRef.current,
      seconds: Math.round(raw / 1000),
      minutes: repsRef.current * MINUTES_PER_REP,
      // A set only counts once it has reps in it.
      sets: repsRef.current > 0 ? setsRef.current : 0,
    });
  }, [stop]);

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    autoPausedRef.current = false;
    setPaused(next);
    if (next) {
      pausedAtRef.current = performance.now();
      setStatus("Paused");
    } else {
      pausedTotalRef.current += performance.now() - pausedAtRef.current;
      setStatus("Back at it");
    }
  }, []);

  const begin = useCallback(async () => {
    doneRef.current = false;
    pausedRef.current = false;
    repsRef.current = 0;
    setsRef.current = 1;
    lastRestRef.current = 0;
    postureLostRef.current = 0;
    setSets(1);
    phaseRef.current = "up";
    valRef.current = null;
    loRef.current = Infinity;
    hiRef.current = -Infinity;
    pausedTotalRef.current = 0;
    setReps(0);
    setDepth(0);
    setPaused(false);
    setCalibrated(false);
    setResult(null);
    setHint(null);
    setStatus("Loading pose model…");

    // Must be created inside the tap that started the session, or iOS blocks it.
    try {
      audioRef.current = new AudioContext();
    } catch {
      /* no audio available */
    }

    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      const modelAssetPath =
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
      // Plenty of phones have no usable WebGL delegate — fall back to CPU rather than dying.
      const makeLandmarker = (delegate: "GPU" | "CPU") =>
        vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath, delegate },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      const landmarker = await makeLandmarker("GPU").catch(() => makeLandmarker("CPU"));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      // Stop the phone sleeping mid-set.
      try {
        wakeRef.current = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        /* not supported — the set still works, the screen may just dim */
      }

      // Give them time to put the phone down and get into position.
      setStatus("Get into position");
      for (let n = 3; n > 0; n--) {
        setCountdown(n);
        beep();
        await new Promise((r) => setTimeout(r, 1000));
      }
      setCountdown(0);

      startRef.current = performance.now();
      lastSeenRef.current = performance.now();
      setRunning(true);
      setStatus("Go");

      const loop = () => {
        if (doneRef.current) return;
        // Re-queue first: a single bad frame must never kill the loop.
        rafRef.current = requestAnimationFrame(loop);

        const canvas = canvasRef.current;
        if (!canvas) return;
        // MediaPipe throws on a zero-sized frame, which the camera reports for
        // the first few frames and again right after a camera flip.
        if (video.readyState < 2 || !video.videoWidth) {
          setStatus("Starting camera…");
          return;
        }
        const ctx = canvas.getContext("2d")!;
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        if (!pausedRef.current) {
          setElapsed(performance.now() - startRef.current - pausedTotalRef.current);
        }

        // detectForVideo demands strictly increasing timestamps.
        const ts = Math.max(performance.now(), lastTsRef.current + 1);
        lastTsRef.current = ts;
        let res: { landmarks?: unknown[] };
        try {
          res = landmarker.detectForVideo(video, ts);
        } catch {
          return;
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Mirror the overlay to match the mirrored selfie preview.
        if (facing === "user") ctx.setTransform(-1, 0, 0, 1, canvas.width, 0);

        const lm = res.landmarks?.[0] as Landmark[] | undefined;

        if (!lm) {
          // Auto-pause rather than silently timing an empty room.
          if (!pausedRef.current && ts - lastSeenRef.current > LOST_MS) {
            pausedRef.current = true;
            autoPausedRef.current = true;
            pausedAtRef.current = performance.now();
            setPaused(true);
            setStatus("Paused — step back into frame");
          }
          return;
        }
        lastSeenRef.current = ts;
        // Resume by itself only if the pause was automatic; a manual pause stays put.
        if (pausedRef.current && autoPausedRef.current) {
          pausedRef.current = false;
          autoPausedRef.current = false;
          pausedTotalRef.current += performance.now() - pausedAtRef.current;
          setPaused(false);
          setStatus("Back at it");
        }

        // --- form: hips should stay in line with shoulders and knees
        const hipAngles: number[] = [];
        if (seen(lm[11]) && seen(lm[23]) && seen(lm[25]))
          hipAngles.push(angleAt(lm[11], lm[23], lm[25]));
        if (seen(lm[12]) && seen(lm[24]) && seen(lm[26]))
          hipAngles.push(angleAt(lm[12], lm[24], lm[26]));
        const straight = hipAngles.length
          ? hipAngles.reduce((a, b) => a + b, 0) / hipAngles.length
          : 180;
        const goodForm = straight >= STRAIGHT_MIN;
        formOkRef.current = goodForm;

        // Bright on camera regardless of the room; the calm palette is for UI, not video.
        const accent = goodForm ? "rgba(110, 231, 160, 0.95)" : "rgba(255, 107, 107, 0.95)";
        ctx.lineWidth = Math.max(2, canvas.width / 300);
        ctx.lineCap = "round";
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = ctx.lineWidth * 3;
        for (const [a, b] of CONNECTIONS) {
          const p = lm[a];
          const q = lm[b];
          if (!seen(p) || !seen(q)) continue;
          ctx.beginPath();
          ctx.moveTo(p.x * canvas.width, p.y * canvas.height);
          ctx.lineTo(q.x * canvas.width, q.y * canvas.height);
          ctx.stroke();
        }
        ctx.fillStyle = "#FFFFFF";
        for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
          const p = lm[i];
          if (!seen(p)) continue;
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, ctx.lineWidth * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        if (pausedRef.current) return;

        // --- position gate: nothing counts, and nothing calibrates, until they are down
        if (!inPushupPosture(lm)) {
          postureLostRef.current = postureLostRef.current || ts;
          // Standing around long enough means the old range is stale — start over.
          if (ts - postureLostRef.current > 3000) {
            valRef.current = null;
            loRef.current = Infinity;
            hiRef.current = -Infinity;
            phaseRef.current = "up";
            setCalibrated(false);
            setDepth(0);
          }
          setStatus("Get down into position");
          return;
        }
        postureLostRef.current = 0;

        // --- signal: elbow angle, falling back to shoulder drop when wrists are hidden
        const arms: number[] = [];
        if (seen(lm[11]) && seen(lm[13]) && seen(lm[15]))
          arms.push(angleAt(lm[11], lm[13], lm[15]));
        if (seen(lm[12]) && seen(lm[14]) && seen(lm[16]))
          arms.push(angleAt(lm[12], lm[14], lm[16]));

        let raw: number | null = null;
        if (arms.length) {
          raw = arms.reduce((a, b) => a + b, 0) / arms.length;
        } else if (seen(lm[11]) && seen(lm[13]) && seen(lm[23])) {
          // torso length normalises for how far away the phone is
          const torso = Math.abs(lm[23].y - lm[11].y) || 0.001;
          raw = ((lm[13].y - lm[11].y) / torso) * 180;
        }
        if (raw === null) {
          setStatus("Can't see your arms");
          return;
        }

        const v = valRef.current === null ? raw : valRef.current * (1 - SMOOTH) + raw * SMOOTH;
        valRef.current = v;
        loRef.current = Math.min(loRef.current, v);
        hiRef.current = Math.max(hiRef.current, v);
        // Let both ends creep back toward the current value so one freak reading
        // (a stumble, a stretch) doesn't define the range for the whole session.
        if (Number.isFinite(loRef.current)) loRef.current += (v - loRef.current) * DECAY;
        if (Number.isFinite(hiRef.current)) hiRef.current += (v - hiRef.current) * DECAY;
        const range = hiRef.current - loRef.current;

        setHint(goodForm ? null : "Straighten your back");

        // Thresholds ride on the range this person actually moves through, so the
        // counter adapts to any camera angle, distance or body size.
        if (range < 25) {
          setDepth(0);
          setCalibrated(false);
          setStatus(phaseRef.current === "up" ? "Do one rep to calibrate" : "Keep going…");
          return;
        }
        setCalibrated(true);
        const down = loRef.current + range * 0.35;
        const up = loRef.current + range * 0.65;
        setDepth(Math.max(0, Math.min(1, (hiRef.current - v) / range)));

        if (phaseRef.current === "up" && v < down) {
          phaseRef.current = "down";
          setStatus(goodForm ? "Now push up" : "Fix your form");
        } else if (phaseRef.current === "down" && v > up) {
          phaseRef.current = "up";
          if (!formOkRef.current) {
            setStatus("Rep skipped — back sagging");
            navigator.vibrate?.([25, 60, 25]);
          } else if (ts - lastRepRef.current > MIN_REP_MS) {
            // A long gap since the last rep means they rested — new set.
            if (repsRef.current > 0 && ts - lastRepRef.current > REST_MS) {
              setsRef.current += 1;
              setSets(setsRef.current);
            }
            lastRepRef.current = ts;
            repsRef.current += 1;
            setReps(repsRef.current);
            setStatus(
              best > 0 && repsRef.current === best + 1 ? "New personal best!" : "Rep · +1 min",
            );
            setFlash(true);
            setTimeout(() => setFlash(false), 260);
            navigator.vibrate?.(35);
            beep();
            onRepRef.current(MINUTES_PER_REP);
          }
        }
      };
      loop();
    } catch (e) {
      // Surface the real reason — silent failure here is what hid the last bug.
      setStatus(e instanceof Error ? `Failed: ${e.message}` : "Camera or pose model unavailable");
    }
  }, [facing, beep, best]);

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
      // Force a resize next frame; the other camera may have a different resolution.
      if (canvasRef.current) canvasRef.current.width = 0;
    } catch {
      setStatus("Could not switch camera");
    }
  }, [facing, running]);

  // Screen wake locks drop whenever the tab is backgrounded — take it again.
  useEffect(() => {
    const reacquire = async () => {
      if (document.visibilityState !== "visible" || !running || wakeRef.current) return;
      try {
        wakeRef.current = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("visibilitychange", reacquire);
    return () => document.removeEventListener("visibilitychange", reacquire);
  }, [running]);

  useEffect(() => stop, [stop]);

  if (result) {
    const isBest = result.reps > best && result.reps > 0;
    const pace = result.reps > 0 ? (result.seconds / result.reps).toFixed(1) : "0";
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-center bg-[var(--bg)] px-6">
        <div className="mx-auto w-full max-w-sm text-center">
          {isBest && (
            <div className="mb-3 inline-block rounded-full bg-[var(--violet)] px-4 py-1.5 text-sm font-bold text-white">
              🔥 New personal best
            </div>
          )}
          <div className="eyebrow">Session complete</div>
          <div className="mt-4 font-display text-[5.5rem] font-bold leading-none">
            {result.reps}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">reps</div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {[
              ["Time", fmtClock(result.seconds * 1000)],
              ["Sets", String(result.sets)],
              ["Pace", `${pace}s`],
            ].map(([label, value]) => (
              <div key={label} className="card px-2 py-3">
                <div className="text-lg font-bold">{value}</div>
                <div className="text-[11px] font-medium text-[var(--muted)]">{label}</div>
              </div>
            ))}
          </div>

          <div className="glow mt-6 rounded-3xl bg-[var(--accent)] px-6 py-5 text-white">
            <div className="text-3xl font-bold">+{result.minutes} min</div>
            <div className="text-xs font-semibold uppercase tracking-widest opacity-70">banked</div>
          </div>

          <button
            onClick={() => onFinish(result)}
            className="mt-6 w-full rounded-2xl bg-[var(--surface-2)] py-4 text-base font-semibold active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-200"
          style={{
            opacity: flash ? 1 : 0,
            boxShadow: "inset 0 0 120px 20px rgba(255,255,255,0.45)",
          }}
        />

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <button
            onClick={() => {
              stop();
              onCancel();
            }}
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
          >
            <X size={20} />
          </button>

          {running && (
            <div className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 backdrop-blur">
              <span className="text-sm font-bold text-white">{fmtClock(elapsed)}</span>
              <span className="text-xs font-medium text-white/60">set {sets}</span>
              {best > 0 && <span className="text-xs font-medium text-white/60">best {best}</span>}
            </div>
          )}

          <button
            onClick={flipCamera}
            aria-label="Flip camera"
            className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* countdown */}
        {countdown > 0 && (
          <div className="absolute inset-0 grid place-items-center bg-black/50">
            <div className="font-display text-[8rem] font-bold leading-none text-[var(--accent)]">
              {countdown}
            </div>
          </div>
        )}

        {/* rep counter */}
        <div className="absolute left-1/2 top-20 -translate-x-1/2 text-center">
          <div
            className="font-display text-[6rem] font-bold leading-none text-white"
            style={{ textShadow: "0 4px 30px rgba(0,0,0,0.6)" }}
          >
            {reps}
          </div>
          <div className="mt-1 inline-block rounded-full bg-[var(--accent)] px-4 py-1 text-sm font-bold text-white">
            +{reps * MINUTES_PER_REP} min earned
          </div>
        </div>

        {/* form warning */}
        {hint && running && !paused && (
          <div className="absolute inset-x-0 bottom-40 text-center">
            <span className="rounded-full bg-[var(--danger)] px-4 py-2 text-sm font-bold text-white">
              {hint}
            </span>
          </div>
        )}

        {/* depth meter */}
        {running && (
          <div className="absolute bottom-28 left-1/2 w-56 -translate-x-1/2">
            <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full transition-[width] duration-75"
                style={{
                  width: `${depth * 100}%`,
                  background: hint ? "var(--danger)" : "var(--accent)",
                }}
              />
            </div>
            <div className="mt-2 text-center text-xs font-medium text-white/70">
              {calibrated ? "depth" : "calibrating…"}
            </div>
          </div>
        )}

        <p className="absolute inset-x-0 bottom-16 text-center text-base font-semibold text-white drop-shadow-lg">
          {status}
        </p>
      </div>

      <div className="flex gap-3 bg-[var(--bg)] px-5 pt-4 safe-bottom">
        {!running ? (
          <button
            onClick={begin}
            className="glow w-full rounded-2xl bg-[var(--accent)] py-4 text-lg font-bold text-white active:scale-[0.98]"
          >
            Start session
          </button>
        ) : (
          <>
            <button
              onClick={togglePause}
              aria-label={paused ? "Resume" : "Pause"}
              className="grid w-16 place-items-center rounded-2xl bg-[var(--surface-2)] text-[var(--text)] active:scale-[0.98]"
            >
              {paused ? <Play size={22} /> : <Pause size={22} />}
            </button>
            <button
              onClick={finish}
              className="flex-1 rounded-2xl bg-[var(--surface-2)] py-4 text-lg font-bold text-[var(--danger)] active:scale-[0.98]"
            >
              Finish
            </button>
          </>
        )}
      </div>
    </div>
  );
}
