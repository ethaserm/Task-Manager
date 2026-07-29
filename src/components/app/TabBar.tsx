import { Link, useRouterState } from "@tanstack/react-router";
import { House, ScrollText } from "lucide-react";

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
          color: active ? "var(--accent)" : "var(--muted)",
        }}
      >
        <Icon size={20} strokeWidth={active ? 2.4 : 2} />
        <span className="text-[11px] font-semibold">{label}</span>
      </Link>
    );
  };

  return (
    <div className="sticky bottom-0 z-30 px-4 safe-bottom pt-2">
      <nav className="card flex gap-2 p-2 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
        {item("/", "Tasks", House)}
        {item("/history", "History", ScrollText)}
      </nav>
    </div>
  );
}
