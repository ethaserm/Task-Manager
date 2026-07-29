import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Dumbbell, Lock, LockOpen } from "lucide-react";
import { PushupSession } from "@/components/app/PushupSession";
import { fmtMinutes } from "@/lib/app-state";
import { useAppState } from "@/lib/use-app-state";
import { isIOS, runShortcut, UNLOCK_SHORTCUT } from "@/lib/shortcuts";

export const Route = createFileRoute("/blocked")({
  head: () => ({
    meta: [
      { title: "Blocked — earn your time" },
      {
        name: "description",
        content: "This app is blocked until you have earned screen time.",
      },
    ],
  }),
  component: Blocked,
});

/**
 * Landing page for the iOS Guard shortcut. Getting bounced here should feel like
 * hitting a wall, with the way out — doing the work — one tap away.
 */
function Blocked() {
  const { state, creditMinutes, recordBest, logEntry, startScreenTime } = useAppState();
  const [session, setSession] = useState(false);
  const [justEarned, setJustEarned] = useState(0);

  const pushTask = state.tasks.find((t) => t.kind === "pushup");
  const balance = state.balance;

  if (session) {
    return (
      <PushupSession
        best={state.pushupBest ?? 0}
        onRep={(m) => {
          creditMinutes(m);
          setJustEarned((n) => n + m);
        }}
        onCancel={() => setSession(false)}
        onFinish={(r) => {
          if (r.reps > 0) {
            recordBest(r.reps);
            logEntry({
              taskId: pushTask?.id ?? "t-push",
              name: pushTask?.name ?? "Pushup session",
              minutes: r.minutes,
              kind: "pushup",
              summary: `${r.reps} reps · ${r.seconds}s`,
            });
          }
          setSession(false);
        }}
      />
    );
  }

  return (
    <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      {/* red wash instead of the usual lime glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(120% 60% at 50% 0%, rgba(255,107,107,0.18) 0%, transparent 60%)",
        }}
      />

      <div className="relative text-center">
        <div
          className="mx-auto grid h-20 w-20 place-items-center rounded-3xl"
          style={{ background: "rgba(255,107,107,0.14)", color: "var(--danger)" }}
        >
          <Lock size={36} />
        </div>

        <h1 className="mt-6 text-3xl font-bold">Blocked</h1>
        <p className="mt-2 text-base text-[var(--muted)]">
          You&rsquo;re out of screen time. Earn some to get back in.
        </p>

        {justEarned > 0 && (
          <div className="mt-5 rounded-2xl bg-[rgba(198,255,90,0.12)] px-4 py-3 text-sm font-semibold text-[var(--accent)]">
            +{justEarned} min earned just now
          </div>
        )}

        <div className="card mt-7 px-5 py-5">
          <div className="eyebrow">Banked</div>
          <div className="mt-1 font-display text-5xl font-bold">{fmtMinutes(balance)}</div>

          {balance > 0 ? (
            <button
              onClick={() => {
                startScreenTime(balance);
                runShortcut(UNLOCK_SHORTCUT, balance);
              }}
              className="glow mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] py-4 text-lg font-bold text-black active:scale-[0.98]"
            >
              <LockOpen size={20} />
              Unlock {balance} min
            </button>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Nothing banked. One pushup buys one minute.
            </p>
          )}
        </div>

        <button
          onClick={() => setSession(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--surface-2)] py-4 text-lg font-bold text-[var(--text)] active:scale-[0.98]"
        >
          <Dumbbell size={20} />
          Do pushups
        </button>

        <Link to="/" className="mt-6 inline-block text-sm font-medium text-[var(--muted)]">
          Other ways to earn →
        </Link>

        {!isIOS() && (
          <p className="mt-6 text-xs text-[var(--muted)]">
            Unlocking runs the Shortcuts automation — that part only works on iPhone.
          </p>
        )}
      </div>
    </div>
  );
}
