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
    setDailyGoal,
    updateTask,
  };
}
