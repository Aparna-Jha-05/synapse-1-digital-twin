"use client";

import { create } from "zustand";
import type { Zone, BioSample, Crew, CircadianState, AffectEstimate } from "./types";

interface AuthStore {
  token: string | null;
  role: "GROUND" | "CREW" | null;
  crewId: string | null;
  login: (token: string, role: "GROUND" | "CREW", crewId: string | null) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  role: null,
  crewId: null,
  login: (token, role, crewId) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("synapse_token", token);
      localStorage.setItem("synapse_role", role);
      if (crewId) localStorage.setItem("synapse_crew_id", crewId);
    }
    set({ token, role, crewId });
  },
  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("synapse_token");
      localStorage.removeItem("synapse_role");
      localStorage.removeItem("synapse_crew_id");
    }
    set({ token: null, role: null, crewId: null });
  },
  hydrate: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("synapse_token");
    const role = localStorage.getItem("synapse_role") as "GROUND" | "CREW" | null;
    const crewId = localStorage.getItem("synapse_crew_id");
    if (token && role) set({ token, role, crewId });
  },
}));

interface HabitatStore {
  zones: Record<string, Zone>;
  updateZone: (id: string, data: Partial<Zone>) => void;
  updateEnvBatch: (data: Record<string, Partial<Zone>>) => void;
}

export const useHabitatStore = create<HabitatStore>((set) => ({
  zones: {},
  updateZone: (id, data) =>
    set((state) => ({ zones: { ...state.zones, [id]: { ...state.zones[id], ...data } as Zone } })),
  updateEnvBatch: (data) =>
    set((state) => {
      const updated = { ...state.zones };
      for (const [id, vals] of Object.entries(data)) {
        updated[id] = { ...updated[id], ...vals } as Zone;
      }
      return { zones: updated };
    }),
}));

interface BiometricsStore {
  samples: Record<string, BioSample>;
  updateBio: (crewId: string, sample: BioSample) => void;
  privacyBlocked: Record<string, boolean>;
  setPrivacyBlocked: (crewId: string, blocked: boolean) => void;
}

export const useBiometricsStore = create<BiometricsStore>((set) => ({
  samples: {},
  updateBio: (crewId, sample) =>
    set((state) => ({ samples: { ...state.samples, [crewId]: sample } })),
  privacyBlocked: {},
  setPrivacyBlocked: (crewId, blocked) =>
    set((state) => ({ privacyBlocked: { ...state.privacyBlocked, [crewId]: blocked } })),
}));

interface UIStore {
  selectedZone: string | null;
  setSelectedZone: (id: string | null) => void;
  activeScenario: string | null;
  setActiveScenario: (name: string | null) => void;
  sidebarTab: string;
  setSidebarTab: (tab: string) => void;
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  dismissAlert: (id: string) => void;
}

interface Alert {
  id: string;
  type: "warning" | "critical" | "info";
  message: string;
  ts: number;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedZone: null,
  setSelectedZone: (id) => set({ selectedZone: id }),
  activeScenario: null,
  setActiveScenario: (name) => set({ activeScenario: name }),
  sidebarTab: "overview",
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  alerts: [],
  addAlert: (alert) =>
    set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 10) })),
  dismissAlert: (id) =>
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),
}));

interface CrewStore {
  crew: Record<string, Crew>;
  setCrew: (crew: Crew[]) => void;
  updateCrewMember: (id: string, data: Partial<Crew>) => void;
  circadian: Record<string, CircadianState>;
  setCircadian: (crewId: string, state: CircadianState) => void;
  affect: Record<string, AffectEstimate>;
  setAffect: (crewId: string, state: AffectEstimate) => void;
}

export const useCrewStore = create<CrewStore>((set) => ({
  crew: {},
  setCrew: (crew) =>
    set({ crew: Object.fromEntries(crew.map((c) => [c.crew_id, c])) }),
  updateCrewMember: (id, data) =>
    set((state) => ({ crew: { ...state.crew, [id]: { ...state.crew[id], ...data } } })),
  circadian: {},
  setCircadian: (crewId, cs) =>
    set((state) => ({ circadian: { ...state.circadian, [crewId]: cs } })),
  affect: {},
  setAffect: (crewId, ae) =>
    set((state) => ({ affect: { ...state.affect, [crewId]: ae } })),
}));
