"""
Physically grounded data simulator for SYNAPSE-1 lunar habitat.
Uses cosine-based circadian models, Perlin noise airflow, and
reproducible stress scenario injection.
"""
from __future__ import annotations
import math
import time
import random
from datetime import datetime
from typing import Dict, List, Optional
import numpy as np

try:
    import noise
    HAS_NOISE = True
except ImportError:
    HAS_NOISE = False


# ─── Synthetic Lunar Day ────────────────────────────────────────────────────
# The habitat INVENTS time — there is no natural day on the Moon.
# A synthetic 24-hour cycle is imposed by the Neuro-Core OS.
LUNAR_DAY_SECONDS = 86400  # Synthetic 24h imposed by habitat

# Mission start reference (Unix timestamp)
MISSION_START_TS = 1700000000.0  # Fixed reference


def mission_time_hours() -> float:
    """Synthetic mission time in hours (loops every 24h)."""
    elapsed = time.time() - MISSION_START_TS
    return (elapsed / 3600.0) % 24.0


def mission_clock_h() -> float:
    return mission_time_hours()


# ─── Circadian Core Temp Model ──────────────────────────────────────────────
def circadian_temp_phase(t_hours: float, phase_offset: float = 0.0) -> float:
    """
    Core body temperature as cosine over 24h synthetic day.
    Minimum at ~4:00 (trough), maximum at ~16:00 (peak).
    Returns temp_c between 36.4 and 37.2.
    """
    phase_rad = 2 * math.pi * (t_hours - 4.0 + phase_offset) / 24.0
    return 36.8 + 0.4 * math.cos(phase_rad)


def alertness_curve(t_hours: float, phase_offset: float = 0.0) -> float:
    """Alertness 0-1, peaks at ~10:00 and ~21:00 (two-process model approximation)."""
    phase_rad = 2 * math.pi * (t_hours - 10.0 + phase_offset) / 24.0
    return 0.5 + 0.4 * math.cos(phase_rad)


# ─── HRV Model ──────────────────────────────────────────────────────────────
# Baseline RMSSD by circadian phase: higher during sleep, lower during stress
def baseline_hrv(t_hours: float) -> float:
    """Baseline HRV RMSSD (ms). Higher at night, lower in early afternoon."""
    # Circadian component
    phase_rad = 2 * math.pi * (t_hours - 6.0) / 24.0
    return 55.0 + 20.0 * math.cos(phase_rad)


def baseline_hr(t_hours: float) -> float:
    """Baseline heart rate bpm. Inverse of HRV rhythm."""
    phase_rad = 2 * math.pi * (t_hours - 14.0) / 24.0
    return 65.0 + 12.0 * math.cos(phase_rad)


# ─── Perlin Noise Airflow ───────────────────────────────────────────────────
def perlin_airflow(zone_seed: float, t: float) -> float:
    """
    Somatosensory airflow variability via Perlin noise.
    Prevents habituation — not trigeminal stimulation (that requires chemosensory input).
    Returns airflow_seed value 0-1.
    """
    if HAS_NOISE:
        return (noise.pnoise1(zone_seed + t * 0.01, octaves=3) + 1.0) / 2.0
    else:
        # Fallback: sum of sine waves for smooth variability
        return 0.5 + 0.3 * math.sin(t * 0.07 + zone_seed) + 0.2 * math.sin(t * 0.13 + zone_seed * 2)


# ─── Scenario State ─────────────────────────────────────────────────────────
class ScenarioState:
    def __init__(self):
        self.active: List[dict] = []

    def inject(self, name: str, seed: int, ts: float):
        self.active.append({"name": name, "seed": seed, "ts": ts})
        # Keep only recent scenarios (< 300s old)
        self.active = [s for s in self.active if ts - s["ts"] < 300]

    def stress_multiplier(self, ts: float) -> float:
        """Returns stress multiplier from active scenarios (exponential decay)."""
        mult = 1.0
        for s in self.active:
            age = ts - s["ts"]
            if age < 0:
                continue
            # Stress peaks at 0s, decays with τ=60s
            impact = math.exp(-age / 60.0)
            if s["name"] == "SolarProtonEvent":
                mult += 1.8 * impact
            elif s["name"] == "CommsBlackout":
                mult += 1.2 * impact
            elif s["name"] == "InterpersonalConflict":
                mult += 0.9 * impact
            elif s["name"] == "EquipmentFailure":
                mult += 1.5 * impact
        return min(mult, 3.5)

    def clear_old(self, ts: float):
        self.active = [s for s in self.active if ts - s["ts"] < 300]


