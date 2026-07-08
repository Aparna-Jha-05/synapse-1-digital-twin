"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/lib/store";
import { simulateTwin, getAllCrew } from "@/lib/api";
import type { TwinResult, Crew } from "@/lib/types";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Area, AreaChart,
} from "recharts";

const SCENARIOS = [
  { value: "", label: "Baseline (no event)" },
  { value: "SolarProtonEvent", label: "Solar Proton Event" },
  { value: "CommsBlackout", label: "Comms Blackout" },
  { value: "InterpersonalConflict", label: "Interpersonal Conflict" },
  { value: "EquipmentFailure", label: "Equipment Failure" },
];

function valenceColor(v: number) {
  return v > 0.3 ? "#34d399" : v > -0.1 ? "#fbbf24" : "#f87171";
}
function debtColor(d: number) {
  return d < 1 ? "#34d399" : d < 2 ? "#fbbf24" : "#f87171";
}

// ─── Crew mini-sparkline of a projected series ────────────────────────────────
function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={28}>
      <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={`sg-${dataKey}-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.3}
          fill={`url(#sg-${dataKey}-${color})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function DigitalTwinPage() {
  const { token } = useAuthStore();
  const [horizon, setHorizon] = useState(16);
  const [scenario, setScenario] = useState("");
  const [injectAt, setInjectAt] = useState(2);
  const [focusHour, setFocusHour] = useState(0);
  const [result, setResult] = useState<TwinResult | null>(null);
  const [crewMeta, setCrewMeta] = useState<Record<string, Crew>>({});
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const run = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await simulateTwin({
        horizon_hours: horizon,
        scenario: scenario || null,
        scenario_at_hour: injectAt,
      });
      setResult(res);
      setFocusHour(0);
    } catch (e) {
      // swallow — UI shows "run" prompt
    } finally {
      setLoading(false);
    }
  }, [token, horizon, scenario, injectAt]);

  useEffect(() => {
    if (!token) return;
    getAllCrew().then((c: Crew[]) => {
      setCrewMeta(Object.fromEntries(c.map((x) => [x.crew_id, x])));
    }).catch(() => {});
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Playback: advance the scrubber
  useEffect(() => {
    if (!playing || !result) return;
    const id = setInterval(() => {
      setFocusHour((h) => (h >= result.horizon_hours ? 0 : h + 1));
    }, 550);
    return () => clearInterval(id);
  }, [playing, result]);

  const habitat = result?.habitat ?? [];
  const focusPoint = habitat.find((h) => h.hour_offset === focusHour);

  // Per-crew state at focus hour
  const crewAtFocus = (result?.crew ?? []).map((c) => {
    const pt = c.trajectory.find((p) => p.hour_offset === focusHour) ?? c.trajectory[0];
    const first = c.trajectory[0];
    return { crew_id: c.crew_id, pt, first, trajectory: c.trajectory };
  }).sort((a, b) => b.pt.debt_hours - a.pt.debt_hours);

  const missionHourLabel = (offset: number) => {
    if (!result) return `+${offset}h`;
    const t = (result.t0_mission_h + offset) % 24;
    return `${String(Math.floor(t)).padStart(2, "0")}:${String(Math.round((t % 1) * 60)).padStart(2, "0")}`;
  };

  return (
    <div className="p-4 space-y-4 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <span className="text-accent">◐</span> Digital Twin · Forward Simulation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Project circadian &amp; affect trajectories forward. Read-only — the live pacemaker is never touched.
          </p>
        </div>
        <div className="text-xs text-slate-600 font-mono">
          {result ? `t₀ = mission ${result.t0_mission_h.toFixed(1)}h` : ""}
        </div>
      </div>

      {/* Control bar */}
      <div className="border border-surface-2 rounded-xl p-4 bg-surface/50 grid grid-cols-12 gap-4 items-end">
        <div className="col-span-3">
          <label className="label-xs text-slate-400 block mb-1.5">Horizon · {horizon}h</label>
          <input type="range" min={4} max={48} step={2} value={horizon}
            onChange={(e) => setHorizon(parseInt(e.target.value))}
            className="w-full accent-accent" aria-label="Forecast horizon hours" />
        </div>
        <div className="col-span-3">
          <label className="label-xs text-slate-400 block mb-1.5">What-if scenario</label>
          <select value={scenario} onChange={(e) => setScenario(e.target.value)}
            aria-label="What-if scenario"
            className="w-full px-2 py-1.5 bg-surface-2 border border-surface-3 rounded text-xs text-slate-300 focus:outline-none focus:border-accent">
            {SCENARIOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="col-span-3">
          <label className="label-xs text-slate-400 block mb-1.5">
            Inject at {scenario ? `· +${injectAt}h` : "(baseline)"}
          </label>
          <input type="range" min={0} max={Math.max(0, horizon - 1)} step={1} value={injectAt}
            disabled={!scenario}
            onChange={(e) => setInjectAt(parseInt(e.target.value))}
            className="w-full accent-warning disabled:opacity-40" aria-label="Scenario injection hour" />
        </div>
        <div className="col-span-3 flex gap-2">
          <button onClick={run} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-accent/15 border border-accent/40 text-accent text-xs font-medium hover:bg-accent/25 transition-colors disabled:opacity-50">
            {loading ? "Simulating…" : "▷ Run Simulation"}
          </button>
        </div>
      </div>

      {!result && !loading && (
        <div className="text-center text-slate-500 text-sm py-16">Run a simulation to project the mission forward.</div>
      )}

      {result && (
        <>
          {/* Habitat forecast chart */}
          <div className="border border-surface-2 rounded-xl p-4 bg-surface/50">
            <div className="flex items-center justify-between mb-3">
              <div className="label-xs text-slate-400">Habitat Aggregate Forecast</div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-accent inline-block" /> Alertness</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-warning inline-block" /> Circadian debt</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-success inline-block" /> Mean valence</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-danger inline-block" /> Friction index</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={habitat} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
                <CartesianGrid stroke="#182036" strokeDasharray="3 3" />
                <XAxis dataKey="hour_offset" stroke="#5e7496" fontSize={11}
                  tickFormatter={(h) => `+${h}h`} />
                <YAxis stroke="#5e7496" fontSize={11} domain={[-1, "auto"]} />
                <Tooltip contentStyle={{ background: "#101726", border: "1px solid #263050", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(h) => `+${h}h · ${missionHourLabel(Number(h))}`} />
                {result.scenario && result.scenario_at_hour != null && (
                  <ReferenceLine x={result.scenario_at_hour} stroke="#f87171" strokeDasharray="4 4"
                    label={{ value: result.scenario, fill: "#f87171", fontSize: 10, position: "insideTopRight" }} />
                )}
                <ReferenceLine x={focusHour} stroke="#38bdf8" strokeWidth={1.5} />
                <Line type="monotone" dataKey="mean_alertness" stroke="#38bdf8" strokeWidth={1.6} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="mean_debt" stroke="#fbbf24" strokeWidth={1.6} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="mean_valence" stroke="#34d399" strokeWidth={1.6} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="friction_index" stroke="#f87171" strokeWidth={1.6} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>

            {/* Timeline scrubber */}
            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => setPlaying((p) => !p)}
                className="px-3 py-1.5 rounded-lg border border-surface-3 text-xs text-slate-300 hover:border-accent/40 hover:text-accent transition-colors shrink-0">
                {playing ? "⏸ Pause" : "▶ Play"}
              </button>
              <input type="range" min={0} max={result.horizon_hours} step={1} value={focusHour}
                onChange={(e) => { setPlaying(false); setFocusHour(parseInt(e.target.value)); }}
                className="flex-1 accent-accent" aria-label="Timeline scrubber" />
              <div className="shrink-0 text-xs font-mono text-accent w-28 text-right">
                +{focusHour}h · {missionHourLabel(focusHour)}
              </div>
            </div>
          </div>

          {/* Focus-hour summary tiles */}
          {focusPoint && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Mean Alertness", value: `${(focusPoint.mean_alertness * 100).toFixed(0)}%`, color: "#38bdf8" },
                { label: "Mean Circadian Debt", value: `${focusPoint.mean_debt.toFixed(1)}h`, color: debtColor(focusPoint.mean_debt) },
                { label: "Mean Valence", value: focusPoint.mean_valence.toFixed(2), color: valenceColor(focusPoint.mean_valence) },
                { label: "Friction Index", value: focusPoint.friction_index.toFixed(2), color: focusPoint.friction_index > 1 ? "#f87171" : "#34d399" },
              ].map((t) => (
                <div key={t.label} className="border border-surface-2 rounded-xl p-3 bg-surface/40">
                  <div className="data-label mb-1">{t.label}</div>
                  <div className="font-mono text-xl font-bold" style={{ color: t.color }}>{t.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Per-crew projected state */}
          <div className="border border-surface-2 rounded-xl p-4 bg-surface/50">
            <div className="label-xs text-slate-400 mb-3">
              Crew Projection at +{focusHour}h · sorted by circadian debt
            </div>
            <div className="grid grid-cols-3 gap-3">
              {crewAtFocus.map(({ crew_id, pt, first, trajectory }) => {
                const dv = pt.valence - first.valence;
                return (
                  <div key={crew_id} className="border border-surface-2 rounded-lg p-3 bg-surface/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {crewMeta[crew_id]?.display_name?.split(" ").slice(-1)[0] ?? crew_id}
                      </span>
                      <span className="w-2 h-2 rounded-full" style={{ background: valenceColor(pt.valence) }} />
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs mb-2">
                      <div>
                        <div className="data-label">Alert</div>
                        <div className="font-mono text-accent">{(pt.alertness * 100).toFixed(0)}%</div>
                      </div>
                      <div>
                        <div className="data-label">Debt</div>
                        <div className="font-mono" style={{ color: debtColor(pt.debt_hours) }}>{pt.debt_hours.toFixed(1)}h</div>
                      </div>
                      <div>
                        <div className="data-label">Valence</div>
                        <div className="font-mono" style={{ color: valenceColor(pt.valence) }}>
                          {pt.valence.toFixed(2)}
                          <span className={`ml-1 text-xs ${dv >= 0 ? "text-success" : "text-danger"}`}>
                            {dv >= 0 ? "▲" : "▼"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Sparkline data={trajectory} dataKey="valence" color={valenceColor(pt.valence)} />
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-slate-600 italic">
              Trajectories are demonstrator forecasts from the Kronauer oscillator + trained affect estimator.
              Indicative, not diagnostic.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
