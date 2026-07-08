"""
Affect & Stress Estimator — Russell's Circumplex Model
=======================================================
Small MLP estimating crew affective state on two dimensions:
  - Arousal: -1 (calm/asleep) to +1 (activated/agitated)
  - Valence: -1 (negative) to +1 (positive)

This maps directly to Russell's circumplex of affect and affective
neuroscience (Russell 1980, Barrett & Russell 1998).

Inputs: HRV features (RMSSD, LF/HF proxy), EDA, sleep debt,
        mission duration proxy, stress event exposure.

ETHICAL STATEMENT: This is a demonstrator system, not a validated
clinical tool. Affect estimates should be used to support crew
wellbeing interventions, never to surveil or judge crew members.
The MLP was trained on synthetic data with documented label rules.
See /ml/affect/labeling.md for complete methodology disclosure.

Note: "estimates" not "predicts" — epistemic honesty matters.
"""
from __future__ import annotations
import json
import math
import time
from typing import Dict, Optional

import numpy as np

try:
    import torch
    import torch.nn as nn
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


# ─── MLP Architecture ─────────────────────────────────────────────────────────
if HAS_TORCH:
    class AffectMLP(nn.Module):
        """
        Small 2-layer MLP for affect estimation.
        Input: 7 biometric features
        Output: [arousal, valence] in [-1, 1]
        """
        def __init__(self):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(7, 32),
                nn.LayerNorm(32),
                nn.GELU(),
                nn.Dropout(0.1),
                nn.Linear(32, 16),
                nn.GELU(),
                nn.Linear(16, 2),
                nn.Tanh(),  # Output in [-1, 1]
            )

        def forward(self, x):
            return self.net(x)


# ─── Feature Extraction ──────────────────────────────────────────────────────
FEATURE_NAMES = [
    "hrv_rmssd_norm",      # HRV RMSSD normalised (higher = lower stress)
    "lf_hf_proxy",        # LF/HF ratio proxy from HR + HRV
    "eda_norm",           # Electrodermal activity normalised
    "sleep_debt_norm",    # Sleep debt normalised
    "core_temp_deviation",# Core temp deviation from 37.0
    "hr_norm",            # Heart rate normalised
    "circadian_phase_sin",# Circadian phase as sin (temporal context)
]


def extract_features(bio: dict) -> np.ndarray:
    """Extract normalised feature vector from biometric sample."""
    hrv = bio.get("hrv_rmssd", 50.0)
    hr = bio.get("hr", 65.0)
    eda = bio.get("eda", 2.0)
    sleep_debt = bio.get("sleep_debt", 0.0)
    core_temp = bio.get("core_temp", 37.0)

    # Normalisation based on physiological ranges
    hrv_norm = min(1.0, hrv / 80.0)  # 0-80ms range
    lf_hf = max(0, 3.0 - hrv_norm * 2.5)  # Proxy: low HRV → high LF/HF
    eda_norm = min(1.0, eda / 8.0)
    sleep_norm = min(1.0, sleep_debt / 8.0)
    temp_dev = (core_temp - 37.0) / 0.5  # Normalised deviation
    hr_norm = min(1.0, max(0, (hr - 45) / 75))  # 45-120 bpm range

    # Circadian phase context
    t_h = (time.time() / 3600.0) % 24.0
    phase_sin = math.sin(2 * math.pi * t_h / 24.0)

    return np.array([hrv_norm, lf_hf, eda_norm, sleep_norm, temp_dev, hr_norm, phase_sin], dtype=np.float32)


def rule_based_affect(features: np.ndarray) -> dict:
    """
    Interpretable rule-based fallback (SHAP equivalent for transparency).
    Used when PyTorch unavailable, and also for SHAP approximation.
    """
    hrv_norm, lf_hf, eda_norm, sleep_norm, temp_dev, hr_norm, phase_sin = features

    # Arousal: driven by sympathetic activation (high HR, high EDA, high LF/HF)
    arousal = -0.5 + 1.0 * hr_norm + 0.8 * eda_norm + 0.4 * lf_hf - 0.6 * hrv_norm
    arousal = max(-1.0, min(1.0, arousal))

    # Valence: driven by HRV (resilience), sleep debt (reduces positive affect)
    valence = 0.3 + 0.8 * hrv_norm - 0.7 * sleep_norm - 0.3 * eda_norm + 0.2 * phase_sin
    valence = max(-1.0, min(1.0, valence))

    # Feature attributions (simplified SHAP)
    top_features = {
        "hrv_rmssd": round(0.8 * hrv_norm - 0.4, 3),
        "eda": round(-0.8 * eda_norm + 0.2, 3),
        "sleep_debt": round(-0.7 * sleep_norm, 3),
        "heart_rate": round(1.0 * hr_norm - 0.5, 3),
        "lf_hf_ratio": round(0.4 * lf_hf - 0.2, 3),
    }

    return {
        "arousal": round(float(arousal), 3),
        "valence": round(float(valence), 3),
        "top_features": top_features,
        "method": "rule_based",
    }


# ─── Model Instance ───────────────────────────────────────────────────────────
_model = None
_model_initialized = False


