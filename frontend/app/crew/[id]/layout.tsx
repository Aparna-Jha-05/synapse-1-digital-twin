"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { formatMissionClock } from "@/lib/utils";
import Link from "next/link";

const NAV_ITEMS = [
  { label: "Home", href: (id: string) => `/crew/${id}`, icon: "⬡" },
  { label: "Hearth", href: (id: string) => `/crew/${id}/hearth`, icon: "◉" },
  { label: "Garden", href: (id: string) => `/crew/${id}/garden`, icon: "◆" },
  { label: "Journal", href: (id: string) => `/crew/${id}/journal`, icon: "◌" },
  { label: "Hippocampal Test", href: (id: string) => `/crew/${id}/anchor-test`, icon: "◈" },
];

export default function CrewLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, role, crewId, logout, hydrate } = useAuthStore();
  const [clock, setClock] = useState("");

  useEffect(() => { hydrate(); }, []);

  useEffect(() => {
    if (token && role === "GROUND") router.push("/ground");
    if (!token) router.push("/login?role=crew");
  }, [token, role]);

  useEffect(() => {
    const ref = 1700000000000;
    const tick = () => setClock(formatMissionClock(Math.floor((Date.now() - ref) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const id = params.id;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-12 border-b border-surface-2 flex items-center justify-between px-4 bg-surface/80 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="text-accent font-mono font-bold text-sm">SYNAPSE-1</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400 text-xs">Crew Companion</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-success">HABITAT NOMINAL</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="mission-clock text-xs text-slate-500">{clock}</span>
          <button type="button" onClick={() => { logout(); router.push("/"); }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            EXIT
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-44 border-r border-surface-2 bg-surface/40 flex flex-col py-4">
          <nav className="flex-1 space-y-1 px-2">
            {NAV_ITEMS.map((item) => {
              const href = item.href(id);
              const active = pathname === href;
              return (
                <Link key={href} href={href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${active ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "text-slate-400 hover:text-slate-200 hover:bg-surface-2"}`}>
                  <span className="text-sm">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="px-4 py-2 text-xs text-slate-700 font-mono">{id}</div>
        </aside>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
