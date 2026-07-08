"""
Train the SYNAPSE-1 Affect Estimator (Russell Circumplex MLP)
=============================================================
Generates synthetic crew-biometric training data according to the
documented labeling rules in ``ml/affect/labeling.md`` and fits the
same ``AffectMLP`` architecture used at inference time
(``backend/ml/affect/regressor.py``).

Outputs
-------
  ml/weights/affect_mlp.pt            trained state_dict (loaded by the backend)
  ml/weights/affect_model_card.json   honest metrics + provenance for the UI

Run
---
  py -3 ml/train_affect.py            (from the spar/ project root)

ETHICAL NOTE: This is a demonstrator trained on *synthetic* data whose
labels are derived from physiological proxies, not validated psychometry.
Every design choice here is disclosed on purpose — a model's label rules
are its implicit values.
"""
from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone

import numpy as np

import torch
import torch.nn as nn

# ─── Reproducibility ──────────────────────────────────────────────────────────
SEED = 42
rng = np.random.default_rng(SEED)
torch.manual_seed(SEED)

HERE = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_DIR = os.path.join(HERE, "weights")
os.makedirs(WEIGHTS_DIR, exist_ok=True)

FEATURE_NAMES = [
    "hrv_rmssd_norm",
    "lf_hf_proxy",
    "eda_norm",
    "sleep_debt_norm",
    "core_temp_deviation",
    "hr_norm",
    "circadian_phase_sin",
]


# ─── Architecture (MUST match backend/ml/affect/regressor.py AffectMLP) ────────
class AffectMLP(nn.Module):
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
            nn.Tanh(),
        )

    def forward(self, x):
        return self.net(x)


# ─── Feature extraction (mirrors regressor.extract_features) ───────────────────
def features_from_raw(hrv, hr, eda, sleep_debt, core_temp, t_h):
    hrv_norm = min(1.0, hrv / 80.0)
    lf_hf = max(0.0, 3.0 - hrv_norm * 2.5)
    eda_norm = min(1.0, eda / 8.0)
    sleep_norm = min(1.0, sleep_debt / 8.0)
    temp_dev = (core_temp - 37.0) / 0.5
    hr_norm = min(1.0, max(0.0, (hr - 45) / 75))
    phase_sin = math.sin(2 * math.pi * t_h / 24.0)
    return np.array([hrv_norm, lf_hf, eda_norm, sleep_norm, temp_dev, hr_norm, phase_sin], dtype=np.float32)


# ─── Label rules (from ml/affect/labeling.md) ──────────────────────────────────
def label_from_raw(hrv, hr, eda, sleep_debt, core_temp, t_h):
    """
    Continuous arousal/valence target consistent with the four documented
    label quadrants, plus hard overrides when a quadrant rule is fully met.
    Returns (arousal, valence) in [-1, 1].
    """
    f = features_from_raw(hrv, hr, eda, sleep_debt, core_temp, t_h)
    hrv_norm, lf_hf, eda_norm, sleep_norm, temp_dev, hr_norm, phase_sin = f

    # Continuous physiological priors (sympathetic activation vs. resilience)
    arousal = math.tanh(1.1 * hr_norm + 0.9 * eda_norm + 0.35 * lf_hf - 0.7 * hrv_norm - 0.45)
    valence = math.tanh(0.95 * hrv_norm - 0.85 * sleep_norm - 0.40 * eda_norm + 0.20 * phase_sin + 0.10)

    # Hard-rule overrides (labeling.md) — anchor the corners of the circumplex
    tod_alert = (9 <= t_h <= 11) or (14 <= t_h <= 16)
    if hrv < 25 and eda > 5 and hr > 90:                       # Stressed
        arousal, valence = 0.85, -0.75
    elif hrv > 60 and sleep_debt < 1 and eda < 2:              # Calm / rested
        arousal, valence = -0.70, 0.75
    elif hrv > 50 and 75 <= hr <= 90 and tod_alert:            # Alert / engaged
        arousal, valence = 0.65, 0.65
    elif sleep_debt > 5 and hrv < 35 and temp_dev < -0.6:      # Exhausted
        arousal, valence = -0.65, -0.70

    return arousal, valence


# ─── Synthetic dataset ──────────────────────────────────────────────────────
def make_dataset(n=10000):
    X = np.zeros((n, 7), dtype=np.float32)
    Y = np.zeros((n, 2), dtype=np.float32)
    for i in range(n):
        # Sample physiologically plausible raw biometrics across full range
        hrv = rng.uniform(12, 95)
        hr = rng.uniform(45, 120)
        eda = rng.uniform(0.5, 9.0)
        sleep_debt = rng.uniform(0, 8)
        core_temp = rng.normal(37.0, 0.35)
        t_h = rng.uniform(0, 24)

        X[i] = features_from_raw(hrv, hr, eda, sleep_debt, core_temp, t_h)
        a, v = label_from_raw(hrv, hr, eda, sleep_debt, core_temp, t_h)
        # Small label noise — targets are proxies, not ground truth
        Y[i, 0] = np.clip(a + rng.normal(0, 0.05), -1, 1)
        Y[i, 1] = np.clip(v + rng.normal(0, 0.05), -1, 1)
    return X, Y


