"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { getModelCard } from "@/lib/api";
import type { ModelCard } from "@/lib/types";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

function StatTile({ label, value, sub, color = "#38bdf8" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="border border-surface-2 rounded-xl p-4 bg-surface/40">
      <div className="data-label mb-1">{label}</div>
      <div className="font-mono text-2xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function ModelCardPage() {
  const { token } = useAuthStore();
  const [card, setCard] = useState<ModelCard | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    getModelCard().then((c) => { setCard(c); setLoaded(true); }).catch(() => setLoaded(true));
  }, [token]);

  if (loaded && (!card || !card.available)) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="border border-warning/30 bg-warning/5 rounded-xl p-6 text-center">
          <div className="text-warning text-sm mb-2">Affect model not yet trained</div>
          <code className="text-xs text-slate-400 bg-surface-2 px-2 py-1 rounded">py -3 ml/train_affect.py</code>
        </div>
      </div>
    );
  }
  if (!card || !card.available) return <div className="p-6 text-slate-500 text-sm">Loading model card…</div>;

  const m = card.metrics!;

  return (
    <div className="p-4 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <span className="text-accent">◈</span> {card.model_name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">{card.architecture}</p>
        </div>
        <div className="text-right text-xs text-slate-500 font-mono">
          <div>{card.framework}</div>
          <div>trained {card.trained_at ? new Date(card.trained_at).toLocaleString() : "—"}</div>
        </div>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-4 gap-3">
        <StatTile label="R² · Arousal" value={m.val_r2_arousal.toFixed(3)} sub="validation" color="#38bdf8" />
        <StatTile label="R² · Valence" value={m.val_r2_valence.toFixed(3)} sub="validation" color="#34d399" />
        <StatTile label="MAE · Arousal" value={m.val_mae_arousal.toFixed(3)} sub="mean abs error" color="#fbbf24" />
        <StatTile label="MAE · Valence" value={m.val_mae_valence.toFixed(3)} sub="mean abs error" color="#fbbf24" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Training curve */}
        <div className="col-span-7 border border-surface-2 rounded-xl p-4 bg-surface/50">
          <div className="label-xs text-slate-400 mb-3">Training Curve · SmoothL1 Loss</div>
          {card.history && card.history.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={card.history} margin={{ top: 8, right: 16, bottom: 4, left: -12 }}>
                <CartesianGrid stroke="#182036" strokeDasharray="3 3" />
                <XAxis dataKey="epoch" stroke="#5e7496" fontSize={11} />
                <YAxis stroke="#5e7496" fontSize={11} />
                <Tooltip contentStyle={{ background: "#101726", border: "1px solid #263050", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="train_loss" name="Train" stroke="#38bdf8" strokeWidth={1.6} dot={false} />
                <Line type="monotone" dataKey="val_loss" name="Validation" stroke="#34d399" strokeWidth={1.6} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="text-xs text-slate-500 py-12 text-center">No training history recorded.</div>}
        </div>

        {/* Provenance */}
        <div className="col-span-5 border border-surface-2 rounded-xl p-4 bg-surface/50">
          <div className="label-xs text-slate-400 mb-3">Provenance</div>
          <dl className="space-y-2 text-xs">
            {[
              ["Training samples", card.n_samples?.toLocaleString() ?? "—"],
              ["Train / val split", card.train_val_split ?? "—"],
              ["Epochs", String(card.epochs ?? "—")],
              ["Optimizer", card.optimizer ?? "—"],
              ["Loss", card.loss ?? "—"],
              ["Seed", String(card.seed ?? "—")],
              ["Outputs", (card.outputs ?? []).join(", ")],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-surface-2/60 pb-1.5">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-slate-300 font-mono text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3">
            <div className="data-label mb-1.5">Input features (7)</div>
            <div className="flex flex-wrap gap-1.5">
              {(card.feature_names ?? []).map((f) => (
                <span key={f} className="text-xs font-mono px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">{f}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Label rules + limitations */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-surface-2 rounded-xl p-4 bg-surface/50">
          <div className="label-xs text-slate-400 mb-3">Label Rules · Russell Circumplex quadrants</div>
          <ul className="space-y-2">
            {(card.label_rules ?? []).map((r, i) => (
              <li key={i} className="text-xs text-slate-300 font-mono bg-surface-2/50 rounded px-2 py-1.5">{r}</li>
            ))}
          </ul>
        </div>
        <div className="border border-danger/20 rounded-xl p-4 bg-danger/5">
          <div className="label-xs text-danger/80 mb-3">Known Limitations · Ethical disclosure</div>
          <ul className="space-y-2">
            {(card.limitations ?? []).map((l, i) => (
              <li key={i} className="text-xs text-slate-300 flex gap-2">
                <span className="text-danger/70 shrink-0">▪</span>{l}
              </li>
            ))}
          </ul>
          <div className="mt-3 text-xs text-slate-500 italic">
            &ldquo;Estimates&rdquo; not &ldquo;predicts&rdquo; — a demonstrator, never a clinical or occupational verdict.
          </div>
        </div>
      </div>
    </div>
  );
}
