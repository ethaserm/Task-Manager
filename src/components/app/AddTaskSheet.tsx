import { useState } from "react";
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
    "w-full border-b border-[var(--hairline)] bg-transparent py-2 text-foreground outline-none focus:border-[var(--accent)]";
  const toggle = (active: boolean) =>
    `flex-1 border py-2 font-mono text-xs tracking-widest ${
      active
        ? "border-[var(--accent)] text-[var(--accent)] lift"
        : "border-[var(--hairline)] text-muted-foreground"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col sheet-solid">
      <header className="flex items-center justify-between px-5 py-4 hairline-bottom">
        <h2 className="font-display text-lg">{editing ? "Edit task" : "New task"}</h2>
        <button onClick={onClose} className="label-caps hover:text-foreground">
          Cancel
        </button>
      </header>

      <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6">
        <div className="flex gap-3">
          <button onClick={() => setKind("photo")} className={toggle(kind === "photo")}>
            PHOTO PROOF
          </button>
          <button onClick={() => setKind("pushup")} className={toggle(kind === "pushup")}>
            PUSHUPS
          </button>
        </div>

        <div>
          <div className="label-caps">Task name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "pushup" ? "Morning pushups" : "Make bed"}
            className={`${field} font-display text-lg`}
          />
        </div>

        {kind === "photo" ? (
          <div>
            <div className="label-caps">Minutes earned per completion</div>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
              className={`${field} font-mono text-lg`}
            />
          </div>
        ) : (
          <div className="border border-[var(--hairline)] px-4 py-3">
            <div className="label-caps">Minutes</div>
            <p className="mt-1 font-mono text-sm">1 pushup = 1 minute, credited live.</p>
          </div>
        )}

        <div>
          <div className="label-caps">Category</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORY_ORDER.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`border px-3 py-2 font-mono text-[11px] tracking-widest ${
                  category === c
                    ? "border-[var(--accent)] text-[var(--accent)] lift"
                    : "border-[var(--hairline)] text-muted-foreground"
                }`}
              >
                {CATEGORY_LABEL[c].toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {kind === "photo" && (
          <div>
            <div className="label-caps">Approval checklist</div>
            <textarea
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              rows={3}
              placeholder="The mattress is fully covered and pillows are at the head of the bed."
              className={`${field} resize-none text-sm`}
            />
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => setRepeatable(true)} className={toggle(repeatable)}>
            REPEATABLE
          </button>
          <button onClick={() => setRepeatable(false)} className={toggle(!repeatable)}>
            ONE-TIME
          </button>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          Repeatable tasks can be earned unlimited times per day.
        </p>
      </div>

      <div className="px-5 py-5 hairline-top">
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
          className="w-full border border-[var(--accent)] py-3 font-mono text-sm tracking-widest text-[var(--accent)] disabled:opacity-40"
        >
          {editing ? "SAVE CHANGES" : "SAVE TASK"}
        </button>
      </div>
    </div>
  );
}