# Global scenario state
scenario_state = ScenarioState()

# Per-crew state for reproducibility
_crew_states: Dict[str, dict] = {}


def _get_crew_state(crew_id: str) -> dict:
    if crew_id not in _crew_states:
        idx = int(crew_id.replace("crew", "")) if crew_id.startswith("crew") else 1
        _crew_states[crew_id] = {
            "phase_offset_h": (idx - 1) * 0.5,  # slight individual variation
            "sleep_debt_h": random.uniform(0, 1.5),
            "base_hrv_noise_seed": idx * 3.7,
        }
    return _crew_states[crew_id]


# Per-zone state
_zone_chromotherapy: Dict[str, dict] = {}

CHROMOTHERAPY_PRESETS = {
    "Grecian White": {"cct": 6500, "lux": 800},
    "Neutral White": {"cct": 4000, "lux": 500},
    "Vedic Ochre": {"cct": 2000, "lux": 200},
    "Dawn Coral": {"cct": 3200, "lux": 400},
    "Arctic Blue": {"cct": 7500, "lux": 600},
    "Midnight Indigo": {"cct": 2700, "lux": 50},
}


def set_zone_chromotherapy(zone_id: str, preset: str):
    _zone_chromotherapy[zone_id] = CHROMOTHERAPY_PRESETS.get(preset, CHROMOTHERAPY_PRESETS["Neutral White"])


def generate_env_sample(zone_id: str, t: float) -> dict:
    """Generate a physically plausible environmental sample for a zone."""
    t_hours = (t / 3600.0) % 24.0
    zone_seed = hash(zone_id) % 1000 / 100.0

    # Chromotherapy override
    chroma = _zone_chromotherapy.get(zone_id, None)
    if chroma:
        lux = chroma["lux"] + 20 * math.sin(t * 0.05)
        cct = chroma["cct"] + 50 * math.sin(t * 0.03)
    else:
        # Natural circadian lighting program
        lux = max(50, 600 * alertness_curve(t_hours) + 30 * math.sin(t * 0.1 + zone_seed))
        # CCT: cool in morning/day (6500K), warm in evening (2700K)
        cct = 2700 + 3800 * max(0, math.cos(2 * math.pi * (t_hours - 14) / 24))

    # CO2 rises with occupancy simulation
    base_co2 = 700 + 150 * math.sin(2 * math.pi * t_hours / 24)
    co2_ppm = base_co2 + 80 * math.sin(t * 0.007 + zone_seed)

    # Temperature: slight diurnal variation
    temp_c = 21.5 + 0.8 * math.sin(2 * math.pi * (t_hours - 6) / 24)

    # Humidity: stable with minor fluctuation
    humidity = 48 + 5 * math.sin(t * 0.004 + zone_seed)

    # dB: quiet at night, livelier during day
    db_spl = 38 + 12 * alertness_curve(t_hours) + 3 * math.sin(t * 0.09 + zone_seed)

    # Airflow: Perlin noise variability
    airflow_seed = perlin_airflow(zone_seed, t)

    return {
        "zone_id": zone_id,
        "ts": datetime.utcnow().isoformat(),
        "lux": round(lux, 1),
        "cct": round(cct, 0),
        "db_spl": round(db_spl, 1),
        "co2_ppm": round(co2_ppm, 0),
        "temp_c": round(temp_c, 2),
        "humidity": round(humidity, 1),
        "airflow_seed": round(airflow_seed, 3),
    }


