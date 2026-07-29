import { useCallback, useEffect, useState } from "react";
import {
  loadState,
  saveState,
  initialState,
  todayKey,
  type AppState,
  type HistoryEntry,
  type Task,
} from "./app-state";

let memory: AppState | null = null;
const listeners = new Set<(s: AppState) => void>();

function get(): AppState {
  if (!memory) memory = loadState();
  return memory;
}

function set(updater: (s: AppState) => AppState) {
  memory = updater(get());
  saveState(memory);
  listeners.forEach((l) => l(memory as AppState));
}

export function useAppState() {
  const [state, setState] = useState<AppState>(initialState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(get());
    setReady(true);
    const l = (s: AppState) => setState({ ...s });
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const addTask = useCallback((t: Omit<Task, "id">) => {
    set((s) => ({ ...s, tasks: [...s.tasks, { ...t, id: crypto.randomUUID() }] }));
  }, []);

  const removeTask = useCallback((id: string) => {
    set((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }, []);

  /** Credits minutes and writes a history entry. Repeatable tasks stay unlocked. */
  const completeTask = useCallback((task: Task, entry: Omit<HistoryEntry, "id" | "at">) => {
    set((s) => ({
      ...s,
      balance: s.balance + entry.minutes,
      tasks: s.tasks.map((t) =>
        t.id === task.id && !t.repeatable ? { ...t, completedOn: "done" } : t,
      ),
      history: [{ ...entry, id: crypto.randomUUID(), at: Date.now() }, ...s.history],
    }));
  }, []);

  /** Credits minutes only — used for live pushup reps (1 rep = 1 minute). */
  const creditMinutes = useCallback((n: number) => {
    set((s) => ({ ...s, balance: s.balance + n }));
  }, []);

  /** Writes a history entry without touching the balance (already credited live). */
  const logEntry = useCallback((entry: Omit<HistoryEntry, "id" | "at">) => {
    set((s) => ({
      ...s,
      history: [{ ...entry, id: crypto.randomUUID(), at: Date.now() }, ...s.history],
    }));
  }, []);

  /** Starts a live screen-time session: minutes leave the balance up front. */
  const startScreenTime = useCallback((n: number) => {
    set((s) => {
      const amount = Math.min(n, s.balance);
      if (amount <= 0) return s;
      const now = Date.now();
      return {
        ...s,
        balance: s.balance - amount,
        active: { minutes: amount, startedAt: now, endsAt: now + amount * 60000 },
        history: [
          {
            id: crypto.randomUUID(),
            taskId: "spend",
            name: `Screen time · ${amount} min`,
            minutes: -amount,
            kind: "spend" as const,
            at: now,
          },
          ...s.history,
        ],
      };
    });
  }, []);

  /** Ends the session. Stopping early refunds whole unused minutes. */
  const endScreenTime = useCallback(() => {
    set((s) => {
      if (!s.active) return s;
      const unused = Math.max(0, Math.floor((s.active.endsAt - Date.now()) / 60000));
      if (unused <= 0) return { ...s, active: null };
      return {
        ...s,
        active: null,
        balance: s.balance + unused,
        history: [
          {
            id: crypto.randomUUID(),
            taskId: "spend",
            name: `Stopped early · ${unused} min back`,
            minutes: unused,
            kind: "spend" as const,
            at: Date.now(),
          },
          ...s.history,
        ],
      };
    });
  }, []);

  /** Records a session's rep count when it beats the stored best. */
  const recordBest = useCallback((reps: number) => {
    set((s) => (reps > (s.pushupBest ?? 0) ? { ...s, pushupBest: reps } : s));
  }, []);

  /** Logs reps done away from the camera. 1 rep = 1 minute, same as tracked reps. */
  const addManualReps = useCallback((reps: number, taskName = "Pushups") => {
    if (reps === 0) return;
    set((s) => ({
      ...s,
      balance: Math.max(0, s.balance + reps),
      history: [
        {
          id: crypto.randomUUID(),
          taskId: "t-push",
          name: taskName,
          minutes: reps,
          kind: "pushup" as const,
          at: Date.now(),
          summary: `${reps > 0 ? reps : -reps} reps · logged by hand`,
        },
        ...s.history,
      ],
    }));
  }, []);

  /** Removes the most recent entry and reverses its effect on the balance. */
  const undoLast = useCallback(() => {
    set((s) => {
      const [last, ...rest] = s.history;
      if (!last) return s;
      return { ...s, balance: Math.max(0, s.balance - last.minutes), history: rest };
    });
  }, []);

  /** Clears today's entries and takes back the minutes they earned. */
  const resetToday = useCallback(() => {
    set((s) => {
      const k = todayKey();
      const todays = s.history.filter((e) => todayKey(new Date(e.at)) === k);
      const earned = todays.reduce((a, e) => a + e.minutes, 0);
      return {
        ...s,
        balance: Math.max(0, s.balance - earned),
        history: s.history.filter((e) => todayKey(new Date(e.at)) !== k),
      };
    });
  }, []);

  /** Whole-state backup, so a lost phone or cleared browser isn't a lost history. */
  const exportBackup = useCallback(() => JSON.stringify(get(), null, 2), []);

  const importBackup = useCallback((json: string) => {
    const parsed = JSON.parse(json) as Partial<AppState>;
    if (!Array.isArray(parsed.history) || typeof parsed.balance !== "number") {
      throw new Error("That file isn't a backup from this app.");
    }
    set((s) => ({ ...s, ...parsed }));
  }, []);

  const setDailyGoal = useCallback((n: number) => set((s) => ({ ...s, dailyGoal: n })), []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    set((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }, []);

  return {
    state,
    ready,
    todayKey,
    addTask,
    removeTask,
    completeTask,
    creditMinutes,
    startScreenTime,
    endScreenTime,
    recordBest,
    logEntry,
    addManualReps,
    undoLast,
    resetToday,
    exportBackup,
    importBackup,
    setDailyGoal,
    updateTask,
  };
}
