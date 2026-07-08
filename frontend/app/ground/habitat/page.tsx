"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useHabitatStore, useAuthStore } from "@/lib/store";
import { setChromotherapy, getCohesionHeatmap } from "@/lib/api";
import { LEVEL_COLORS, CHROMOTHERAPY_PRESETS } from "@/lib/types";

// Dynamic import for R3F (server-side-render disabled)
const HabitatViewer3D = dynamic(() => import("@/components/habitat/HabitatViewer3D"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="text-slate-400 text-sm">Loading 3D Viewer...</div>
      </div>
    </div>
  ),
});

const CAMERA_PRESETS = ["Overview", "Cutaway", "Soma Ring", "Dendrite Grid", "Atrium Below"];

export default function HabitatPage() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState("Overview");
  const [heatmapMode, setHeatmapMode] = useState<string | null>(null);
  const [cohesion, setCohesion] = useState<Record<string, { cohesion: number }>>({});
  const { zones } = useHabitatStore();
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token || heatmapMode !== "Cohesion") return;
    const load = () => getCohesionHeatmap().then(setCohesion).catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [token, heatmapMode]);

  const zone = selectedZone ? zones[selectedZone] : null;

  const handleChromotherapy = async (preset: string) => {
    if (!selectedZone) return;
    await setChromotherapy(selectedZone, preset);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="h-12 border-b border-surface-2 flex items-center gap-4 px-4 bg-surface/80">
        <div className="label-xs text-slate-400">Camera:</div>
        <div className="flex gap-1">
          {CAMERA_PRESETS.map((p) => (
            <button key={p} onClick={() => setCameraPreset(p)}
              className={`px-2 py-1 rounded text-xs transition-colors ${cameraPreset === p ? "bg-accent/20 text-accent border border-accent/40" : "text-slate-400 hover:text-slate-200 border border-transparent"}`}>
              {p}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-surface-3" />
        <div className="label-xs text-slate-400">Heatmap:</div>
        <div className="flex gap-1">
          {["Lux", "CCT", "Acoustic", "Cohesion", "CO₂", "Off"].map((m) => (
            <button key={m} onClick={() => setHeatmapMode(m === "Off" ? null : m)}
              className={`px-2 py-1 rounded text-xs transition-colors ${heatmapMode === m ? "bg-accent/20 text-accent border border-accent/40" : "text-slate-400 hover:text-slate-200 border border-transparent"}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 3D Viewer */}
        <div className="flex-1 relative">
          <HabitatViewer3D
            selectedZone={selectedZone}
            onSelectZone={setSelectedZone}
            cameraPreset={cameraPreset}
            heatmapMode={heatmapMode}
            cohesion={cohesion}
          />
        </div>

        {/* Inspector panel */}
        {zone && (
          <div className="w-72 border-l border-surface-2 bg-surface/60 overflow-y-auto p-4 space-y-4">
            {/* Zone header */}
            <div>
              <div className={`inline-flex px-2 py-0.5 rounded text-xs mb-1`}
                style={{ background: `${LEVEL_COLORS[zone.level]}20`, color: LEVEL_COLORS[zone.level] }}>
                {zone.level}
              </div>
              <h3 className="text-sm font-semibold text-slate-100">{zone.name}</h3>
              <p className="text-xs text-slate-500 mt-1">{zone.description}</p>
            </div>

            {/* Live environmental state */}
            <div>
              <div className="label-xs text-slate-400 mb-2">Environmental State</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Lux", value: `${zone.lux?.toFixed(0) ?? "–"} lx` },
                  { label: "CCT", value: `${zone.cct?.toFixed(0) ?? "–"} K` },
                  { label: "dB SPL", value: `${zone.db_spl?.toFixed(1) ?? "–"} dB` },
                  { label: "CO₂", value: `${zone.co2_ppm?.toFixed(0) ?? "–"} ppm` },
                  { label: "Temp", value: `${zone.temp_c?.toFixed(1) ?? "–"} °C` },
                  { label: "Humidity", value: `${zone.humidity?.toFixed(0) ?? "–"}%` },
                ].map((r) => (
                  <div key={r.label} className="bg-surface-2 rounded-lg p-2">
                    <div className="data-label mb-0.5">{r.label}</div>
                    <div className="font-mono text-xs text-accent">{r.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sensory preset */}
            <div>
              <div className="label-xs text-slate-400 mb-2">Sensory Profile</div>
              <div className="bg-surface-2 rounded-lg p-2 text-xs space-y-1">
                <div><span className="text-slate-500">Chromotherapy: </span><span className="text-accent">{zone.chromotherapy_preset}</span></div>
                <div><span className="text-slate-500">Solfeggio: </span>
                  <span className="text-slate-300">{zone.solfeggio_freq} Hz
                    <span className="text-slate-600 ml-1">(speculative — ritual acoustic layer)</span>
                  </span>
                </div>
                <div><span className="text-slate-500">Airflow var: </span><span className="text-slate-300">{zone.airflow_seed?.toFixed(2)}</span></div>
              </div>
            </div>

            {/* Chromotherapy control */}
            {zone.level === "DENDRITE" || true ? (
              <div>
                <div className="label-xs text-slate-400 mb-2">Chromotherapy Override</div>
                <div className="space-y-1">
                  {CHROMOTHERAPY_PRESETS.map((p) => (
                    <button key={p} onClick={() => handleChromotherapy(p)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${zone.chromotherapy_preset === p ? "bg-accent/20 text-accent border border-accent/30" : "border border-surface-2 text-slate-400 hover:border-accent/30 hover:text-slate-200"}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <button onClick={() => setSelectedZone(null)}
              className="w-full py-2 rounded-lg border border-surface-2 text-xs text-slate-500 hover:text-slate-300 hover:border-surface-3 transition-colors">
              Deselect zone
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

