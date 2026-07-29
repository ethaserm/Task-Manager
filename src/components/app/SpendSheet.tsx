import { useState } from "react";
import { X } from "lucide-react";
import { fmtMinutes } from "@/lib/app-state";

/** Spending is the other half of the loop — minutes earned are meant to be used. */
export function SpendSheet({
  balance,
  onClose,
  onSpend,
}: {
  balance: number;
  onClose: () => void;
  onSpend: (minutes: number) => void;
}) {
  const [amount, setAmount] = useState(Math.min(30, balance));
  const capped = Math.max(0, Math.min(amount, balance));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm">
      <button className="flex-1" onClick={onClose} aria-label="Close" />

      <div className="sheet flex flex-col">
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-[var(--line)]" />

        <header className="flex items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-xl font-bold">Use screen time</h2>
            <p className="text-sm text-[var(--muted)]">{fmtMinutes(balance)} banked</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]"
          >
            <X size={18} />
          </button>
        </header>

        <div className="space-y-5 px-5 pb-5">
          <div className="card px-5 py-6 text-center">
            <div className="font-display text-5xl font-bold">{capped}</div>
            <div className="mt-1 text-sm text-[var(--muted)]">minutes to spend</div>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(balance, 1)}
            step={5}
            value={capped}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
            aria-label="Minutes to spend"
          />

          <div className="flex flex-wrap gap-2">
            {[15, 30, 60].map((m) => (
              <button
                key={m}
                disabled={m > balance}
                onClick={() => setAmount(m)}
                className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-30 ${
                  capped === m
                    ? "bg-[var(--accent)] text-black"
                    : "bg-[var(--surface-2)] text-[var(--muted)]"
                }`}
              >
                {m} min
              </button>
            ))}
            <button
              disabled={balance <= 0}
              onClick={() => setAmount(balance)}
              className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-30 ${
                capped === balance && balance > 0
                  ? "bg-[var(--accent)] text-black"
                  : "bg-[var(--surface-2)] text-[var(--muted)]"
              }`}
            >
              All of it
            </button>
          </div>
        </div>

        <div className="px-5 pt-1 safe-bottom">
          <button
            disabled={capped <= 0}
            onClick={() => {
              onSpend(capped);
              onClose();
            }}
            className="glow w-full rounded-2xl bg-[var(--accent)] py-4 text-lg font-bold text-black disabled:opacity-30 disabled:shadow-none active:scale-[0.98]"
          >
            Start {capped} min
          </button>
          <p className="mt-3 text-center text-xs text-[var(--muted)]">
            Runs a live countdown. Stop early and unused minutes come back.
          </p>
        </div>
      </div>
    </div>
  );
}
