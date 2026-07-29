import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { TabBar } from "@/components/app/TabBar";
import {
  bestDay,
  currentStreak,
  dailyAverage,
  daysTracked,
  goalHitRate,
  longestStreak,
  monthBars,
  repsByDay,
  weekBars,
  type Bar,
} from "@/lib/app-state";
import { useAppState } from "@/lib/use-app-state";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Stats — Earned" },
      { name: "description", content: "Streaks, records and weekly totals for reps earned." },
    ],
  }),
  component: Stats,
});

function Chart({ bars, goal }: { bars: Bar[]; goal: number }) {
  const max = Math.max(goal, ...bars.map((b) => b.value), 1);
  return (
    <div className="flex h-40 items-end gap-2">
      {bars.map((b) => {
        const h = Math.round((b.value / max) * 100);
        return (
          <div key={b.key} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[11px] font-medium text-[var(--muted)]">
              {b.value > 0 ? b.value : ""}
            </span>
            <div className="flex h-full w-full items-end">
              <div
                className="w-full rounded-md transition-[height] duration-500"
                style={{
                  height: `${Math.max(h, b.value > 0 ? 4 : 2)}%`,
                  background: b.value >= goal && goal > 0 ? "var(--earn)" : "var(--surface-2)",
                }}
              />
            </div>
            <span
              className="text-[11px] font-medium"
              style={{ color: b.isNow ? "var(--text)" : "var(--muted)" }}
            >
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Stats() {
  const { state, exportBackup, importBackup } = useAppState();
  const [range, setRange] = useState<"week" | "month">("week");
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const map = repsByDay(state.history);
  const goal = state.dailyGoal;
  const bars = range === "week" ? weekBars(map) : monthBars(map);
  const total = Object.values(map).reduce((a, b) => a + b, 0);

  const stats = [
    { label: "Day streak", value: currentStreak(state.history), sub: "in a row" },
    { label: "Longest streak", value: longestStreak(map), sub: "days" },
    { label: "Best day", value: bestDay(map), sub: "reps" },
    { label: "Daily average", value: dailyAverage(map), sub: "per active day" },
    { label: "Goal hit rate", value: `${goalHitRate(map, goal)}%`, sub: `of ${goal} min` },
    { label: "Days tracked", value: daysTracked(map), sub: "so far" },
  ];

  function download() {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `earned-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function upload(file: File) {
    try {
      importBackup(await file.text());
      setNotice("Backup restored.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not read that file.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="px-5 pb-3 pt-8">
        <h1 className="text-3xl font-bold">Stats</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{total.toLocaleString()} reps all time</p>
      </header>

      <section className="px-4">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">
              {range === "week" ? "Last 7 days" : "Last 6 weeks"}
            </span>
            <div className="flex gap-1 rounded-full bg-[var(--surface-2)] p-1">
              {(["week", "month"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className="rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors"
                  style={{
                    background: range === r ? "var(--surface)" : "transparent",
                    color: range === r ? "var(--text)" : "var(--muted)",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <Chart bars={bars} goal={range === "week" ? goal : goal * 7} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 px-4 pt-3">
        {stats.map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <div className="font-display text-2xl font-bold">{s.value}</div>
            <div className="text-sm font-medium">{s.label}</div>
            <div className="text-xs text-[var(--muted)]">{s.sub}</div>
          </div>
        ))}
      </section>

      <section className="px-4 pt-3">
        <div className="card p-4">
          <div className="text-sm font-semibold">Backup</div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Everything lives in this browser. Clearing site data wipes it — keep a copy.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={download}
              className="flex-1 rounded-2xl bg-[var(--surface-2)] py-3 text-sm font-semibold active:scale-[0.98]"
            >
              Export
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 rounded-2xl bg-[var(--surface-2)] py-3 text-sm font-semibold active:scale-[0.98]"
            >
              Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </div>
          {notice && <p className="mt-2 text-xs text-[var(--muted)]">{notice}</p>}
        </div>
      </section>

      <div className="flex-1 pb-4" />
      <TabBar />
    </div>
  );
}