def main():
    print("[train] generating synthetic dataset (10,000 samples per labeling.md)...")
    X, Y = make_dataset(10000)

    # 85/15 train/val split
    n = len(X)
    idx = rng.permutation(n)
    split = int(0.85 * n)
    tr, va = idx[:split], idx[split:]
    Xtr, Ytr = torch.tensor(X[tr]), torch.tensor(Y[tr])
    Xva, Yva = torch.tensor(X[va]), torch.tensor(Y[va])

    model = AffectMLP()
    opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=120)
    loss_fn = nn.SmoothL1Loss()

    EPOCHS = 120
    BATCH = 256
    best_val = float("inf")
    best_state = None
    history = []

    for epoch in range(EPOCHS):
        model.train()
        perm = torch.randperm(len(Xtr))
        ep_loss = 0.0
        for b in range(0, len(Xtr), BATCH):
            bi = perm[b:b + BATCH]
            xb, yb = Xtr[bi], Ytr[bi]
            opt.zero_grad()
            pred = model(xb)
            loss = loss_fn(pred, yb)
            loss.backward()
            opt.step()
            ep_loss += loss.item() * len(bi)
        sched.step()
        ep_loss /= len(Xtr)

        model.eval()
        with torch.no_grad():
            vpred = model(Xva)
            vloss = loss_fn(vpred, Yva).item()
            vmae = torch.mean(torch.abs(vpred - Yva)).item()
        history.append({"epoch": epoch, "train_loss": round(ep_loss, 5), "val_loss": round(vloss, 5)})
        if vloss < best_val:
            best_val = vloss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        if epoch % 20 == 0 or epoch == EPOCHS - 1:
            print(f"[train] epoch {epoch:3d}  train={ep_loss:.4f}  val={vloss:.4f}  mae={vmae:.4f}")

    # Restore best
    model.load_state_dict(best_state)
    model.eval()
    with torch.no_grad():
        vpred = model(Xva)
        val_mae = torch.mean(torch.abs(vpred - Yva), dim=0)
        val_mae_arousal = float(val_mae[0])
        val_mae_valence = float(val_mae[1])
        # R^2 per dimension
        ss_res = torch.sum((vpred - Yva) ** 2, dim=0)
        ss_tot = torch.sum((Yva - Yva.mean(dim=0)) ** 2, dim=0)
        r2 = (1 - ss_res / ss_tot).tolist()

    weights_path = os.path.join(WEIGHTS_DIR, "affect_mlp.pt")
    torch.save(model.state_dict(), weights_path)
    print(f"[train] saved weights -> {weights_path}")

    card = {
        "model_name": "SYNAPSE-1 Affect Estimator",
        "architecture": "MLP 7→32(LayerNorm,GELU,Dropout0.1)→16(GELU)→2(Tanh)",
        "framework": f"PyTorch {torch.__version__}",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "seed": SEED,
        "n_samples": n,
        "train_val_split": "85/15",
        "epochs": EPOCHS,
        "optimizer": "AdamW(lr=2e-3, wd=1e-4) + CosineAnnealing",
        "loss": "SmoothL1 (Huber)",
        "feature_names": FEATURE_NAMES,
        "outputs": ["arousal", "valence"],
        "metrics": {
            "best_val_loss": round(best_val, 5),
            "val_mae_arousal": round(val_mae_arousal, 4),
            "val_mae_valence": round(val_mae_valence, 4),
            "val_r2_arousal": round(r2[0], 4),
            "val_r2_valence": round(r2[1], 4),
        },
        "label_rules": [
            "Stressed  (arousal↑, valence↓): HRV<25ms ∧ EDA>5µS ∧ HR>90bpm",
            "Calm      (arousal↓, valence↑): HRV>60ms ∧ sleep_debt<1h ∧ EDA<2µS",
            "Engaged   (arousal↑, valence↑): HRV>50ms ∧ 75≤HR≤90 ∧ ToD 09-11/14-16",
            "Exhausted (arousal↓, valence↓): sleep_debt>5h ∧ HRV<35ms ∧ Δcore_temp<-0.3°C",
        ],
        "limitations": [
            "Labels are physiological proxies, not validated psychometry.",
            "No individual baseline calibration or personality modelling.",
            "Not for clinical or occupational decisions — support only.",
        ],
        "history": history[::10],  # thin the curve for the UI
    }
    card_path = os.path.join(WEIGHTS_DIR, "affect_model_card.json")
    with open(card_path, "w", encoding="utf-8") as fh:
        json.dump(card, fh, indent=2)
    print(f"[train] saved model card -> {card_path}")
    print(f"[train] DONE  val_MAE arousal={val_mae_arousal:.3f} valence={val_mae_valence:.3f} "
          f"R² a={r2[0]:.3f} v={r2[1]:.3f}")


if __name__ == "__main__":
    main()
