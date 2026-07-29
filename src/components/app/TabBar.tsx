import { Link, useRouterState } from "@tanstack/react-router";
import { ChartBar, House, ScrollText } from "lucide-react";

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const item = (to: string, label: string, Icon: typeof House) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition-colors"
        style={{
          background: active ? "var(--surface-2)" : "transparent",
          color: active ? "var(--text)" : "var(--muted)",
        }}
      >
        <Icon size={20} strokeWidth={active ? 2.3 : 1.9} />
        <span className="text-[11px] font-semibold">{label}</span>
      </Link>
    );
  };

  return (
    <div className="sticky bottom-0 z-30 px-4 safe-bottom pt-2">
      <nav className="card flex gap-1 p-1.5 shadow-[0_-6px_24px_rgba(22,22,15,0.06)]">
        {item("/", "Today", House)}
        {item("/stats", "Stats", ChartBar)}
        {item("/history", "History", ScrollText)}
      </nav>
    </div>
  );
}
