import { useEffect, useRef, useState } from "react";

export function BalanceRing({
  balance,
  earned,
  goal,
}: {
  balance: number;
  earned: number;
  goal: number;
}) {
  const pct = Math.max(0, Math.min(1, goal > 0 ? earned / goal : 0));
  const R = 96;
  const C = 2 * Math.PI * R;
  const [display, setDisplay] = useState(balance);
  const prev = useRef(balance);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || prev.current === balance) {
      prev.current = balance;
      setDisplay(balance);
      return;
    }
    const from = prev.current;
    const start = performance.now();
    prev.current = balance;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (balance - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [balance]);

  const hours = Math.floor(display / 60);
  const mins = display % 60;

  return (
    <div className="card relative overflow-hidden px-6 py-7">
      {/* accent bloom */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "rgba(198,255,90,0.18)" }}
      />

      <div className="relative mx-auto grid h-56 w-56 place-items-center">
        <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full -rotate-90">
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--violet)" />
            </linearGradient>
          </defs>
          <circle cx="120" cy="120" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
          <circle
            cx="120"
            cy="120"
            r={R}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>

        <div className="text-center">
          <div className="eyebrow">Screen time</div>
          <div className="mt-1 flex items-baseline justify-center gap-1 font-display">
            {hours > 0 && (
              <>
                <span className="text-5xl font-bold leading-none">{hours}</span>
                <span className="text-xl font-semibold text-[var(--muted)]">h</span>
              </>
            )}
            <span className="text-5xl font-bold leading-none">{mins}</span>
            <span className="text-xl font-semibold text-[var(--muted)]">m</span>
          </div>
          <div className="mt-2 text-xs font-medium text-[var(--muted)]">banked</div>
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-between rounded-2xl bg-[var(--surface-2)] px-4 py-3">
        <div>
          <div className="text-xs font-medium text-[var(--muted)]">Today</div>
          <div className="text-lg font-bold">
            {earned}
            <span className="text-sm font-medium text-[var(--muted)]"> / {goal} min</span>
          </div>
        </div>
        <div
          className="rounded-full px-3 py-1.5 text-sm font-bold"
          style={{
            background: pct >= 1 ? "var(--accent)" : "rgba(198,255,90,0.14)",
            color: pct >= 1 ? "#0a0b0f" : "var(--accent)",
          }}
        >
          {pct >= 1 ? "Goal hit 🎉" : `${Math.round(pct * 100)}%`}
        </div>
      </div>
    </div>
  );
}
