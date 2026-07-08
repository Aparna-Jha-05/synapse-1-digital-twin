"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const GalaxyBackground = dynamic(() => import("@/components/GalaxyBackground"), { ssr: false });

function NeuralDiagram() {
  return (
    <svg viewBox="0 0 400 300" className="w-full max-w-md mx-auto opacity-90" xmlns="http://www.w3.org/2000/svg">
      {/* Connection lines */}
      <g stroke="rgba(6,182,212,0.3)" strokeWidth="1" fill="none">
        {/* Atrium to Soma */}
        <line x1="200" y1="150" x2="100" y2="240" />
        <line x1="200" y1="150" x2="200" y2="240" />
        <line x1="200" y1="150" x2="300" y2="240" />
        {/* Atrium to Axon */}
        <line x1="200" y1="150" x2="80" y2="155" />
        <line x1="200" y1="150" x2="320" y2="155" />
        <line x1="200" y1="150" x2="140" y2="160" />
        <line x1="200" y1="150" x2="260" y2="160" />
        {/* Atrium to Dendrites */}
        {[50, 90, 130, 170, 230, 270, 310, 350].map((x, i) => (
          <line key={i} x1="200" y1="150" x2={x} y2="55" />
        ))}
      </g>

      {/* Dendrite pods — Level 3 */}
      <g>
        {[40, 80, 120, 155, 190, 225, 260, 295, 330, 360].map((x, i) => (
          <g key={i}>
            <circle cx={x} cy="50" r="7" fill="rgba(96,165,250,0.2)" stroke="#60a5fa" strokeWidth="1" className="animate-pulse" />
            <circle cx={x} cy="50" r="3" fill="#60a5fa" />
          </g>
        ))}
        <text x="200" y="30" textAnchor="middle" fill="#60a5fa" fontSize="9" letterSpacing="2">
          DENDRITES · LEVEL 3 · SLEEP PODS
        </text>
      </g>

      {/* Axon ring — Level 2 */}
      <g>
        {[70, 130, 200, 270, 330].map((x, i) => (
          <g key={i}>
            <rect x={x - 10} y="140" width="20" height="20" rx="3"
              fill="rgba(52,211,153,0.15)" stroke="#34d399" strokeWidth="1" />
            <rect x={x - 5} y="145" width="10" height="10" rx="2" fill="#34d399" />
          </g>
        ))}
        <text x="200" y="130" textAnchor="middle" fill="#34d399" fontSize="9" letterSpacing="2">
          AXON · LEVEL 2 · WORK & LABS
        </text>
      </g>

      {/* Soma ring — Level 1 */}
      <g>
        {[100, 200, 300].map((x, i) => (
          <g key={i}>
            <rect x={x - 18} y="232" width="36" height="22" rx="4"
              fill="rgba(167,139,250,0.15)" stroke="#a78bfa" strokeWidth="1" />
            <rect x={x - 10} y="237" width="20" height="12" rx="2" fill="#a78bfa" />
          </g>
        ))}
        <text x="200" y="270" textAnchor="middle" fill="#a78bfa" fontSize="9" letterSpacing="2">
          SOMA · LEVEL 1 · COMMUNAL
        </text>
      </g>

      {/* Central Atrium — Hippocampal Anchor */}
      <g>
        <circle cx="200" cy="150" r="22" fill="rgba(6,182,212,0.1)" stroke="#06b6d4" strokeWidth="1.5" />
        <circle cx="200" cy="150" r="14" fill="rgba(6,182,212,0.15)" stroke="#06b6d4" strokeWidth="1" />
        <circle cx="200" cy="150" r="5" fill="#06b6d4" />
        {/* Pulse ring */}
        <circle cx="200" cy="150" r="22" fill="none" stroke="#06b6d4" strokeWidth="1"
          opacity="0.5" style={{ animation: "neuralPulse 2s ease-in-out infinite" }} />
      </g>
      <text x="200" y="190" textAnchor="middle" fill="#06b6d4" fontSize="7.5" letterSpacing="1.5">
        HIPPOCAMPAL ANCHOR
      </text>
      <text x="200" y="200" textAnchor="middle" fill="rgba(6,182,212,0.6)" fontSize="6.5">
        CENTRAL ATRIUM
      </text>
    </svg>
  );
}

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      <GalaxyBackground opacity={0.85} />

      {/* Neural grid overlay */}
      <div className="fixed inset-0 neural-grid opacity-30 pointer-events-none z-0" />

      {/* Radial glow from center */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(6,182,212,0.04) 0%, transparent 70%)" }} />

      <div className="relative z-10 flex flex-col items-center gap-10 px-6 py-16 max-w-4xl w-full">

        {/* Header */}
        <div className="text-center space-y-3 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/30 bg-accent/5 mb-4">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs text-accent tracking-widest font-mono uppercase">
              SpAr Conclave 2026 · Theme 3: Human-Centred & Behavioural Design
            </span>
          </div>

          <h1 className="text-6xl md:text-8xl font-bold tracking-tight"
            style={{ background: "linear-gradient(135deg, #06b6d4 0%, #818cf8 50%, #06b6d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundSize: "200% 200%", animation: "gradientShift 4s ease infinite" }}>
            SYNAPSE-1
          </h1>

          <p className="text-xl md:text-2xl text-slate-400 font-light tracking-wide">
            OPERATIONAL DIGITAL TWIN
          </p>

          <p className="text-sm text-slate-500 tracking-widest uppercase font-mono mt-2">
            Architecture as a Proactive Behavioural Support System
          </p>
        </div>

        {/* Neural Hierarchy Diagram */}
        <div className="w-full max-w-lg border border-surface-2 rounded-2xl bg-surface/50 backdrop-blur p-6 glow-cyan">
          <p className="text-center text-xs text-muted tracking-widest uppercase mb-4 font-mono">
            Habitat Architecture · Neural Ontology
          </p>
          <NeuralDiagram />
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: "#60a5fa" }} />
              <span className="text-xs text-slate-400">Dendrites</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "#34d399" }} />
              <span className="text-xs text-slate-400">Axon</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "#a78bfa" }} />
              <span className="text-xs text-slate-400">Soma</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: "#06b6d4" }} />
              <span className="text-xs text-slate-400">Atrium</span>
            </div>
          </div>
        </div>

        {/* Login buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
          <button
            onClick={() => router.push("/login?role=ground")}
            className="flex-1 px-8 py-4 rounded-xl border border-accent bg-accent/10 hover:bg-accent/20 text-accent font-semibold tracking-widest uppercase text-sm transition-all duration-200 hover:shadow-glow active:scale-95"
          >
            <div className="flex flex-col items-center gap-1">
              <span>⬡ GROUND CONTROL</span>
              <span className="text-xs font-normal text-accent/60 tracking-normal normal-case">
                Mission psychologist · Full analytics
              </span>
            </div>
          </button>

          <button
            onClick={() => router.push("/login?role=crew")}
            className="flex-1 px-8 py-4 rounded-xl border border-dendrite/60 bg-dendrite/10 hover:bg-dendrite/20 text-blue-400 font-semibold tracking-widest uppercase text-sm transition-all duration-200 hover:shadow-[0_0_20px_rgba(96,165,250,0.3)] active:scale-95"
          >
            <div className="flex flex-col items-center gap-1">
              <span>◈ CREW COMPANION</span>
              <span className="text-xs font-normal text-blue-400/60 tracking-normal normal-case">
                Habitat inhabitant · Personal view
              </span>
            </div>
          </button>
        </div>

        {/* Mission stats */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
          {[
            { label: "Crew Members", value: "12" },
            { label: "Habitat Zones", value: "17" },
            { label: "ML Models Active", value: "2" },
          ].map((stat) => (
            <div key={stat.label} className="text-center border border-surface-2 rounded-lg p-3 bg-surface/30">
              <div className="font-mono text-2xl text-accent">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-600 font-mono text-center">
          SPAR26-HCBD-06 · Lunar Habitat Design · 2026
        </p>
      </div>

      <style jsx global>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}

