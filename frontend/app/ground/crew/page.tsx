"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { getAllCrew, getCircadianForecast } from "@/lib/api";
import { getCircadianDebtColor, getMoodWeather } from "@/lib/utils";
import type { Crew, CircadianForecastPoint } from "@/lib/types";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

function CircadianRingMini({ phase, debt, diameter = 80 }: { phase: number; debt: number; diameter?: number }) {
  const r = diameter / 2 - 8;
  const circ = 2 * Math.PI * r;
  const scheduleAngle = ((new Date().getHours() % 24) / 24) * 360;
  const phaseAngle = (phase / 24) * 360;
  const debtColor = getCircadianDebtColor(debt);

  return (
    <svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`}>
      {/* Outer ring: schedule */}
      <circle cx={diameter/2} cy={diameter/2} r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
      <circle cx={diameter/2} cy={diameter/2} r={r} fill="none" stroke="#334155" strokeWidth="3"
        strokeDasharray={`${(scheduleAngle / 360) * circ} ${circ}`}
        transform={`rotate(-90 ${diameter/2} ${diameter/2})`} />
      {/* Inner ring: biological phase */}
      <circle cx={diameter/2} cy={diameter/2} r={r - 7} fill="none" stroke="#1e293b" strokeWidth="3" />
      <circle cx={diameter/2} cy={diameter/2} r={r - 7} fill="none" stroke={debtColor} strokeWidth="3"
        strokeDasharray={`${(phaseAngle / 360) * (2 * Math.PI * (r - 7))} ${2 * Math.PI * (r - 7)}`}
        transform={`rotate(-90 ${diameter/2} ${diameter/2})`} />
      {/* Debt indicator */}
      <text x={diameter/2} y={diameter/2 + 4} textAnchor="middle" fill={debtColor} fontSize="10" fontFamily="monospace">
        {debt.toFixed(1)}h
      </text>
    </svg>
  );
}

function CrewDetailCard({ crew }: { crew: Crew }) {
  const [forecast, setForecast] = useState<CircadianForecastPoint[]>([]);
  const { token } = useAuthStore();
  const bio = crew.bio;
  const circ = crew.circadian;
  const affect = crew.affect;

  useEffect(() => {
    if (token) {
      getCircadianForecast(crew.crew_id).then(d => setForecast(d.forecast || [])).catch(() => {});
    }
  }, [token, crew.crew_id]);

  const paused = crew.privacy_paused;

  return (
    <div className="border border-surface-2 rounded-xl p-4 bg-surface/40 hover:border-accent/20 transition-all">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent/20 to-surface-3 flex items-center justify-center font-mono font-semibold text-sm text-accent"
          title={paused ? "Biometric sharing paused" : getMoodWeather(affect?.arousal ?? 0, affect?.valence ?? 0)}>
          {crew.display_name.split(" ").pop()?.charAt(0) ?? crew.crew_id.slice(-2)}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-100">{crew.display_name}</div>
          <div className="text-xs text-slate-500">{crew.role} · {crew.crew_id}</div>
        </div>
        {paused && <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded">Paused</span>}
      </div>

      {paused ? (
        <div className="text-xs text-warning/80 text-center py-4 border border-warning/20 rounded-lg">
          Crew has paused biometric sharing
        </div>
      ) : (
        <>
          {/* Biometrics */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: "HRV", value: bio?.hrv_rmssd?.toFixed(0) ?? "–", unit: "ms", color: "text-accent" },
              { label: "HR", value: bio?.hr?.toFixed(0) ?? "–", unit: "bpm", color: "text-accent" },
              { label: "EDA", value: bio?.eda?.toFixed(2) ?? "–", unit: "µS", color: "text-accent" },
              { label: "Sleep Debt", value: bio?.sleep_debt?.toFixed(1) ?? "–", unit: "h", color: (bio?.sleep_debt ?? 0) > 3 ? "text-warning" : "text-accent" },
            ].map((m) => (
              <div key={m.label} className="bg-surface-2 rounded-lg p-2 text-center">
                <div className="data-label mb-1">{m.label}</div>
                <div className={`font-mono text-sm ${m.color}`}>{m.value}<span className="text-xs text-slate-500"> {m.unit}</span></div>
              </div>
            ))}
          </div>

          {/* Circadian + Affect */}
          <div className="flex gap-3 mb-3">
            {circ && (
              <div className="flex items-center gap-2">
                <CircadianRingMini phase={circ.phase_hours} debt={circ.debt_hours} />
                <div className="text-xs space-y-1">
                  <div><span className="text-slate-500">Phase: </span><span className="font-mono text-slate-300">{circ.phase_hours.toFixed(1)}h</span></div>
                  <div><span className="text-slate-500">Melatonin: </span><span className="font-mono text-slate-300">{circ.predicted_melatonin_onset.toFixed(0)}:00</span></div>
                  <div><span className="text-slate-500">Alertness: </span><span className="font-mono text-accent">{(circ.alertness * 100).toFixed(0)}%</span></div>
                </div>
              </div>
            )}
            {affect && !paused && (
              <div className="flex-1">
                <div className="label-xs text-slate-400 mb-1">Affect Estimate</div>
                <div className="relative w-full aspect-square max-w-[80px] mx-auto">
                  <svg viewBox="-1.2 -1.2 2.4 2.4" className="w-full h-full">
                    <line x1="-1" x2="1" y1="0" y2="0" stroke="#1e293b" strokeWidth="0.05" />
                    <line x1="0" x2="0" y1="-1" y2="1" stroke="#1e293b" strokeWidth="0.05" />
                    <circle cx={affect.valence} cy={-affect.arousal} r="0.15"
                      fill="#06b6d4" stroke="#0e7490" strokeWidth="0.05" />
                    <text x="-1" y="0.15" fill="#334155" fontSize="0.2">Neg</text>
                    <text x="0.6" y="0.15" fill="#334155" fontSize="0.2">Pos</text>
                  </svg>
                </div>
                <div className="text-xs text-center text-slate-500 mt-1">
                  {getMoodWeather(affect.arousal, affect.valence)}
                </div>
              </div>
            )}
          </div>

          {/* 16h alertness forecast */}
          {forecast.length > 0 && (
            <div>
              <div className="label-xs text-slate-400 mb-1">16h Alertness Forecast</div>
              <ResponsiveContainer width="100%" height={50}>
                <LineChart data={forecast}>
                  <Line type="monotone" dataKey="alertness" stroke="#06b6d4" dot={false} strokeWidth={1.5} />
                  <XAxis dataKey="hour_offset" hide />
                  <YAxis domain={[0, 1]} hide />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CrewPage() {
  const { token } = useAuthStore();
  const [crew, setCrew] = useState<Crew[]>([]);

  // Polling (was: 5s poll + 12 redundant bio WebSockets — getAllCrew already
  // returns live bio for every crew member, so one faster poll covers both).
  useEffect(() => {
    if (!token) return;
    const load = () => getAllCrew().then(setCrew).catch(() => {});
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [token]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Crew Biometrics</h1>
        <p className="text-slate-500 text-sm mt-1">
          Live biometric monitoring. Crew can pause sharing at any time — this is logged to the ethics ledger.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {crew.map(c => (
          <CrewDetailCard key={c.crew_id} crew={c} />
        ))}
      </div>
    </div>
  );
}

