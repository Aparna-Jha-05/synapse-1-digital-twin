"use client";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("synapse_token");
}

async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

// Auth
export async function login(username: string, password: string) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  return res.json();
}

export async function getMe() {
  return fetchWithAuth("/me");
}

// Habitat
export async function getZones() {
  return fetchWithAuth("/habitat/zones");
}

export async function getZone(id: string) {
  return fetchWithAuth(`/habitat/zones/${id}`);
}

export async function getShieldIntegrity() {
  return fetchWithAuth("/habitat/shield-integrity");
}

export async function getZoneSMI(zoneId: string) {
  return fetchWithAuth(`/habitat/smi/${zoneId}`);
}

export async function getAllSMIs() {
  return fetchWithAuth("/habitat/smis");
}

export async function setChromotherapy(zoneId: string, preset: string) {
  return fetchWithAuth(`/habitat/zones/${zoneId}/chromotherapy`, {
    method: "POST",
    body: JSON.stringify({ preset }),
  });
}

export async function getRegolithQueue() {
  return fetchWithAuth("/habitat/regolith-queue");
}

// Crew
export async function getAllCrew() {
  return fetchWithAuth("/crew");
}

export async function getCrewCircadian(crewId: string) {
  return fetchWithAuth(`/crew/${crewId}/circadian`);
}

export async function getCrewAffect(crewId: string) {
  return fetchWithAuth(`/crew/${crewId}/affect`);
}

export async function getCrewBioLive(crewId: string) {
  return fetchWithAuth(`/crew/${crewId}/bio-live`);
}

export async function getCircadianForecast(crewId: string) {
  return fetchWithAuth(`/crew/${crewId}/circadian-forecast`);
}

export async function updateConsent(crewId: string, flags: { share_bio?: boolean; share_affect?: boolean }) {
  return fetchWithAuth(`/crew/${crewId}/consent`, {
    method: "POST",
    body: JSON.stringify(flags),
  });
}

export async function triggerPrivacyPause(crewId: string) {
  return fetchWithAuth(`/crew/${crewId}/privacy-pause`, { method: "POST" });
}

export async function getCohesionHeatmap() {
  return fetchWithAuth("/crew/cohesion-heatmap");
}

export async function getFriction() {
  return fetchWithAuth("/crew/friction");
}

// Digital Twin
export async function simulateTwin(body: {
  horizon_hours: number;
  scenario?: string | null;
  scenario_at_hour?: number;
  crew_ids?: string[];
}) {
  return fetchWithAuth("/twin/simulate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ML
export async function getModelCard() {
  return fetchWithAuth("/ml/model-card");
}

// Scenarios
export async function injectScenario(name: string, seed: number) {
  return fetchWithAuth("/scenario/inject", {
    method: "POST",
    body: JSON.stringify({ name, seed }),
  });
}

export async function getScenarioList() {
  return fetchWithAuth("/scenario/list");
}

// Ethics
export async function getEthicsLog() {
  return fetchWithAuth("/ethics/log");
}

export async function exportEthicsLog(crewId?: string) {
  const params = crewId ? `?crew_id=${crewId}` : "";
  return fetchWithAuth(`/ethics/log/export${params}`);
}

// Comms
export async function getCommsStatus() {
  return fetchWithAuth("/comms/status");
}

// Hippocampal test
export async function submitHippocampalTest(crewId: string, data: { score: number; reaction_time_ms: number; accuracy_pct: number }) {
  return fetchWithAuth(`/crew/${crewId}/hippocampal-test`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getHippocampalHistory(crewId: string) {
  return fetchWithAuth(`/crew/${crewId}/hippocampal-history`);
}

