"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const GalaxyBackground = dynamic(() => import("@/components/GalaxyBackground"), { ssr: false });

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") || "ground";
  const { login: setAuth } = useAuthStore();

  const [username, setUsername] = useState(role === "ground" ? "ground" : "crew01");
  const [password, setPassword] = useState(role === "ground" ? "ground" : "crew");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isGround = role === "ground";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await login(username, password);
      setAuth(data.access_token, data.role, data.crew_id);
      if (data.role === "GROUND") {
        router.push("/ground");
      } else {
        router.push(`/crew/${data.crew_id}`);
      }
    } catch (err) {
      setError("Invalid credentials. Try ground/ground or crew01/crew");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <GalaxyBackground opacity={0.6} count={9000} bgStars={1600} />
      <div className="fixed inset-0 neural-grid opacity-20 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <button onClick={() => router.push("/")}
            className="text-3xl font-bold text-accent hover:opacity-80 transition-opacity font-mono">
            SYNAPSE-1
          </button>
          <p className="text-slate-500 text-sm mt-1">Digital Twin · Operational Interface</p>
        </div>

        <div className={`border rounded-2xl p-8 backdrop-blur-sm bg-surface/60 ${isGround ? "border-accent/30" : "border-blue-500/30"}`}
          style={{ boxShadow: isGround ? "0 0 30px rgba(6,182,212,0.1)" : "0 0 30px rgba(96,165,250,0.1)" }}>

          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-6 ${isGround ? "bg-accent/10 border border-accent/30 text-accent" : "bg-blue-500/10 border border-blue-500/30 text-blue-400"}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${isGround ? "bg-accent" : "bg-blue-400"}`} />
            {isGround ? "GROUND CONTROL ACCESS" : "CREW COMPANION ACCESS"}
          </div>

          <h2 className="text-xl font-semibold text-slate-100 mb-1">
            {isGround ? "Mission Control Login" : "Crew Member Login"}
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {isGround
              ? "Full habitat analytics, ML models, ethical audit"
              : "Personal companion view, private journal, mood weather"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-xs text-slate-400 block mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-surface-2 border border-surface-3 text-slate-100 font-mono text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-slate-600"
                placeholder={isGround ? "ground" : "crew01 – crew12"}
              />
            </div>

            <div>
              <label className="label-xs text-slate-400 block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-surface-2 border border-surface-3 text-slate-100 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-semibold tracking-widest uppercase text-sm transition-all duration-200 disabled:opacity-50 ${isGround ? "bg-accent text-background hover:bg-accent/90 hover:shadow-glow" : "bg-blue-500 text-white hover:bg-blue-400 hover:shadow-[0_0_20px_rgba(96,165,250,0.4)]"}`}
            >
              {loading ? "CONNECTING..." : "ACCESS HABITAT"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-surface-2">
            <p className="label-xs text-slate-600 mb-3">Demo credentials</p>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-surface-2 rounded-lg p-2">
                <div className="text-slate-400">Ground</div>
                <div className="text-accent">ground / ground</div>
              </div>
              <div className="bg-surface-2 rounded-lg p-2">
                <div className="text-slate-400">Any Crew</div>
                <div className="text-blue-400">crew01–12 / crew</div>
              </div>
            </div>
          </div>
        </div>

        <button onClick={() => router.push("/")}
          className="mt-4 w-full text-center text-slate-600 hover:text-slate-400 text-sm transition-colors">
          ← Back to habitat
        </button>
      </div>
    </div>
  );
}

