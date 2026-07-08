"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { getCrewCircadian, getCrewAffect, getCommsStatus, setChromotherapy, triggerPrivacyPause, getCircadianForecast } from "@/lib/api";
import { createBioWS } from "@/lib/api";
import { getMoodWeather, getCircadianDebtColor } from "@/lib/utils";
import type { CircadianState, AffectEstimate, CommsStatus, BioSample, CircadianForecastPoint } from "@/lib/types";
import { CHROMOTHERAPY_PRESETS } from "@/lib/types";
import { AreaChart, Area, XAxis, ResponsiveContainer } from "recharts";

function MoodWeatherGlyph({ arousal, valence }: { arousal: number; valence: number }) {
  const weather = getMoodWeather(arousal, valence);
  const dotColor = valence > 0.3 ? "#10b981" : valence > -0.1 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex items-center gap-6 mood-glyph">
      {/* Affect-plane plot: valence (x) vs arousal (y) */}
      <div className="shrink-0">
        <svg width="88" height="88" viewBox="-1.3 -1.3 2.6 2.6">
          <circle cx="0" cy="0" r="1.2" fill="none" stroke="#1e293b" strokeWidth="0.06" />
          <line x1="-1.1" x2="1.1" y1="0" y2="0" stroke="#1e293b" strokeWidth="0.04" />
          <line x1="0" x2="0" y1="-1.1" y2="1.1" stroke="#1e293b" strokeWidth="0.04" />
          <text x="-1.05" y="0.14" fill="#334155" fontSize="0.19" fontFamily="monospace">neg</text>
          <text x="0.62" y="0.14" fill="#334155" fontSize="0.19" fontFamily="monospace">pos</text>
          <text x="0" y="-0.78" fill="#334155" fontSize="0.19" fontFamily="monospace" textAnchor="middle">hi</text>
          <text x="0" y="1.05" fill="#334155" fontSize="0.19" fontFamily="monospace" textAnchor="middle">lo</text>
          <circle cx={valence} cy={-arousal} r="0.5" fill={dotColor} opacity="0.1" />
          <circle cx={valence} cy={-arousal} r="0.32" fill={dotColor} opacity="0.22" />
          <circle cx={valence} cy={-arousal} r="0.16" fill={dotColor} opacity="0.9" />
        </svg>
      </div>
      <div className="space-y-1.5">
        <div className="text-xs text-slate-500 font-mono uppercase tracking-widest">Affective state</div>
        <div className="text-sm font-medium text-slate-100">{weather}</div>
        <div className="text-xs text-slate-500">
          Valence · Arousal estimate from biometric stream
        </div>
        <div className="text-xs text-slate-600 italic">
          Not a score, not a judgement — a calibrated reading.
        </div>
      </div>
    </div>
  );
}

function CircadianScheduleBar({ circadian, forecast }: { circadian: CircadianState | null; forecast: CircadianForecastPoint[] }) {
  if (!forecast.length) return null;

  return (
    <div className="space-y-2">
      <div className="label-xs text-slate-400">Today's Light Schedule · Biological Phase</div>
      <div className="relative h-12 rounded-lg overflow-hidden">
        {/* Gradient bar showing day schedule */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(to right, #1e1b4b 0%, #7c3aed 10%, #2563eb 25%, #0891b2 40%, #f59e0b 50%, #dc2626 65%, #7c3aed 80%, #1e1b4b 100%)"
        }} />
        {/* Current time indicator */}
        {circadian && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-glow"
            style={{ left: `${(circadian.phase_hours / 24) * 100}%` }} />
        )}
        {/* Time labels */}
        <div className="absolute inset-0 flex items-end px-2 pb-1">
          {["00", "06", "12", "18", "24"].map((t, i) => (
            <div key={t} className="flex-1 text-xs text-white/60 font-mono" style={{ textAlign: "left" }}>{t}</div>
          ))}
        </div>
      </div>
      {circadian && (
        <div className="flex justify-between text-xs text-slate-500">
          <span>Current phase: <span className="text-accent font-mono">{circadian.phase_hours.toFixed(1)}h</span></span>
          <span>Circadian debt: <span style={{ color: getCircadianDebtColor(circadian.debt_hours) }} className="font-mono">{circadian.debt_hours.toFixed(1)}h</span></span>
          <span>Melatonin onset: <span className="font-mono text-slate-300">{circadian.predicted_melatonin_onset.toFixed(0)}:00</span></span>
        </div>
      )}
    </div>
  );
}

