import { Link, useRouterState } from "@tanstack/react-router";

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const item = (to: string, label: string) => (
    <Link
      to={to}
      className={`flex-1 py-4 text-center font-mono text-xs tracking-widest ${
        pathname === to ? "text-[var(--accent)]" : "text-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav className="sticky bottom-0 flex sheet-solid hairline-top">
      {item("/", "LEDGER")}
      {item("/history", "HISTORY")}
    </nav>
  );
}
