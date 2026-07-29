export type TaskKind = "photo" | "pushup";

export type TaskCategory = "chores" | "hygiene" | "fitness" | "mind";

export interface Task {
  id: string;
  name: string;
  minutes: number;
  kind: TaskKind;
  repeatable: boolean;
  criteria?: string;
  category?: TaskCategory;
  completedOn?: string; // "done" for one-time tasks; repeatable tasks are unlimited
}

/** "spend" entries carry negative minutes and never count toward daily progress. */
export type EntryKind = TaskKind | "spend";

export interface HistoryEntry {
  id: string;
  taskId: string;
  name: string;
  minutes: number;
  kind: EntryKind;
  at: number;
  reason?: string;
  thumb?: string;
  summary?: string;
}

/** A screen-time session being spent right now. Survives reloads via `endsAt`. */
export interface ActiveSession {
  minutes: number;
  startedAt: number;
  endsAt: number;
}

export interface AppState {
  balance: number;
  tasks: Task[];
  history: HistoryEntry[];
  dailyGoal: number;
  /** Most reps completed in a single session. */
  pushupBest: number;
  active?: ActiveSession | null;
}

const KEY = "app.screentime.v2";

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  chores: "Chores",
  hygiene: "Hygiene",
  fitness: "Fitness",
  mind: "Mind & focus",
};

export const CATEGORY_ORDER: TaskCategory[] = ["chores", "hygiene", "fitness", "mind"];

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const seed = (
  id: string,
  name: string,
  minutes: number,
  category: TaskCategory,
  criteria: string,
): Task => ({ id, name, minutes, kind: "photo", repeatable: true, category, criteria });

export const initialState: AppState = {
  balance: 0,
  dailyGoal: 60,
  pushupBest: 0,
  tasks: [
    seed(
      "t-bed",
      "Make bed",
      15,
      "chores",
      "The mattress is fully covered by a sheet or duvet — not bunched up, not hanging off the side — AND pillows are visibly arranged at the head of the bed. Both conditions must be true.",
    ),
    seed(
      "t-desk",
      "Clear desk",
      10,
      "chores",
      "The desk surface is clear of clutter, dishes and loose papers.",
    ),
    seed(
      "t-dishes",
      "Wash dishes",
      20,
      "chores",
      "The sink and counter are empty of dirty dishes; clean dishes may be in a rack.",
    ),
    seed(
      "t-trash",
      "Take out trash",
      10,
      "chores",
      "The trash bin is empty or holds a fresh, empty liner with no overflowing rubbish.",
    ),
    seed(
      "t-vacuum",
      "Vacuum floor",
      20,
      "chores",
      "The floor is clear of visible debris, crumbs and dust; vacuum lines or a clean open floor are visible.",
    ),
    seed(
      "t-tidy",
      "Tidy room",
      20,
      "chores",
      "Floor and surfaces are clear of clothes, rubbish and scattered items; things are put away.",
    ),
    seed(
      "t-laundry",
      "Laundry",
      25,
      "chores",
      "Clothes are folded in a stack, hung up, or loaded in a running machine — not piled on the floor.",
    ),
    seed(
      "t-shower",
      "Shower",
      15,
      "hygiene",
      "A used shower is visible — wet shower floor or walls, or a damp towel hung up after use.",
    ),
    seed(
      "t-teeth",
      "Brush teeth",
      5,
      "hygiene",
      "A toothbrush with toothpaste on it, or a freshly used wet toothbrush, is visible.",
    ),
    {
      id: "t-push",
      name: "Pushup session",
      minutes: 1,
      kind: "pushup",
      repeatable: true,
      category: "fitness",
    },
    seed(
      "t-stretch",
      "Stretch",
      10,
      "fitness",
      "A person is mid-stretch, or a mat / stretching setup is laid out ready for use.",
    ),
    seed(
      "t-read",
      "Read 20 min",
      20,
      "mind",
      "An open book, e-reader or article is visible, showing readable pages.",
    ),
    seed(
      "t-meditate",
      "Meditate 10 min",
      10,
      "mind",
      "A meditation setup is visible — a cushion or mat laid out, or a timer / meditation app showing a finished session.",
    ),
    seed(
      "t-journal",
      "Journal",
      15,
      "mind",
      "A journal page or note app entry with visible handwriting or typed text is shown.",
    ),
    seed(
      "t-study",
      "Study session",
      30,
      "mind",
      "Study materials are in use — open notes, textbook, or a workspace with written work visible.",
    ),
  ],
  history: [],
};

export function loadState(): AppState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initialState;
    return { ...initialState, ...(JSON.parse(raw) as AppState) };
  } catch {
    return initialState;
  }
}

export function saveState(s: AppState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

/** Repeatable tasks never lock — they can be earned unlimited times per day. */
export function isDone(t: Task) {
  return !t.repeatable && t.completedOn === "done";
}

export function earnedToday(h: HistoryEntry[]) {
  const k = todayKey();
  return h
    .filter((e) => e.kind !== "spend" && todayKey(new Date(e.at)) === k)
    .reduce((a, e) => a + e.minutes, 0);
}

/** Consecutive days up to today with at least one earning entry. */
export function currentStreak(h: HistoryEntry[]) {
  const days = new Set(h.filter((e) => e.kind !== "spend").map((e) => todayKey(new Date(e.at))));
  const d = new Date();
  // Today not being logged yet shouldn't break a streak — start from yesterday then.
  if (!days.has(todayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(todayKey(d))) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function repsToday(h: HistoryEntry[]) {
  const k = todayKey();
  return h
    .filter((e) => e.kind === "pushup" && todayKey(new Date(e.at)) === k)
    .reduce((a, e) => a + e.minutes, 0);
}

export function completionsToday(h: HistoryEntry[], taskId: string) {
  const k = todayKey();
  return h.filter((e) => e.taskId === taskId && todayKey(new Date(e.at)) === k).length;
}

/** Whole minutes left on a session, floored at zero. */
export function minutesLeft(a?: ActiveSession | null, now = Date.now()) {
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.endsAt - now) / 60000));
}

export function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtMinutes(m: number) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${String(r).padStart(2, "0")}m` : `${r}m`;
}