function AlertnessChart({ forecast }: { forecast: CircadianForecastPoint[] }) {
  if (!forecast.length) return null;
  return (
    <ResponsiveContainer width="100%" height={60}>
      <AreaChart data={forecast}>
        <defs>
          <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="alertness" stroke="#06b6d4" fill="url(#alertGrad)" strokeWidth={1.5} dot={false} />
        <XAxis dataKey="hour_offset" hide />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function PrivacyControl({ crewId, onPause }: { crewId: string; onPause: () => void }) {
  const [pausing, setPausing] = useState(false);
  const [paused, setPaused] = useState(false);

  const handlePause = async () => {
    setPausing(true);
    try {
      await triggerPrivacyPause(crewId);
      setPaused(true);
      onPause();
    } catch {}
    setPausing(false);
  };

  return (
    <div className="border border-surface-2 rounded-xl p-4 bg-surface/50">
      <div className="label-xs text-slate-400 mb-2">Privacy Control</div>
      <p className="text-xs text-slate-500 mb-3">
        You control what Ground sees. Toggle below to pause your biometric sharing for 2 hours.
        This action is logged to the ethics ledger — your choice, your record.
      </p>
      {paused ? (
        <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 rounded-lg px-4 py-2 border border-warning/20">
          <div className="w-2 h-2 rounded-sm bg-warning shrink-0" />
          <span>Sharing paused for 2 hours</span>
        </div>
      ) : (
        <button onClick={handlePause} disabled={pausing}
          className="w-full py-2 rounded-lg border border-slate-500/30 bg-surface-2 text-slate-400 text-sm hover:border-warning/40 hover:text-warning transition-colors disabled:opacity-50">
          {pausing ? "Pausing..." : "Hide from Ground for 2 hours"}
        </button>
      )}
      <div className="mt-2 text-xs text-slate-600">
        Ground will see "crew has paused sharing" — no reason given, no data shown.
      </div>
    </div>
  );
}

function SuggestedAction({ circadian, bio }: { circadian: CircadianState | null; bio: BioSample | null }) {
  let suggestion = "You're in good rhythm today.";
  let detail = "No specific recommendation at this time.";

  if (circadian) {
    const hour = circadian.phase_hours;
    if (circadian.debt_hours > 2) {
      suggestion = "Your circadian debt is elevated.";
      detail = "Consider adjusting your pod lighting to Vedic Ochre (2000K) 2h before your predicted sleep time.";
    } else if (hour >= 9 && hour <= 11) {
      suggestion = "Peak alertness window approaching.";
      detail = "Your oscillator suggests a 20-minute walk in the Axon gallery in the next hour.";
    } else if (hour >= 14 && hour <= 16) {
      suggestion = "Post-noon dip — consider movement.";
      detail = "The aeroponic garden is lightly occupied. Tending your plant now may restore focus.";
    } else if (hour >= 21 || hour <= 2) {
      suggestion = "Wind-down phase beginning.";
      detail = "The Holographic Hearth has a calm Earth-forest scene running. Social time before sleep supports HRV recovery.";
    }
  }

  if (bio && bio.sleep_debt > 3) {
    suggestion = "Sleep debt accumulating.";
    detail = "Consider requesting an earlier sleep window. Your circadian oscillator will compensate.";
  }

  return (
    <div className="border border-accent/20 rounded-xl p-4 bg-accent/5">
      <div className="flex items-start gap-3">
        <div className="text-2xl">◈</div>
        <div>
          <div className="text-sm font-medium text-accent">{suggestion}</div>
          <div className="text-xs text-slate-400 mt-1">{detail}</div>
          <div className="text-xs text-slate-600 mt-2 italic">
            Suggested by the circadian oscillator — always your choice, never a command.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CrewHomePage({ params }: { params: { id: string } }) {
  const crewId = params.id;
  const { token } = useAuthStore();
  const [circadian, setCircadian] = useState<CircadianState | null>(null);
  const [affect, setAffect] = useState<AffectEstimate | null>(null);
  const [bio, setBio] = useState<BioSample | null>(null);
  const [comms, setComms] = useState<CommsStatus | null>(null);
  const [forecast, setForecast] = useState<CircadianForecastPoint[]>([]);
  const [chromoPreset, setChromoPreset] = useState("Neutral White");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      const [circ, aff, commsData, forecastData] = await Promise.all([
        getCrewCircadian(crewId),
        getCrewAffect(crewId),
        getCommsStatus(),
        getCircadianForecast(crewId),
      ]);
      setCircadian(circ);
      setAffect(aff);
      setComms(commsData);
      setForecast(forecastData.forecast || []);
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [token, crewId]);

  useEffect(() => {
    if (!token) return;
    const ws = createBioWS(crewId, token, (msg: any) => {
      if (msg.type === "bio_update") setBio(msg.data);
    });
    return () => ws.close();
  }, [token, crewId]);

  const handleChromotherapy = async (preset: string) => {
    const podId = `zone_dendrite_pod_${crewId.replace("crew", "")}`;
    await setChromotherapy(podId, preset);
    setChromoPreset(preset);
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Greeting */}
      <div className="text-center space-y-1">
        <div className="text-slate-400 text-sm">Welcome back,</div>
        <div className="text-2xl font-light text-slate-100 capitalize">
          {crewId.replace("crew", "Crew ")}
        </div>
        {comms && (
          <div className="text-xs text-slate-500 font-mono">
            Next letter window: {Math.floor(comms.next_window_s / 3600)}h {Math.floor((comms.next_window_s % 3600) / 60)}m
          </div>
        )}
      </div>

      {/* Mood weather — crew-only view, never a number */}
      {affect && !paused && (
        <div className="border border-surface-2 rounded-xl p-6 bg-surface/50">
          <MoodWeatherGlyph arousal={affect.arousal} valence={affect.valence} />
        </div>
      )}

      {/* Suggested action */}
      <SuggestedAction circadian={circadian} bio={bio} />

      {/* Circadian schedule */}
      <div className="border border-surface-2 rounded-xl p-4 bg-surface/50 space-y-3">
        <CircadianScheduleBar circadian={circadian} forecast={forecast} />
        <AlertnessChart forecast={forecast} />
        <div className="text-xs text-slate-500 text-center">16h alertness forecast · Your oscillator</div>
      </div>

      {/* Pod chromotherapy control */}
      <div className="border border-surface-2 rounded-xl p-4 bg-surface/50">
        <div className="label-xs text-slate-400 mb-3">Pod Lighting · Chromotherapy</div>
        <div className="grid grid-cols-3 gap-2">
          {CHROMOTHERAPY_PRESETS.map((p) => (
            <button key={p} onClick={() => handleChromotherapy(p)}
              className={`px-3 py-2 rounded-lg text-xs transition-colors border ${chromoPreset === p ? "bg-accent/20 border-accent/40 text-accent" : "border-surface-2 text-slate-400 hover:border-accent/30 hover:text-slate-200"}`}>
              {p}
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-slate-600">
          Your pod's CCT/lux adjusts automatically based on your circadian phase.
          This override always takes priority.
        </div>
      </div>

      {/* Live biometrics — only self */}
      {bio && !paused && (
        <div className="border border-surface-2 rounded-xl p-4 bg-surface/50">
          <div className="label-xs text-slate-400 mb-3">Your Biometrics · Live</div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "HRV", value: bio.hrv_rmssd.toFixed(0), unit: "ms" },
              { label: "Heart Rate", value: bio.hr.toFixed(0), unit: "bpm" },
              { label: "Core Temp", value: bio.core_temp.toFixed(2), unit: "°C" },
              { label: "Sleep Debt", value: bio.sleep_debt.toFixed(1), unit: "h" },
            ].map((m) => (
              <div key={m.label} className="bg-surface-2 rounded-lg p-3 text-center">
                <div className="data-label mb-1">{m.label}</div>
                <div className="font-mono text-sm text-accent">{m.value}<span className="text-xs text-slate-500"> {m.unit}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy control */}
      <PrivacyControl crewId={crewId} onPause={() => setPaused(true)} />
    </div>
  );
}
