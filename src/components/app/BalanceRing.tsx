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
  const R = 104;
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

  return (
    <div className="relative mx-auto grid h-60 w-60 place-items-center">
      <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full -rotate-90">
        <circle
          cx="120"
          cy="120"
          r={R}
          fill="none"
          stroke="var(--hairline)"
          strokeWidth="1.5"
        />
        <circle
          cx="120"
          cy="120"
          r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="butt"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="text-center">
        <div className="label-caps">Balance</div>
        <div className="mt-1 font-mono text-6xl leading-none tabular-nums text-foreground">
          {display}
        </div>
        <div className="mt-2 font-mono text-xs text-muted-foreground">
          MIN · {earned}/{goal} today
        </div>
      </div>
    </div>
  );
}