def generate_bio_sample(crew_id: str, t: float) -> dict:
    """Generate physically plausible biometric sample for a crew member."""
    t_hours = (t / 3600.0) % 24.0
    state = _get_crew_state(crew_id)
    phase_offset = state["phase_offset_h"]
    seed = state["base_hrv_noise_seed"]

    stress_mult = scenario_state.stress_multiplier(t)

    # HRV: inversely affected by stress
    base_hrv = baseline_hrv(t_hours + phase_offset)
    hrv_noise = 5 * math.sin(t * 0.11 + seed) + 3 * math.cos(t * 0.17 + seed)
    hrv_rmssd = max(15, base_hrv / stress_mult + hrv_noise)

    # HR: rises with stress
    hr = baseline_hr(t_hours + phase_offset) * (0.8 + 0.2 * stress_mult) + 3 * math.sin(t * 0.08 + seed)
    hr = max(45, min(120, hr))

    # EDA: rises sharply with stress, decays slowly
    eda = 2.0 + 3.0 * math.log(stress_mult) + 0.5 * math.sin(t * 0.06 + seed)
    eda = max(0.5, eda)

    # Core temp: circadian cosine
    core_temp = circadian_temp_phase(t_hours + phase_offset)

    # Sleep debt accumulates over time, resets at "sleep" phase
    sleep_hour = (t_hours + phase_offset) % 24
    if 23 <= sleep_hour or sleep_hour <= 7:
        state["sleep_debt_h"] = max(0, state["sleep_debt_h"] - 0.1)
    else:
        state["sleep_debt_h"] = min(8, state["sleep_debt_h"] + 0.015)
    sleep_debt = state["sleep_debt_h"]

    return {
        "crew_id": crew_id,
        "ts": datetime.utcnow().isoformat(),
        "hrv_rmssd": round(hrv_rmssd, 2),
        "hr": round(hr, 1),
        "eda": round(eda, 3),
        "core_temp": round(core_temp, 3),
        "sleep_debt": round(sleep_debt, 2),
    }


def compute_sensory_monotony_index(samples: list) -> float:
    """
    Sensory Monotony Index (SMI): rolling scalar combining variance of
    lux, CCT, dB, and airflow over the last N samples.
    SMI < 0.3 triggers alarm.
    """
    if len(samples) < 3:
        return 1.0  # Insufficient data — assume OK

    def norm_variance(values: list, scale: float) -> float:
        if len(values) < 2:
            return 0
        v = np.var(values)
        return min(1.0, v / (scale ** 2))

    lux_vals = [s.get("lux", 400) for s in samples]
    cct_vals = [s.get("cct", 4000) for s in samples]
    db_vals = [s.get("db_spl", 45) for s in samples]
    airflow_vals = [s.get("airflow_seed", 0.5) for s in samples]

    smi = (
        0.3 * norm_variance(lux_vals, 150) +
        0.3 * norm_variance(cct_vals, 1500) +
        0.2 * norm_variance(db_vals, 8) +
        0.2 * norm_variance(airflow_vals, 0.2)
    )
    return round(min(1.0, smi), 3)


# ─── Digital Twin: forward simulation / what-if ───────────────────────────────
# Scenario stress profiles for the *forecast* horizon. Unlike the live 60s
# decay used for the real-time stream, forecasting projects over mission-hours,
# so we model an acute spike followed by a ~3h recovery.
FORECAST_SCENARIOS = {
    "SolarProtonEvent":     {"peak": 1.9, "tau_h": 3.5},
    "CommsBlackout":        {"peak": 1.3, "tau_h": 4.0},
    "InterpersonalConflict":{"peak": 1.0, "tau_h": 2.5},
    "EquipmentFailure":     {"peak": 1.6, "tau_h": 2.0},
}


def _forecast_stress_mult(scenario: Optional[str], hours_since_inject: float) -> float:
    """Stress multiplier for the forecast horizon (hour-scale recovery)."""
    if not scenario or hours_since_inject < 0:
        return 1.0
    profile = FORECAST_SCENARIOS.get(scenario)
    if not profile:
        return 1.0
    return 1.0 + profile["peak"] * math.exp(-hours_since_inject / profile["tau_h"])


