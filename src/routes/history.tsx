import { createFileRoute } from "@tanstack/react-router";
import { TabBar } from "@/components/app/TabBar";
import { fmtMinutes } from "@/lib/app-state";
import { useAppState } from "@/lib/use-app-state";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — APP Screen Time Ledger" },
      {
        name: "description",
        content: "Every verified task and pushup session with timestamps and credited minutes.",
      },
      { property: "og:title", content: "History — APP Screen Time Ledger" },
      {
        property: "og:description",
        content: "A statement of completed tasks and earned screen time.",
      },
    ],
  }),
  component: History,
});

function History() {
  const { state } = useAppState();
  const total = state.history.reduce((a, e) => a + e.minutes, 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="flex items-baseline justify-between px-5 py-5 hairline-bottom">
        <h1 className="font-display text-lg">History</h1>
        <span className="font-mono text-xs text-muted-foreground">
          {fmtMinutes(total)} EARNED · {fmtMinutes(state.balance)} BALANCE
        </span>
      </header>

      <ul>
        {state.history.length === 0 && (
          <li className="px-5 py-6 text-sm text-muted-foreground">No entries yet.</li>
        )}
        {state.history.map((e) => (
          <li key={e.id} className="flex items-center gap-4 px-5 py-4 hairline-bottom">
            {e.thumb ? (
              <img
                src={e.thumb}
                alt={`Proof photo for ${e.name}`}
                className="h-12 w-12 shrink-0 object-cover"
              />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center border border-[var(--hairline)] font-mono text-[10px] text-muted-foreground">
                REPS
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-base">{e.name}</span>
              <span className="block font-mono text-[11px] text-muted-foreground">
                {new Date(e.at).toLocaleString(undefined, {
                  month: "short",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {e.summary ? ` · ${e.summary}` : ""}
              </span>
              {e.reason && (
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {e.reason}
                </span>
              )}
            </span>
            <span className="font-mono text-sm" style={{ color: "var(--accent)" }}>
              +{e.minutes}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex-1" />
      <TabBar />
    </div>
  );
}
