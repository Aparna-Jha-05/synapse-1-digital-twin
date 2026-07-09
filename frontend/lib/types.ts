// SYNAPSE-1 Digital Twin — TypeScript types

export type UserRole = "GROUND" | "CREW";

export interface AuthState {
  token: string | null;
  role: UserRole | null;
  crewId: string | null;
}

export interface Crew {
  crew_id: string;
  display_name: string;
  role: string;
  avatar_seed: number;
  consent_share_bio: boolean;
  consent_share_affect: boolean;
  consent_paused_until: string | null;
  privacy_paused?: boolean;
  bio?: BioSample | null;
  circadian?: CircadianState | null;
  affect?: AffectEstimate | null;
}

export interface Zone {
  zone_id: string;
  level: "SOMA" | "AXON" | "DENDRITE" | "SPECIAL";
  name: string;
  description: string;
  occupancy_cap: number;
  occupants: string; // JSON string
  // Live env
  lux: number;
  cct: number;
  db_spl: number;
  co2_ppm: number;
  temp_c: number;
  humidity: number;
  airflow_seed: number;
  chromotherapy_preset: string;
  solfeggio_freq: number;
  current_lux?: number;
  current_cct?: number;
  ts?: string;
}

export interface BioSample {
  crew_id: string;
  ts: string;
  hrv_rmssd: number;
  hr: number;
  eda: number;
  core_temp: number;
  sleep_debt: number;
}

export interface EnvSample {
  zone_id: string;
  ts: string;
  lux: number;
  cct: number;
  db_spl: number;
  co2_ppm: number;
  temp_c: number;
  humidity: number;
  airflow_seed: number;
}

export interface CircadianState {
  crew_id: string;
  ts: string;
  phase_hours: number;
  debt_hours: number;
  alertness: number;
  predicted_melatonin_onset: number;
}

export interface AffectEstimate {
  crew_id: string;
  ts: string;
  arousal: number;
  valence: number;
  top_features: Record<string, number> | string;
  blocked?: boolean;
  reason?: string;
}

export interface EthicsLogEntry {
  id: number;
  ts: string;
  actor_role: string;
  actor_id: string;
  event_type: string;
  payload: string;
  prev_hash: string;
  hash: string;
}

export interface ShieldIntegrity {
  water_mass_kg: number;
  consumed_kg: number;
  effective_mass_kg: number;
  shield_effectiveness_pct: number;
  shield_status: "NOMINAL" | "DEGRADED" | "CRITICAL";
}

export interface SMIResult {
  smi: number;
  alarm: boolean;
}

export interface ScenarioEvent {
  name: string;
  seed: number;
}

export interface CommsStatus {
  one_way_latency_s: number;
  round_trip_s: number;
  next_window_s: number;
  status: "NOMINAL" | "EXTENDED";
  mission_day: number;
}

export interface CircadianForecastPoint {
  hour_offset: number;
  t_hours: number;
  alertness: number;
}

export interface RegolithBrick {
  batch_id: string;
  bacteria_strain: string;
  cure_pct: number;
  status: string;
  shield_contribution_kg: number;
}

export interface FrictionPair {
  c1: string;
  c2: string;
  c1_id: string;
  c2_id: string;
  score: number;
  drivers: Record<string, number>;
  reasons: string[];
}

export interface FrictionResult {
  pairs: FrictionPair[];
  model: string;
  attributions: boolean;
}

export interface CohesionCell {
  cohesion: number;
  n_crew: number;
  mean_valence: number;
  spread: number;
}

export interface TwinPoint {
  hour_offset: number;
  t_hours: number;
  alertness: number;
  phase_hours: number;
  debt_hours: number;
  hrv: number;
  hr: number;
  arousal: number;
  valence: number;
  stress_mult: number;
}

export interface TwinCrew {
  crew_id: string;
  trajectory: TwinPoint[];
}

export interface TwinHabitatPoint {
  hour_offset: number;
  mean_alertness: number;
  mean_debt: number;
  mean_valence: number;
  friction_index: number;
}

export interface TwinResult {
  horizon_hours: number;
  step_hours: number;
  scenario: string | null;
  scenario_at_hour: number | null;
  t0_mission_h: number;
  crew: TwinCrew[];
  habitat: TwinHabitatPoint[];
}

export interface ModelCard {
  available: boolean;
  reason?: string;
  hint?: string;
  live_inference_method?: "mlp" | "rule_based";
  model_name?: string;
  architecture?: string;
  framework?: string;
  trained_at?: string;
  seed?: number;
  n_samples?: number;
  train_val_split?: string;
  epochs?: number;
  optimizer?: string;
  loss?: string;
  feature_names?: string[];
  outputs?: string[];
  metrics?: {
    best_val_loss: number;
    val_mae_arousal: number;
    val_mae_valence: number;
    val_r2_arousal: number;
    val_r2_valence: number;
  };
  label_rules?: string[];
  limitations?: string[];
  history?: { epoch: number; train_loss: number; val_loss: number }[];
}

export const LEVEL_COLORS: Record<string, string> = {
  SOMA: "#a78bfa",
  AXON: "#34d399",
  DENDRITE: "#60a5fa",
  SPECIAL: "#06b6d4",
};

export const CHROMOTHERAPY_PRESETS = [
  "Grecian White",
  "Neutral White",
  "Vedic Ochre",
  "Dawn Coral",
  "Arctic Blue",
  "Midnight Indigo",
] as const;