def simulate_forward(
    crew_ids: List[str],
    horizon_hours: int = 16,
    scenario: Optional[str] = None,
    scenario_at_hour: int = 0,
) -> dict:
    """
    Project circadian + affect trajectories forward WITHOUT mutating live state.

    Clones each crew's circadian oscillator, integrates it hour-by-hour under
    their pod lighting, synthesises the biometric sample that would result, and
    runs the trained affect estimator on it. Optionally injects a hypothetical
    scenario at a chosen future hour so Ground can rehearse "what if".
    """
    from ml.circadian.oscillator import _get_oscillator, CircadianOscillator
    from ml.affect.regressor import estimate_affect

    t0_h = mission_clock_h()
    crew_out = []
    # habitat aggregates per hour
    agg_alert = [0.0] * (horizon_hours + 1)
    agg_debt = [0.0] * (horizon_hours + 1)
    agg_valence = [0.0] * (horizon_hours + 1)

    for crew_id in crew_ids:
        state = _get_crew_state(crew_id)
        phase_offset = state["phase_offset_h"]
        sleep_debt = state["sleep_debt_h"]

        # Clone oscillator state so we never touch the live pacemaker
        live = _get_oscillator(crew_id)
        sim_osc = CircadianOscillator(crew_id, phase_offset_h=live.phase_offset_h)
        sim_osc.x, sim_osc.xc = live.x, live.xc

        # Pod lighting (chromotherapy override if set)
        pod_id = f"zone_dendrite_pod_{crew_id[-2:]}"
        chroma = _zone_chromotherapy.get(pod_id)

        trajectory = []
        for h in range(horizon_hours + 1):
            t_h = (t0_h + h) % 24.0
            if chroma:
                lux, cct = chroma["lux"], chroma["cct"]
            else:
                lux = max(50, 600 * alertness_curve(t_h))
                cct = 2700 + 3800 * max(0, math.cos(2 * math.pi * (t_h - 14) / 24))

            circ = sim_osc.step(1.0, lux=lux, cct_kelvin=cct) if h > 0 else sim_osc._state()

            stress = _forecast_stress_mult(scenario, h - scenario_at_hour)

            # Synthesise the biometrics this state would produce
            base_hrv = baseline_hrv(t_h + phase_offset)
            hrv = max(15, base_hrv / stress)
            hr = max(45, min(120, baseline_hr(t_h + phase_offset) * (0.8 + 0.2 * stress)))
            eda = max(0.5, 2.0 + 3.0 * math.log(stress) if stress > 1 else 2.0)
            core_temp = circadian_temp_phase(t_h + phase_offset)
            # Sleep debt drifts: recovers in the sleep window, accrues otherwise
            sh = (t_h + phase_offset) % 24
            sleep_debt = max(0, sleep_debt - 0.1) if (sh >= 23 or sh <= 7) else min(8, sleep_debt + 0.015)

            bio = {"hrv_rmssd": hrv, "hr": hr, "eda": eda,
                   "core_temp": core_temp, "sleep_debt": sleep_debt}
            aff = estimate_affect(bio)

            point = {
                "hour_offset": h,
                "t_hours": round(t_h, 2),
                "alertness": circ["alertness"],
                "phase_hours": circ["phase_hours"],
                "debt_hours": circ["debt_hours"],
                "hrv": round(hrv, 1),
                "hr": round(hr, 1),
                "arousal": aff["arousal"],
                "valence": aff["valence"],
                "stress_mult": round(stress, 2),
            }
            trajectory.append(point)
            agg_alert[h] += circ["alertness"]
            agg_debt[h] += circ["debt_hours"]
            agg_valence[h] += aff["valence"]

        crew_out.append({"crew_id": crew_id, "trajectory": trajectory})

    n = max(1, len(crew_ids))
    habitat = [{
        "hour_offset": h,
        "mean_alertness": round(agg_alert[h] / n, 3),
        "mean_debt": round(agg_debt[h] / n, 3),
        "mean_valence": round(agg_valence[h] / n, 3),
        # Friction index rises with mean debt and negative valence
        "friction_index": round(max(0.0, agg_debt[h] / n * 0.4 - agg_valence[h] / n * 0.5 + 0.2), 3),
    } for h in range(horizon_hours + 1)]

    return {
        "horizon_hours": horizon_hours,
        "step_hours": 1,
        "scenario": scenario,
        "scenario_at_hour": scenario_at_hour if scenario else None,
        "t0_mission_h": round(t0_h, 2),
        "crew": crew_out,
        "habitat": habitat,
    }


def get_shield_integrity(water_mass_kg: float = 8000.0, consumed_kg: float = 0.0) -> dict:
    """
    Water doubles as storm shelter radiation shield in Dendrite level.
    Trade-off: water consumed for drinking/aeroponics reduces shielding.
    """
    effective_mass = water_mass_kg - consumed_kg
    # Approximate: 10cm water = ~90% shielding effectiveness
    # Full tank = 8000kg ≈ excellent shielding
    effectiveness = min(100, max(0, (effective_mass / water_mass_kg) * 100))
    return {
        "water_mass_kg": round(water_mass_kg, 0),
        "consumed_kg": round(consumed_kg, 0),
        "effective_mass_kg": round(effective_mass, 0),
        "shield_effectiveness_pct": round(effectiveness, 1),
        "shield_status": "NOMINAL" if effectiveness > 70 else "DEGRADED" if effectiveness > 40 else "CRITICAL",
    }
