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
    logEntry,
    setDailyGoal,
    updateTask,
  };
}
