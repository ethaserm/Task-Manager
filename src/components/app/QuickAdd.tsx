import { Minus, Plus, Undo2 } from "lucide-react";

/**
 * Manual rep logging, carried over from the old pushups tracker: the camera
 * isn't always practical, and reps done elsewhere still count.
 */
export function QuickAdd({
  todayReps,
  goal,
  canUndo,
  onAdd,
  onUndo,
}: {
  todayReps: number;
  goal: number;
  canUndo: boolean;
  onAdd: (reps: number) => void;
  onUndo: () => void;
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((todayReps / goal) * 100)) : 0;

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">Log reps</span>
        <span className="text-xs text-[var(--muted)]">
          {todayReps} / {goal} today · {pct}%
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: "var(--earn)" }}
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => onAdd(-1)}
          aria-label="Remove one rep"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--surface-2)] active:scale-95"
        >
          <Minus size={20} />
        </button>

        <button
          onClick={() => onAdd(1)}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-base font-bold text-white active:scale-[0.98]"
        >
          <Plus size={20} strokeWidth={2.6} />
          Add rep
        </button>

        <button
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo last entry"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--surface-2)] disabled:opacity-30 active:scale-95"
        >
          <Undo2 size={19} />
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        {[5, 10, 20].map((n) => (
          <button
            key={n}
            onClick={() => onAdd(n)}
            className="flex-1 rounded-2xl bg-[var(--surface-2)] py-2.5 text-sm font-semibold active:scale-[0.98]"
          >
            +{n}
          </button>
        ))}
      </div>
    </div>
  );
}
