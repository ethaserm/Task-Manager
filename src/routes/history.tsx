import { createFileRoute } from "@tanstack/react-router";
import { Dumbbell, Tv } from "lucide-react";
import { TabBar } from "@/components/app/TabBar";
import { earnedToday, fmtMinutes } from "@/lib/app-state";
import { useAppState } from "@/lib/use-app-state";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — Screen Time Tracker" },
      {
        name: "description",
        content: "Every verified task and pushup session with timestamps and earned minutes.",
      },
      { property: "og:title", content: "History — Screen Time Tracker" },
      { property: "og:description", content: "A record of everything you've earned." },
    ],
  }),
  component: History,
});

function History() {
  const { state } = useAppState();
  const total = state.history.reduce((a, e) => a + e.minutes, 0);
  const today = earnedToday(state.history);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="px-5 pb-3 pt-7">
        <h1 className="text-2xl font-bold">History</h1>
      </header>

      <div className="grid grid-cols-3 gap-2 px-4 pb-5">
        {[
          { label: "Today", value: fmtMinutes(today) },
          { label: "All time", value: fmtMinutes(total) },
          { label: "Balance", value: fmtMinutes(state.balance) },
        ].map((s) => (
          <div key={s.label} className="card px-3 py-3 text-center">
            <div className="text-lg font-bold text-[var(--accent)]">{s.value}</div>
            <div className="mt-0.5 text-[11px] font-medium text-[var(--muted)]">{s.label}</div>
          </div>
        ))}
      </div>

      <ul className="space-y-2 px-4">
        {state.history.length === 0 && (
          <li className="card px-5 py-10 text-center text-sm text-[var(--muted)]">
            Nothing yet. Complete a task to start your record.
          </li>
        )}
        {state.history.map((e) => (
          <li key={e.id} className="card flex items-center gap-3 p-3">
            {e.thumb ? (
              <img
                src={e.thumb}
                alt={`Proof photo for ${e.name}`}
                className="h-12 w-12 shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
                style={
                  e.kind === "spend"
                    ? { background: "rgba(255,107,107,0.14)", color: "var(--danger)" }
                    : { background: "var(--earn-soft)", color: "var(--violet)" }
                }
              >
                {e.kind === "spend" ? <Tv size={20} /> : <Dumbbell size={20} />}
              </span>
            )}

            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-base font-semibold">{e.name}</span>
              <span className="block text-xs text-[var(--muted)]">
                {new Date(e.at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {e.summary ? ` · ${e.summary}` : ""}
              </span>
              {e.reason && (
                <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                  {e.reason}
                </span>
              )}
            </span>

            <span
              className="shrink-0 rounded-full px-3 py-1.5 text-sm font-bold"
              style={
                e.minutes < 0
                  ? { background: "rgba(255,107,107,0.12)", color: "var(--danger)" }
                  : { background: "var(--earn-soft)", color: "var(--accent)" }
              }
            >
              {e.minutes < 0 ? e.minutes : `+${e.minutes}`}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex-1 pb-4" />
      <TabBar />
    </div>
  );
}
