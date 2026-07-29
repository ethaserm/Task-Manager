import { useEffect, useRef, useState } from "react";
import { Lock, LockOpen, Square } from "lucide-react";
import { fmtCountdown, minutesLeft, type ActiveSession } from "@/lib/app-state";
import { isIOS, LOCK_SHORTCUT, runShortcut, UNLOCK_SHORTCUT } from "@/lib/shortcuts";

/**
 * Live countdown for screen time being spent. Time is derived from `endsAt`, so
 * backgrounding the tab (or reloading) never drifts the clock.
 */
export function ActiveSessionCard({
  session,
  onEnd,
}: {
  session: ActiveSession;
  onEnd: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const left = session.endsAt - now;
  const done = left <= 0;
  const total = session.minutes * 60000;
  const pct = Math.max(0, Math.min(1, 1 - left / total));

  // Alert once when the session runs out, and re-lock the phone's apps.
  useEffect(() => {
    if (!done || firedRef.current) return;
    firedRef.current = true;
    // Safari may refuse a scheme navigation without a tap; the Lock button below
    // is the guaranteed path, this just saves a tap when it does go through.
    runShortcut(LOCK_SHORTCUT);
    navigator.vibrate?.([200, 100, 200, 100, 400]);
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1);
    } catch {
      /* audio blocked — the buzz and the banner still land */
    }
  }, [done]);

  return (
    <div
      className="card relative overflow-hidden px-5 py-5"
      style={done ? { borderColor: "var(--danger)" } : { borderColor: "var(--accent)" }}
    >
      {/* drain bar */}
      <div
        className="absolute inset-x-0 top-0 h-1 transition-[width] duration-500"
        style={{
          width: `${pct * 100}%`,
          background: done ? "var(--danger)" : "var(--accent)",
        }}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="eyebrow">{done ? "Time's up" : "Screen time running"}</div>
          <div
            className="mt-1 font-display text-4xl font-bold tabular-nums"
            style={{ color: done ? "var(--danger)" : "var(--text)" }}
          >
            {done ? "0:00" : fmtCountdown(left)}
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            {done ? "Put it down — or earn more" : `of ${session.minutes} min`}
          </div>
        </div>

        <button
          onClick={() => {
            // Re-lock the phone's apps as soon as the session ends.
            runShortcut(LOCK_SHORTCUT);
            onEnd();
          }}
          className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold active:scale-95"
          style={
            done
              ? { background: "var(--danger)", color: "#fff" }
              : { background: "var(--surface-2)", color: "var(--text)" }
          }
        >
          <Square size={15} fill="currentColor" />
          {done ? "Done" : "Stop"}
        </button>
      </div>

      {isIOS() &&
        (done ? (
          <button
            onClick={() => runShortcut(LOCK_SHORTCUT)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--danger)] py-3 text-sm font-bold text-white active:scale-[0.98]"
          >
            <Lock size={16} />
            Lock my apps again
          </button>
        ) : (
          <button
            onClick={() => runShortcut(UNLOCK_SHORTCUT, minutesLeft(session))}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--surface-2)] py-3 text-sm font-bold text-[var(--accent)] active:scale-[0.98]"
          >
            <LockOpen size={16} />
            Unlock my apps for {minutesLeft(session)} min
          </button>
        ))}

      {!done && (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Stop early and unused whole minutes go back to your balance.
        </p>
      )}
    </div>
  );
}
