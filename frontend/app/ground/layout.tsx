"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { formatMissionClock } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Mission Overview", href: "/ground", icon: "⬡" },
  { label: "3D Habitat", href: "/ground/habitat", icon: "◈" },
  { label: "Digital Twin", href: "/ground/twin", icon: "◐" },
  { label: "Crew Biometrics", href: "/ground/crew", icon: "◉" },
  { label: "Circadian Intel", href: "/ground/circadian", icon: "◌" },
  { label: "Scenario Control", href: "/ground/scenarios", icon: "◇" },
  { label: "Model Card", href: "/ground/model-card", icon: "◈" },
  { label: "Ethics Ledger", href: "/ground/ethics", icon: "◻" },
  { label: "Comms & ISRU", href: "/ground/comms", icon: "◎" },
];

export default function GroundLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, role, logout, hydrate } = useAuthStore();
  const [clock, setClock] = useState("");
  const [missionSec, setMissionSec] = useState(0);

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (token && role !== "GROUND") {
      router.push("/");
    }
    if (!token) {
      router.push("/login?role=ground");
    }
  }, [token, role]);

  useEffect(() => {
    const start = Date.now();
    const ref = 1700000000000; // Mission reference
    const offset = start - ref;
    const tick = () => {
      const sec = Math.floor((Date.now() - ref) / 1000);
      setMissionSec(sec);
      setClock(formatMissionClock(sec));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="h-12 border-b border-surface-2 flex items-center justify-between px-4 bg-surface/80 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <span className="text-accent font-mono font-bold text-sm tracking-widest">SYNAPSE-1</span>
          <span className="text-surface-3">·</span>
          <span className="text-slate-400 text-xs tracking-widest uppercase">Ground Control</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-success">NOMINAL</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="mission-clock text-xs text-accent">{clock}</span>
          <button onClick={() => { logout(); router.push("/"); }}
            className="text-xs text-slate-500 hover:text-danger transition-colors">
            DISCONNECT
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-48 border-r border-surface-2 bg-surface/40 flex flex-col py-4 shrink-0">
          <nav className="flex-1 space-y-1 px-2">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all duration-150 ${active ? "bg-accent/10 text-accent border border-accent/20" : "text-slate-400 hover:text-slate-200 hover:bg-surface-2"}`}>
                  <span className="text-base leading-none">{item.icon}</span>
                  <span className="font-medium tracking-wide">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="px-4 pb-2">
            <div className="text-xs text-slate-600 font-mono">SPAR26-HCBD-06</div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

