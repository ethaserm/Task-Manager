import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Brain,
  Camera,
  Dumbbell,
  Home as HomeIcon,
  MoreVertical,
  Plus,
  ShowerHead,
} from "lucide-react";
import { BalanceRing } from "@/components/app/BalanceRing";
import { TabBar } from "@/components/app/TabBar";
import { AddTaskSheet } from "@/components/app/AddTaskSheet";
import { PhotoProof } from "@/components/app/PhotoProof";
import { PushupSession } from "@/components/app/PushupSession";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  completionsToday,
  currentStreak,
  earnedToday,
  isDone,
  repsToday,
  type Task,
  type TaskCategory,
} from "@/lib/app-state";
import { SpendSheet } from "@/components/app/SpendSheet";
import { ActiveSessionCard } from "@/components/app/ActiveSessionCard";
import { QuickAdd } from "@/components/app/QuickAdd";
import { runShortcut, UNLOCK_SHORTCUT } from "@/lib/shortcuts";
import { useAppState } from "@/lib/use-app-state";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Earned — Screen Time Tracker" },
      {
        name: "description",
        content: "Earn screen time by completing verified tasks and live-tracked pushup sessions.",
      },
      { property: "og:title", content: "Earned — Screen Time Tracker" },
      {
        property: "og:description",
        content: "Do the work, bank the minutes.",
      },
    ],
  }),
  component: Ledger,
});

