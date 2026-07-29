import { useState } from "react";
import { Camera, Dumbbell, X } from "lucide-react";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  type Task,
  type TaskCategory,
  type TaskKind,
} from "@/lib/app-state";

export function AddTaskSheet({
  task,
  onClose,
  onAdd,
  onSave,
}: {
  /** When present the sheet edits this task instead of creating a new one. */
  task?: Task;
  onClose: () => void;
  onAdd?: (t: Omit<Task, "id">) => void;
  onSave?: (id: string, patch: Partial<Task>) => void;
}) {
  const editing = !!task;
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? "photo");
  const [name, setName] = useState(task?.name ?? "");
  const [minutes, setMinutes] = useState(task?.minutes ?? 15);
  const [criteria, setCriteria] = useState(task?.criteria ?? "");
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? "chores");
  const [repeatable, setRepeatable] = useState(task?.repeatable ?? true);

  const field =
    "w-full rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] placeholder:text-[var(--muted)] focus:ring-2";

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)] text-[var(--muted)]"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm">
      <button className="flex-1" onClick={onClose} aria-label="Close" />

      <div className="sheet flex max-h-[92vh] flex-col">
        <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-[var(--line)]" />

        <header className="flex shrink-0 items-center justify-between px-5 py-4">
          <h2 className="text-xl font-bold">{editing ? "Edit task" : "New task"}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-5">
          {/* kind */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["photo", "Photo proof", Camera],
                ["pushup", "Pushups", Dumbbell],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className="flex flex-col items-center gap-2 rounded-2xl border py-4 transition-colors"
                style={{
                  borderColor: kind === k ? "var(--accent)" : "var(--line)",
                  background: kind === k ? "var(--earn-soft)" : "var(--surface-2)",
                  color: kind === k ? "var(--accent)" : "var(--muted)",
                }}
              >
                <Icon size={22} />
                <span className="text-sm font-semibold">{label}</span>
              </button>
            ))}
          </div>

          <div>
            <label className="eyebrow mb-2 block">Task name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === "pushup" ? "Morning pushups" : "Make bed"}
              className={`${field} font-display text-lg font-semibold`}
            />
          </div>

          {kind === "photo" ? (
            <div>
              <label className="eyebrow mb-2 block">Minutes earned</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
                  className={`${field} text-lg font-bold`}
                />
                {[5, 10, 15, 30].map((m) => (
                  <button key={m} onClick={() => setMinutes(m)} className={chip(minutes === m)}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--earn-soft)] px-4 py-3 text-sm text-[var(--text)]">
              <span className="font-semibold text-[var(--violet)]">1 pushup = 1 minute</span>,
              counted live by the camera and banked as you go.
            </div>
          )}

          <div>
            <label className="eyebrow mb-2 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ORDER.map((c) => (
                <button key={c} onClick={() => setCategory(c)} className={chip(category === c)}>
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          {kind === "photo" && (
            <div>
              <label className="eyebrow mb-2 block">What counts as done?</label>
              <textarea
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
                rows={3}
                placeholder="The mattress is fully covered and pillows are at the head of the bed."
                className={`${field} resize-none text-sm`}
              />
              <p className="mt-2 text-xs text-[var(--muted)]">
                The AI checks your photo against this. Be specific.
              </p>
            </div>
          )}

          <div>
            <label className="eyebrow mb-2 block">How often</label>
            <div className="flex gap-2">
              <button onClick={() => setRepeatable(true)} className={chip(repeatable)}>
                Repeatable
              </button>
              <button onClick={() => setRepeatable(false)} className={chip(!repeatable)}>
                One-time
              </button>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-5 pt-2 safe-bottom">
          <button
            disabled={!name.trim()}
            onClick={() => {
              const payload = {
                name: name.trim(),
                minutes: kind === "pushup" ? 1 : minutes,
                kind,
                repeatable,
                category,
                criteria: kind === "photo" ? criteria.trim() : undefined,
              };
              if (editing && task && onSave) onSave(task.id, payload);
              else onAdd?.(payload);
              onClose();
            }}
            className="glow w-full rounded-2xl bg-[var(--accent)] py-4 text-lg font-bold text-white disabled:opacity-30 disabled:shadow-none active:scale-[0.98]"
          >
            {editing ? "Save changes" : "Add task"}
          </button>
        </div>
      </div>
    </div>
  );
}
