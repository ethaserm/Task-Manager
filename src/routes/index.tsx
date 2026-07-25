import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BalanceRing } from "@/components/app/BalanceRing";
import { TabBar } from "@/components/app/TabBar";
import { AddTaskSheet } from "@/components/app/AddTaskSheet";
import { PhotoProof } from "@/components/app/PhotoProof";
import { PushupSession } from "@/components/app/PushupSession";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  completionsToday,
  earnedToday,
  isDone,
  type Task,
  type TaskCategory,
} from "@/lib/app-state";
import { useAppState } from "@/lib/use-app-state";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "APP — Screen Time Reward Tracker" },
      {
        name: "description",
        content:
          "Earn screen time credits by completing verified tasks and live-tracked pushup sessions.",
      },
      { property: "og:title", content: "APP — Screen Time Reward Tracker" },
      {
        property: "og:description",
        content: "A quiet ledger for earning screen time through proven work.",
      },
    ],
  }),
  component: Ledger,
});

function Ledger() {
  const { state, ready, addTask, updateTask, completeTask, creditMinutes, logEntry, removeTask } =
    useAppState();
  const [adding, setAdding] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [photoTask, setPhotoTask] = useState<Task | null>(null);
  const [pushTask, setPushTask] = useState<Task | null>(null);

  const earned = earnedToday(state.history);

  const grouped = CATEGORY_ORDER.map((c) => ({
    category: c,
    tasks: state.tasks.filter((t) => (t.category ?? "chores") === c),
  })).filter((g) => g.tasks.length > 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="flex items-center justify-between px-5 py-5">
        <h1 className="font-display text-base tracking-[0.3em]">APP</h1>
        <span className="font-mono text-xs text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { month: "short", day: "2-digit" })}
        </span>
      </header>

      <section className="px-5 pb-8 pt-2">
        <BalanceRing balance={state.balance} earned={earned} goal={state.dailyGoal} />
      </section>

      <div className="flex items-center justify-between px-5 pb-3">
        <span className="label-caps">Today</span>
        <button
          onClick={() => setAdding(true)}
          className="font-mono text-xs tracking-widest text-[var(--accent)]"
        >
          + ADD TASK
        </button>
      </div>

      {ready && state.tasks.length === 0 && (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          No tasks yet. Add one to start earning.
        </p>
      )}

      {grouped.map((g) => (
        <section key={g.category}>
          <div className="hairline-top bg-[var(--secondary)] px-5 py-2">
            <span className="label-caps">{CATEGORY_LABEL[g.category as TaskCategory]}</span>
          </div>
          <ul>
            {g.tasks.map((t) => {
              const done = isDone(t);
              const times = completionsToday(state.history, t.id);
              return (
                <li key={t.id} className="flex items-center gap-3 px-5 py-4 hairline-bottom">
                  <button
                    onClick={() => {
                      if (done) return;
                      t.kind === "pushup" ? setPushTask(t) : setPhotoTask(t);
                    }}
                    className="flex flex-1 items-baseline justify-between gap-4 text-left"
                  >
                    <span className="min-w-0">
                      <span
                        className={`block truncate font-display text-base ${done ? "text-muted-foreground line-through" : ""}`}
                      >
                        {t.name}
                      </span>
                      <span className="label-caps">
                        {t.kind === "pushup"
                          ? "live tracked · 1 rep = 1 min"
                          : `photo proof · ${t.repeatable ? "unlimited" : "one-time"}`}
                        {times > 0 ? ` · ${times}× today` : ""}
                      </span>
                    </span>
                    <span
                      className="whitespace-nowrap font-mono text-sm"
                      style={{ color: done ? "var(--muted-foreground)" : "var(--accent)" }}
                    >
                      {done ? "EARNED" : t.kind === "pushup" ? "+1/rep" : `+${t.minutes}`}
                    </span>
                  </button>
                  <button
                    onClick={() => setEditTask(t)}
                    aria-label={`Edit ${t.name}`}
                    className="font-mono text-[11px] tracking-widest text-muted-foreground"
                  >
                    EDIT
                  </button>
                  <button
                    onClick={() => removeTask(t.id)}
                    aria-label={`Delete ${t.name}`}
                    className="font-mono text-xs text-muted-foreground"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="flex-1" />
      <TabBar />

      {adding && <AddTaskSheet onClose={() => setAdding(false)} onAdd={addTask} />}

      {editTask && (
        <AddTaskSheet
          task={editTask}
          onClose={() => setEditTask(null)}
          onSave={(id, patch) => updateTask(id, patch)}
        />
      )}

      {photoTask && (
        <PhotoProof
          task={photoTask}
          onClose={() => setPhotoTask(null)}
          onApproved={(thumb, reason) => {
            completeTask(photoTask, {
              taskId: photoTask.id,
              name: photoTask.name,
              minutes: photoTask.minutes,
              kind: "photo",
              reason,
              thumb,
            });
          }}
        />
      )}

      {pushTask && (
        <PushupSession
          onRep={(m) => creditMinutes(m)}
          onCancel={() => setPushTask(null)}
          onFinish={(r) => {
            if (r.reps > 0) {
              logEntry({
                taskId: pushTask.id,
                name: pushTask.name,
                minutes: r.minutes,
                kind: "pushup",
                summary: `${r.reps} reps · ${r.seconds}s`,
              });
            }
            setPushTask(null);
          }}
        />
      )}
    </div>
  );
}