const CATEGORY_ICON: Record<TaskCategory, typeof HomeIcon> = {
  chores: HomeIcon,
  hygiene: ShowerHead,
  fitness: Dumbbell,
  mind: Brain,
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Ledger() {
  const {
    state,
    ready,
    addTask,
    updateTask,
    completeTask,
    creditMinutes,
    startScreenTime,
    endScreenTime,
    recordBest,
    logEntry,
    addManualReps,
    undoLast,
    removeTask,
  } = useAppState();
  const [adding, setAdding] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [photoTask, setPhotoTask] = useState<Task | null>(null);
  const [pushTask, setPushTask] = useState<Task | null>(null);
  const [spending, setSpending] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const earned = earnedToday(state.history);
  const streak = currentStreak(state.history);
  const pushupTask = state.tasks.find((t) => t.kind === "pushup");

  const grouped = CATEGORY_ORDER.map((c) => ({
    category: c,
    tasks: state.tasks.filter((t) => (t.category ?? "chores") === c),
  })).filter((g) => g.tasks.length > 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="flex items-center justify-between px-5 pb-2 pt-7">
        <div>
          <div className="eyebrow">{greeting()}</div>
          <h1 className="mt-0.5 text-2xl font-bold">Earn your time</h1>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <span
              className="rounded-full px-3 py-2 text-sm font-bold"
              style={{ background: "var(--earn-soft)", color: "var(--earn)" }}
            >
              {streak} day{streak === 1 ? "" : "s"}
            </span>
          )}
          <button
            onClick={() => setAdding(true)}
            aria-label="Add task"
            className="glow grid h-11 w-11 place-items-center rounded-full bg-[var(--accent)] text-white active:scale-95"
          >
            <Plus size={22} strokeWidth={2.6} />
          </button>
        </div>
      </header>

      <section className="px-4 pb-4 pt-3">
        <BalanceRing balance={state.balance} earned={earned} goal={state.dailyGoal} />
      </section>

      <div className="px-4 pb-6">
        {state.active ? (
          <ActiveSessionCard session={state.active} onEnd={endScreenTime} />
        ) : (
          <button
            onClick={() => setSpending(true)}
            disabled={state.balance <= 0}
            className="w-full rounded-2xl bg-[var(--surface-2)] py-3.5 text-base font-semibold text-[var(--text)] disabled:opacity-40 active:scale-[0.99]"
          >
            Use screen time
          </button>
        )}
      </div>

      {/* Pushups are the task that actually gets used — camera or by hand. */}
      {pushupTask && (
        <div className="space-y-2 px-4 pb-6">
          <button
            onClick={() => setPushTask(pushupTask)}
            className="card flex w-full items-center gap-4 p-4 text-left active:scale-[0.99]"
          >
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl"
              style={{ background: "var(--earn-soft)", color: "var(--earn)" }}
            >
              <Dumbbell size={26} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-bold">Count with camera</span>
              <span className="block text-sm text-[var(--muted)]">
                1 rep = 1 min
                {state.pushupBest > 0 ? ` · best ${state.pushupBest}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-xl text-[var(--muted)]" aria-hidden>
              →
            </span>
          </button>

          <QuickAdd
            todayReps={repsToday(state.history)}
            goal={state.dailyGoal}
            canUndo={state.history.length > 0}
            onAdd={addManualReps}
            onUndo={undoLast}
          />
        </div>
      )}

      {ready && state.tasks.length === 0 && (
        <p className="px-6 py-8 text-center text-sm text-[var(--muted)]">
          No tasks yet — tap + to add your first one.
        </p>
      )}

      <div className="space-y-6 px-4 pb-4">
        {grouped.map((g) => {
          const Icon = CATEGORY_ICON[g.category as TaskCategory];
          return (
            <section key={g.category}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <Icon size={15} className="text-[var(--muted)]" />
                <span className="eyebrow">{CATEGORY_LABEL[g.category as TaskCategory]}</span>
              </div>

              <ul className="space-y-2">
                {g.tasks.map((t) => {
                  const done = isDone(t);
                  const times = completionsToday(state.history, t.id);
                  const isPush = t.kind === "pushup";
                  return (
                    <li key={t.id} className="card relative flex items-center gap-3 p-3">
                      <button
                        onClick={() => {
                          if (done) return;
                          if (isPush) setPushTask(t);
                          else setPhotoTask(t);
                        }}
                        className="flex flex-1 items-center gap-3 text-left active:scale-[0.99]"
                      >
                        <span
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                          style={{
                            background: isPush ? "var(--earn-soft)" : "var(--earn-soft)",
                            color: isPush ? "var(--violet)" : "var(--accent)",
                          }}
                        >
                          {isPush ? <Dumbbell size={20} /> : <Camera size={20} />}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate font-display text-base font-semibold ${
                              done ? "text-[var(--muted)] line-through" : ""
                            }`}
                          >
                            {t.name}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                            {isPush
                              ? state.pushupBest > 0
                                ? `Best ${state.pushupBest} reps`
                                : "Live tracked"
                              : "Photo proof"}
                            {times > 0 && (
                              <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 font-semibold text-[var(--accent)]">
                                {times}× today
                              </span>
                            )}
                          </span>
                        </span>

                        <span
                          className="shrink-0 rounded-full px-3 py-1.5 text-sm font-bold"
                          style={{
                            background: done ? "var(--surface-2)" : "var(--earn-soft)",
                            color: done ? "var(--muted)" : "var(--accent)",
                          }}
                        >
                          {done ? "done" : isPush ? "1/rep" : `+${t.minutes}`}
                        </span>
                      </button>

                      <button
                        onClick={() => setMenuFor(menuFor === t.id ? null : t.id)}
                        aria-label={`Options for ${t.name}`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] active:bg-[var(--surface-2)]"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {menuFor === t.id && (
                        <div className="absolute right-2 top-14 z-20 w-36 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] shadow-xl">
                          <button
                            onClick={() => {
                              setEditTask(t);
                              setMenuFor(null);
                            }}
                            className="block w-full px-4 py-3 text-left text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              removeTask(t.id);
                              setMenuFor(null);
                            }}
                            className="block w-full px-4 py-3 text-left text-sm font-medium text-[var(--danger)]"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

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

      {spending && (
        <SpendSheet
          balance={state.balance}
          onClose={() => setSpending(false)}
          onSpend={(m) => {
            startScreenTime(m);
            // Spending minutes is the whole point of unlocking, so don't make it a
            // second, separate tap — the Guard automation keeps bouncing until this runs.
            runShortcut(UNLOCK_SHORTCUT, m);
          }}
        />
      )}

      {pushTask && (
        <PushupSession
          best={state.pushupBest ?? 0}
          onRep={(m) => creditMinutes(m)}
          onCancel={() => setPushTask(null)}
          onFinish={(r) => {
            if (r.reps > 0) {
              recordBest(r.reps);
              logEntry({
                taskId: pushTask.id,
                name: pushTask.name,
                minutes: r.minutes,
                kind: "pushup",
                summary:
                  r.sets > 1 ? `${r.reps} reps · ${r.sets} sets` : `${r.reps} reps · ${r.seconds}s`,
              });
            }
            setPushTask(null);
          }}
        />
      )}
    </div>
  );
}