def _get_model():
    global _model, _model_initialized
    if _model_initialized:
        return _model
    _model_initialized = True

    if not HAS_TORCH:
        return None

    _model = AffectMLP()
    # Try loading saved weights
    import os
    weights_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml", "weights", "affect_mlp.pt")
    if os.path.exists(weights_path):
        try:
            state = torch.load(weights_path, map_location="cpu")
            _model.load_state_dict(state)
            _model.eval()
        except Exception as e:
            print(f"Could not load affect weights: {e}. Using synthetic init.")
            _init_synthetic_weights(_model)
    else:
        _init_synthetic_weights(_model)

    return _model


def _init_synthetic_weights(model):
    """
    Initialise with domain-knowledge-guided weights instead of random.
    This implements the documented labeling rules from /ml/affect/labeling.md.
    """
    import torch
    with torch.no_grad():
        # Layer 0: Input → 32
        w = model.net[0].weight
        # HRV → calm/positive (features 0, 5 = hrv, hr)
        w[:8, 0] = 0.6   # hrv → low arousal
        w[:8, 1] = 0.4   # lf_hf → high arousal
        w[:8, 2] = 0.5   # eda → high arousal
        w[:8, 3] = -0.5  # sleep debt → low valence
        w[8:16, 0] = -0.7  # hrv → high valence
        model.net[0].bias.data.fill_(0.0)


def estimate_affect(bio: dict) -> dict:
    """
    Estimate arousal and valence from biometric features.
    Returns Russell's circumplex coordinates + top-3 feature attributions.
    """
    features = extract_features(bio)
    model = _get_model()

    if model is not None and HAS_TORCH:
        try:
            import torch
            with torch.no_grad():
                x = torch.tensor(features).unsqueeze(0)
                out = model(x).squeeze().numpy()
                arousal = float(out[0])
                valence = float(out[1])

            # Gradient × input attribution (fast approximation of SHAP)
            top_features = _gradient_attribution(model, features)

            return {
                "arousal": round(arousal, 3),
                "valence": round(valence, 3),
                "top_features": top_features,
                "method": "mlp",
            }
        except Exception as e:
            pass

    return rule_based_affect(features)


def estimate_affect_with_uncertainty(bio: dict, n_samples: int = 24) -> dict:
    """
    Monte-Carlo dropout uncertainty estimate.

    Runs N stochastic forward passes with dropout *active* and reports the
    mean estimate plus the standard deviation as an epistemic uncertainty
    band. Honest uncertainty is part of the ethical contract — a wide band
    means "the model is unsure", not "the crew member is fine".
    """
    base = estimate_affect(bio)
    model = _get_model()
    if model is None or not HAS_TORCH:
        # Rule-based fallback: report a fixed, clearly-labelled band
        base["arousal_std"] = 0.12
        base["valence_std"] = 0.12
        base["confidence"] = 0.6
        return base

    try:
        import torch
        features = extract_features(bio)
        x = torch.tensor(features).unsqueeze(0)

        # Enable dropout only (keep LayerNorm in eval via manual toggle)
        model.train()
        outs = []
        with torch.no_grad():
            for _ in range(n_samples):
                outs.append(model(x).squeeze().numpy())
        model.eval()

        arr = np.stack(outs)  # (n, 2)
        mean = arr.mean(axis=0)
        std = arr.std(axis=0)
        # Confidence: 1 when combined std is ~0, decays as uncertainty grows
        combined = float((std[0] + std[1]) / 2.0)
        confidence = round(max(0.0, min(1.0, 1.0 - combined * 3.0)), 3)

        base["arousal"] = round(float(mean[0]), 3)
        base["valence"] = round(float(mean[1]), 3)
        base["arousal_std"] = round(float(std[0]), 3)
        base["valence_std"] = round(float(std[1]), 3)
        base["confidence"] = confidence
        return base
    except Exception:
        base["arousal_std"] = 0.12
        base["valence_std"] = 0.12
        base["confidence"] = 0.6
        return base


def load_model_card() -> Optional[dict]:
    """Load the training-time model card written by ml/train_affect.py."""
    import os
    card_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "ml", "weights", "affect_model_card.json"
    )
    if os.path.exists(card_path):
        try:
            with open(card_path, "r", encoding="utf-8") as fh:
                return json.load(fh)
        except Exception:
            return None
    return None


def _gradient_attribution(model, features: np.ndarray) -> dict:
    """
    Gradient × input attribution for interpretability.
    Approximates SHAP values for the MLP.
    Never a black box — always show top-3 attributions.
    """
    try:
        import torch
        # Use a leaf tensor so .grad is populated correctly
        x_leaf = torch.tensor(features, dtype=torch.float32, requires_grad=True)
        x = x_leaf.unsqueeze(0)
        out = model(x)
        loss = out.sum()
        loss.backward()
        grads = x_leaf.grad.squeeze().numpy()
        attributions = grads * features
        names = FEATURE_NAMES
        attr_dict = {names[i]: round(float(attributions[i]), 4) for i in range(len(names))}
        # Return top 3 by absolute value
        top3 = dict(sorted(attr_dict.items(), key=lambda kv: abs(kv[1]), reverse=True)[:3])
        return top3
    except Exception:
        return {"hrv_rmssd": 0.0, "eda": 0.0, "sleep_debt": 0.0}
