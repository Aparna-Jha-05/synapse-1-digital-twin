"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useAuthStore, useCrewStore, useUIStore } from "@/lib/store";
import { getAllCrew, getShieldIntegrity, getAllSMIs, getCommsStatus, injectScenario, getEthicsLog, getFriction } from "@/lib/api";
import { getCircadianDebtColor, getMoodWeather } from "@/lib/utils";
import type { Crew, ShieldIntegrity, CommsStatus, EthicsLogEntry, FrictionPair } from "@/lib/types";
import Link from "next/link";

// Dynamic import for R3F (server-side render disabled)
const HabitatViewer3D = dynamic(() => import("@/components/habitat/HabitatViewer3D"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

// ─── Alert Banner ─────────────────────────────────────────────────────────────
function AlertBanner({ message, type, onDismiss }: { message: string; type: string; onDismiss: () => void }) {
  return (
    <div className={`alert-banner flex items-center justify-between px-4 py-2 border-b ${type === "critical" ? "bg-danger/10 border-danger/30 text-danger" : "bg-warning/10 border-warning/30 text-warning"}`}>
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
        {message}
      </div>
      <button type="button" onClick={onDismiss} className="text-current opacity-60 hover:opacity-100 ml-4">×</button>
    </div>
  );
}

// ─── Habitat Vitals ───────────────────────────────────────────────────────────
function HabitatVitals({ shield }: { shield: ShieldIntegrity | null }) {
  const vitals = [
    { label: "O₂ Level", value: "21.0%", status: "nominal" },
    { label: "CO₂", value: "0.08%", status: "nominal" },
    { label: "Pressure", value: "101.3 kPa", status: "nominal" },
    { label: "Power Draw", value: "148 kW", status: "nominal" },
    { label: "Water Reserve", value: shield ? `${shield.effective_mass_kg.toLocaleString()} kg` : "–", status: shield?.shield_status === "NOMINAL" ? "nominal" : "warning" },
    { label: "Shield Integrity", value: shield ? `${shield.shield_effectiveness_pct}%` : "–", status: shield?.shield_status === "NOMINAL" ? "nominal" : shield?.shield_status === "DEGRADED" ? "warning" : "critical" },
  ];

  return (
    <div className="grid grid-cols-6 gap-3">
      {vitals.map((v) => (
        <div key={v.label} className="border border-surface-2 rounded-xl p-3 bg-surface/50">
          <div className="data-label mb-1">{v.label}</div>
          <div className={`font-mono text-sm font-semibold ${v.status === "nominal" ? "text-success" : v.status === "warning" ? "text-warning" : "text-danger"}`}>
            {v.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shield vs Consumption dial ───────────────────────────────────────────────
function ShieldDial({ shield }: { shield: ShieldIntegrity | null }) {
  if (!shield) return null;
  const pct = shield.shield_effectiveness_pct;
  const color = pct > 70 ? "#10b981" : pct > 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="border border-surface-2 rounded-xl p-4 bg-surface/50">
      <div className="label-xs text-slate-400 mb-3">Water Shield vs Consumption</div>
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20">
          <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#1e293b" strokeWidth="8" />
            <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="8"
              strokeDasharray={`${pct * 2.01} 201`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-lg font-bold" style={{ color }}>{pct.toFixed(0)}%</span>
          </div>
        </div>
        <div className="space-y-1 text-xs">
          <div><span className="text-slate-500">Total: </span><span className="text-slate-300 font-mono">{shield.water_mass_kg.toLocaleString()} kg</span></div>
          <div><span className="text-slate-500">Consumed: </span><span className="text-warning font-mono">{shield.consumed_kg.toLocaleString()} kg</span></div>
          <div><span className="text-slate-500">Status: </span><span style={{ color }}>{shield.shield_status}</span></div>
        </div>
      </div>
    </div>
  );
}

// ─── Crew Roster Card ─────────────────────────────────────────────────────────
function CrewCard({ crew }: { crew: Crew }) {
  const bio = crew.bio;
  const circ = crew.circadian;
  const affect = crew.affect;
  const paused = crew.privacy_paused;

  const debtColor = circ ? getCircadianDebtColor(circ.debt_hours) : "#94a3b8";
  const affectColor = affect && !paused
    ? (affect.valence > 0.3 ? "#10b981" : affect.valence > -0.1 ? "#f59e0b" : "#ef4444")
    : "#334155";

  return (
    <div className="border border-surface-2 rounded-xl p-3 bg-surface/40 card-hover hover:border-accent/30 transition-all">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-xs font-semibold text-slate-200">{crew.display_name}</div>
          <div className="text-xs text-slate-500">{crew.role}</div>
        </div>
        <div className="flex flex-col items-end gap-1"
          title={paused ? "Biometric sharing paused by crew" : getMoodWeather(affect?.arousal ?? 0, affect?.valence ?? 0)}>
          <div className="w-2 h-2 rounded-full" style={{ background: affectColor }} />
          {paused && <span className="text-xs text-warning/70 font-mono">paused</span>}
        </div>
      </div>

      {paused ? (
        <div className="text-xs text-warning bg-warning/10 rounded px-2 py-1 text-center">
          Sharing paused by crew
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div>
            <div className="data-label">HRV</div>
            <div className="font-mono text-accent">{bio?.hrv_rmssd?.toFixed(0) ?? "–"} ms</div>
          </div>
          <div>
            <div className="data-label">HR</div>
            <div className="font-mono text-accent">{bio?.hr?.toFixed(0) ?? "–"} bpm</div>
          </div>
          <div>
            <div className="data-label">Circadian Debt</div>
            <div className="font-mono text-sm" style={{ color: debtColor }}>
              {circ?.debt_hours?.toFixed(1) ?? "–"}h
            </div>
          </div>
          <div>
            <div className="data-label">Sleep Debt</div>
            <div className="font-mono text-sm text-slate-400">{bio?.sleep_debt?.toFixed(1) ?? "–"}h</div>
          </div>
        </div>
      )}

      {circ && circ.debt_hours > 2 && !paused && (
        <div className="mt-2 text-xs text-danger bg-danger/10 rounded px-2 py-0.5 text-center">
          Circadian debt critical
        </div>
      )}
    </div>
  );
}

// ─── Scenario Control ─────────────────────────────────────────────────────────
function ScenarioPanel() {
  const { token } = useAuthStore();
  const [seed, setSeed] = useState(42);
  const [injecting, setInjecting] = useState<string | null>(null);
  const [lastInjected, setLastInjected] = useState<string | null>(null);

  const scenarios = [
    { name: "SolarProtonEvent", label: "Solar Proton Event", abbrev: "SPE", color: "danger", desc: "SPE stress cascade across all crew" },
    { name: "CommsBlackout", label: "Comms Blackout", abbrev: "COM", color: "warning", desc: "Earth link lost — isolation stress" },
    { name: "InterpersonalConflict", label: "Interpersonal Conflict", abbrev: "PSY", color: "warning", desc: "Social friction in Soma ring" },
    { name: "EquipmentFailure", label: "Equipment Failure", abbrev: "SYS", color: "danger", desc: "Systems emergency — acute stress" },
  ];

  const handleInject = async (name: string) => {
    setInjecting(name);
    try {
      await injectScenario(name, seed);
      setLastInjected(name);
      setTimeout(() => setLastInjected(null), 5000);
    } catch (e) {}
    finally { setInjecting(null); }
  };

  return (
    <div className="border border-surface-2 rounded-xl p-4 bg-surface/50">
      <div className="label-xs text-slate-400 mb-3">Scenario Injection · GROUND ONLY</div>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs text-slate-500">Seed:</label>
        <input type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value) || 42)}
          title="Random seed for scenario injection"
          aria-label="Scenario seed"
          className="w-20 px-2 py-1 bg-surface-2 border border-surface-3 rounded text-xs font-mono text-slate-300 focus:outline-none focus:border-accent" />
      </div>
      <div className="space-y-2">
        {scenarios.map((s) => (
          <button type="button" key={s.name} onClick={() => handleInject(s.name)}
            disabled={injecting !== null}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${lastInjected === s.name ? "border-success/50 bg-success/10 text-success" : s.color === "danger" ? "border-danger/30 bg-danger/5 hover:bg-danger/10 text-danger" : "border-warning/30 bg-warning/5 hover:bg-warning/10 text-warning"} disabled:opacity-50`}>
            <span><span className="font-mono opacity-60 border border-current rounded px-1 mr-2 text-xs">{s.abbrev}</span>{s.label}</span>
            <span className="text-slate-600">{s.desc}</span>
          </button>
        ))}
      </div>
      {lastInjected && (
        <div className="mt-2 text-xs text-success text-center">Injected: {lastInjected}</div>
      )}
    </div>
  );
}

// ─── Predictive Friction Panel (server-side explainable model) ────────────────
const DRIVER_LABELS: Record<string, string> = {
  circadian_debt: "Circadian debt",
  sleep_debt: "Sleep debt",
  valence_divergence: "Affect divergence",
  shared_zone: "Shared zone",
};

function FrictionPanel({ pairs }: { pairs: FrictionPair[] }) {
  return (
    <div className="border border-surface-2 rounded-xl p-4 bg-surface/50">
      <div className="label-xs text-slate-400 mb-3">Predictive Friction · Explainable Model</div>
      {pairs.length === 0 ? (
        <div className="text-xs text-success text-center py-3">No friction risks detected</div>
      ) : (
        <div className="space-y-2">
          {pairs.map((r, i) => {
            const maxDriver = Math.max(...Object.values(r.drivers), 0.001);
            return (
              <div key={i} className="border border-warning/20 rounded-lg p-2 bg-warning/5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-warning font-mono">{r.c1} ↔ {r.c2}</span>
                  <span className="text-xs text-slate-500">Risk: {r.score.toFixed(1)}</span>
                </div>
                {/* Driver contribution bars */}
                <div className="space-y-1">
                  {Object.entries(r.drivers).filter(([, v]) => v > 0).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-24 shrink-0">{DRIVER_LABELS[k] ?? k}</span>
                      <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full bg-warning/60 rounded-full" style={{ width: `${(v / maxDriver) * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-slate-400 w-8 text-right">{v.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-2 text-xs text-slate-600 italic">
        Additive attribution — support tool, never a verdict.
      </div>
    </div>
  );
}

// ─── Ethics Recent ────────────────────────────────────────────────────────────
function RecentEthics({ entries }: { entries: EthicsLogEntry[] }) {
  return (
    <div className="border border-surface-2 rounded-xl p-4 bg-surface/50">
      <div className="flex items-center justify-between mb-3">
        <div className="label-xs text-slate-400">Ethics Ledger · Recent</div>
        <Link href="/ground/ethics" className="text-xs text-accent hover:underline">View all →</Link>
      </div>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {entries.slice(0, 8).map((e) => (
          <div key={e.id} className="flex items-start gap-2 text-xs">
            <span className="text-slate-600 font-mono shrink-0">{new Date(e.ts).toLocaleTimeString("en-US", { hour12: false })}</span>
            <span className={`shrink-0 px-1.5 rounded text-xs ${e.actor_role === "GROUND" ? "bg-accent/10 text-accent" : "bg-blue-500/10 text-blue-400"}`}>
              {e.actor_role}
            </span>
            <span className="text-slate-400">{e.event_type}</span>
          </div>
        ))}
        {entries.length === 0 && <div className="text-xs text-slate-600 text-center py-2">No entries yet</div>}
      </div>
    </div>
  );
}

// ─── Main Ground Dashboard ─────────────────────────────────────────────────────
export default function GroundDashboard() {
  const { token } = useAuthStore();
  const [crew, setCrew] = useState<Crew[]>([]);
  const [shield, setShield] = useState<ShieldIntegrity | null>(null);
  const [smis, setSmis] = useState<Record<string, { smi: number; alarm: boolean }>>({});
  const [comms, setComms] = useState<CommsStatus | null>(null);
  const [ethics, setEthics] = useState<EthicsLogEntry[]>([]);
  const [friction, setFriction] = useState<FrictionPair[]>([]);
  const [alerts, setAlerts] = useState<Array<{ id: string; msg: string; type: string }>>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<string | null>("Lux");

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [crewData, shieldData, smiData, commsData, ethicsData, frictionData] = await Promise.all([
        getAllCrew(),
        getShieldIntegrity(),
        getAllSMIs(),
        getCommsStatus(),
        getEthicsLog(),
        getFriction(),
      ]);
      setCrew(crewData);
      setShield(shieldData);
      setSmis(smiData);
      setComms(commsData);
      setEthics(ethicsData);
      setFriction(frictionData.pairs ?? []);

      // Check for circadian debt alerts
      const debtCrew = crewData.filter((c: Crew) => c.circadian && c.circadian.debt_hours > 2);
      if (debtCrew.length > 0) {
        const id = `debt-${Date.now()}`;
        setAlerts((prev) => {
          if (prev.find(a => a.id.startsWith("debt"))) return prev;
          return [...prev, { id, msg: `Circadian debt >2h: ${debtCrew.map((c: Crew) => c.display_name.split(" ").pop()).join(", ")}`, type: "warning" }];
        });
      }
    } catch (e) {}
  }, [token]);

  // Crew roster (incl. live bio/circadian/affect) + habitat vitals — polling
  // replaces the old per-crew WebSocket streams (12 sockets + env stream).
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 3000);
    return () => clearInterval(id);
  }, [fetchData]);

  const smiAlarms = Object.entries(smis).filter(([, v]) => v.alarm);

  return (
    <div className="p-4 space-y-4 max-w-[1800px] mx-auto">
      {/* Alert banners */}
      {alerts.map((a) => (
        <AlertBanner key={a.id} message={a.msg} type={a.type}
          onDismiss={() => setAlerts((p) => p.filter((x) => x.id !== a.id))} />
      ))}
      {smiAlarms.length > 0 && (
        <AlertBanner message={`Sensory Monotony Index alarm: ${smiAlarms.map(([id]) => id.replace("zone_", "")).join(", ")}`} type="warning"
          onDismiss={() => setSmis((prev) => {
            const next = { ...prev };
            smiAlarms.forEach(([id]) => { next[id] = { ...next[id], alarm: false }; });
            return next;
          })} />
      )}

      {/* Top: Habitat Vitals */}
      <section>
        <div className="label-xs text-slate-500 mb-2">Habitat Vitals</div>
        <HabitatVitals shield={shield} />
      </section>

      {/* Main grid: 3 columns */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: Crew roster */}
        <div className="col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="label-xs text-slate-400">Crew Roster · 12 Personnel</div>
            <Link href="/ground/crew" className="text-xs text-accent hover:underline">Detail →</Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {crew.map((c) => <CrewCard key={c.crew_id} crew={c} />)}
          </div>
        </div>

        {/* Centre: 3D Viewer + SMI */}
        <div className="col-span-6 space-y-3">
          <div className="border border-surface-2 rounded-xl overflow-hidden bg-surface/50"
            style={{ height: "400px" }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-surface-2">
              <div className="label-xs text-slate-400">Habitat 3D Viewer · Live</div>
              <div className="flex items-center gap-1">
                {["Lux", "CO₂", "Acoustic", "Off"].map((m) => (
                  <button key={m} type="button" onClick={() => setHeatmapMode(m === "Off" ? null : m)}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${heatmapMode === m || (m === "Off" && !heatmapMode) ? "bg-accent/20 text-accent border border-accent/40" : "text-slate-500 hover:text-slate-300 border border-transparent"}`}>
                    {m}
                  </button>
                ))}
                <Link href="/ground/habitat" className="ml-2 text-xs text-accent hover:underline">Full view →</Link>
              </div>
            </div>
            <div className="relative" style={{ height: "calc(100% - 41px)" }}>
              <HabitatViewer3D
                selectedZone={selectedZone}
                onSelectZone={setSelectedZone}
                cameraPreset="Overview"
                heatmapMode={heatmapMode}
              />
              {selectedZone && (
                <div className="absolute bottom-2 left-2 bg-surface/90 border border-accent/30 rounded-lg px-3 py-1.5 text-xs text-accent font-mono">
                  {selectedZone.replace("zone_", "").replace(/_/g, " ")}
                </div>
              )}
            </div>
          </div>

          {/* SMI grid */}
          <div className="border border-surface-2 rounded-xl p-4 bg-surface/50">
            <div className="label-xs text-slate-400 mb-3">Sensory Monotony Index · All Zones</div>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(smis).slice(0, 8).map(([zoneId, data]) => (
                <div key={zoneId} className={`rounded-lg p-2 border text-center ${data.alarm ? "border-warning/50 bg-warning/10" : "border-surface-2 bg-surface/30"}`}>
                  <div className="text-xs text-slate-500 truncate">{zoneId.replace("zone_", "").replace("_", " ")}</div>
                  <div className={`font-mono text-sm ${data.alarm ? "text-warning" : "text-success"}`}>
                    {(data.smi * 100).toFixed(0)}%
                  </div>
                  {data.alarm && <div className="text-xs text-warning">ALARM</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Friction + Scenario + Shield */}
        <div className="col-span-3 space-y-3">
          <FrictionPanel pairs={friction} />
          <ShieldDial shield={shield} />
          <ScenarioPanel />

          {/* Comms status */}
          {comms && (
            <div className="border border-surface-2 rounded-xl p-3 bg-surface/50">
              <div className="label-xs text-slate-400 mb-2">Earth Comms</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Latency: </span><span className="font-mono text-accent">{comms.one_way_latency_s}s</span></div>
                <div><span className="text-slate-500">Status: </span><span className={comms.status === "NOMINAL" ? "text-success" : "text-warning"}>{comms.status}</span></div>
                <div><span className="text-slate-500">Mission Day: </span><span className="font-mono text-slate-300">{comms.mission_day}</span></div>
                <div><span className="text-slate-500">Next window: </span><span className="font-mono text-slate-300">{Math.floor(comms.next_window_s / 60)}m</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Ethics + Crew links */}
      <div className="grid grid-cols-2 gap-4">
        <RecentEthics entries={ethics} />
        <div className="border border-surface-2 rounded-xl p-4 bg-surface/50">
          <div className="label-xs text-slate-400 mb-3">Quick Navigation</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/ground/habitat", label: "3D Habitat Viewer" },
              { href: "/ground/circadian", label: "Circadian Dashboard" },
              { href: "/ground/crew", label: "Full Crew Biometrics" },
              { href: "/ground/scenarios", label: "Scenario Replay" },
              { href: "/ground/ethics", label: "Ethics Ledger" },
              { href: "/ground/comms", label: "Comms & ISRU" },
            ].map((link) => (
              <Link key={link.href} href={link.href}
                className="px-3 py-2 rounded-lg border border-surface-2 text-xs text-slate-400 hover:border-accent/30 hover:text-accent transition-all">
                {link.label} →
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

