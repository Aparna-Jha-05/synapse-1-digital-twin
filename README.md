# SYNAPSE-1 Digital Twin

**SpAr Conclave 2026 · Theme 3: Human-Centred & Behavioural Design**
**Team:** SPAR26-HCBD-06

> *Architecture as a Proactive Behavioural Support System*

An operational **digital twin** of a lunar habitat that models crew circadian
rhythm and affective state in real time, forecasts how the mission will unfold,
and treats the built environment itself as a behavioural-support instrument —
all under an explicit, auditable ethics contract.

---

## Quick Start (Dev Mode — 90 seconds)

### Prerequisites
- Python 3.11+ (`py -3 --version`)
- Node.js 18+ (`node --version`)

### 1. Start Backend

```bash
cd backend
py -3 -m pip install -r requirements.txt
py -3 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Backend ready at: http://127.0.0.1:8000

### 2. Start Frontend (new terminal)

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Frontend ready at: http://localhost:3000

### 3. (Optional) Train the affect model

The repo ships with pre-trained weights, but you can reproduce them:

```bash
py -3 ml/train_affect.py
```

This regenerates `ml/weights/affect_mlp.pt` and `affect_model_card.json`.

---

## Login Credentials

| Role | Username | Password | Access |
|---|---|---|---|
| Ground Control | `ground` | `ground` | Full analytics, ML, Digital Twin, Ethics ledger |
| Crew Member | `crew01`–`crew12` | `crew` | Personal companion view |

---

## Architecture

```
spar/
├── backend/          FastAPI + SQLModel + WebSockets
│   ├── main.py       All API routes + WebSocket endpoints + Digital Twin
│   ├── models.py     SQLModel database tables
│   ├── auth.py       JWT authentication (GROUND / CREW roles)
│   ├── seed.py       Initial crew + zone data
│   ├── sim/          Physically-grounded data simulator
│   │   └── simulator.py  Circadian cosine, Perlin airflow, stress scenarios,
│   │                     forward simulation (digital twin)
│   └── ml/
│       ├── circadian/    Kronauer van der Pol oscillator (PyTorch)
│       └── affect/       Russell circumplex MLP + MC-dropout uncertainty
│
├── frontend/         Next.js 14 + TypeScript + TailwindCSS
│   ├── components/
│   │   ├── GalaxyBackground.tsx      Shader-driven surreal galaxy backdrop
│   │   └── habitat/HabitatViewer3D.tsx  Live 3D habitat (React Three Fiber)
│   └── app/
│       ├── page.tsx              Landing (galaxy backdrop)
│       ├── login/                Role-aware login (galaxy backdrop)
│       ├── ground/               Ground Control dashboard
│       │   ├── page.tsx          Neuro-Core OS — live 3D + friction + vitals
│       │   ├── habitat/          Full 3D viewer (heatmaps: Lux/CCT/CO₂/Acoustic/Cohesion)
│       │   ├── twin/             Digital Twin — forward simulation + scrub timeline
│       │   ├── crew/             Full biometrics + circadian rings
│       │   ├── circadian/        Phase oscillator dashboard
│       │   ├── scenarios/        Scenario injection + replay
│       │   ├── model-card/       Affect model card (metrics, curve, limitations)
│       │   ├── ethics/           Ethics accountability ledger
│       │   └── comms/            Comms latency + ISRU queue
│       └── crew/[id]/            Crew Companion
│           ├── page.tsx          Home: mood weather, light schedule, suggestion
│           ├── hearth/           Holographic Hearth live view
│           ├── garden/           Aeroponic bonsai (ART)
│           ├── journal/          Private encrypted journal (device-only)
│           └── anchor-test/      Hippocampal spatial memory test
│
├── ml/               ML training, docs & labeling rules
│   ├── train_affect.py   Trains the affect MLP from documented label rules
│   └── weights/          Trained weights + model card (committed)
├── docs/             NARRATIVE, ETHICAL_STATEMENT, ML_METHODS, DEMO
├── frontend/vercel.json   Frontend (Vercel) deployment config
└── docker-compose.yml
```

---

## Key Features

| Feature | Location | Notes |
|---|---|---|
| Live 3D habitat viewer (R3F) | `/ground` + `/ground/habitat` | Embedded on the dashboard, airflow particles, 5 heatmap modes |
| Surreal galaxy backdrop | Landing + Login | Shader-driven differential rotation, iridescence, shooting stars |
| **Digital Twin — forward simulation** | `/ground/twin` | Projects circadian + affect 4–48h ahead with what-if scenarios + scrub timeline |
| **Trained affect model + Model Card** | `/ground/model-card` | Real PyTorch training (R² 0.88/0.94), MC-dropout uncertainty, honest limitations |
| **Explainable friction model** | `/ground` (server-side) | Additive attribution over circadian debt, sleep debt, affect divergence, shared zone |
| **Per-zone cohesion heatmap** | `/ground/habitat` | Grounded in crew affect valence + spread (previously a stub) |
| Kronauer circadian oscillator | `backend/ml/circadian` | Van der Pol limit-cycle, per-crew phase |
| Live bio + env polling | `/habitat/zones`, `/crew`, `/crew/{id}/bio-live` | 2–3s polling, consent-gated. (`/ws/env`, `/ws/bio/{id}` still exist for WebSocket-capable hosts, unused by this frontend.) |
| Hash-chained ethics ledger | `/ground/ethics` | Every actuation + twin run logged and verifiable |
| Sensory Monotony Index (SMI) | `/ground` | Variance-based habituation alarm |
| Comms Latency Theatre / ISRU queue | `/ground/comms` | Earth-link latency, regolith brick curing |
| Hippocampal Anchor Test | `/crew/{id}/anchor-test` | Spatial memory check |

### Notable API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/twin/simulate` | Forward-simulate crew trajectories (read-only, ethics-logged) |
| `GET`  | `/crew/friction` | Explainable pairwise friction with per-driver attributions |
| `GET`  | `/crew/cohesion-heatmap` | Per-zone social cohesion |
| `GET`  | `/ml/model-card` | Affect-model provenance + real training metrics |
| `GET`  | `/crew/{id}/affect` | Affect estimate + live MC-dropout uncertainty band |

---

## Machine Learning

Two models, both demonstrators (indicative, **not** diagnostic):

1. **Circadian oscillator** — a Kronauer-style van der Pol limit-cycle model
   (Kronauer 1999; St Hilaire 2007) integrated per crew member under their pod
   lighting.
2. **Affect estimator** — a small MLP (`7 → 32 → 16 → 2`) mapping biometric
   features to Russell-circumplex coordinates (arousal, valence). Trained on
   10,000 synthetic samples whose labels follow the **fully documented rules** in
   [`ml/affect/labeling.md`](ml/affect/labeling.md). Ships with gradient×input
   attributions and **Monte-Carlo dropout uncertainty**.

Validation metrics (see the in-app Model Card): **R² ≈ 0.88 (arousal) / 0.94
(valence)**, MAE ≈ 0.07.

> "Estimates" not "predicts" — a model's label rules are its implicit values, so
> they are disclosed on purpose. Not for clinical or occupational decisions.

---

## Deployment

Frontend and backend deploy as **two separate Vercel projects** from this one
repo, each with its own **Root Directory**. This works today for free — the
tradeoffs of doing it this way are documented below.

### Frontend → Vercel

1. Import the repo in Vercel and set **Root Directory** to `frontend`.
2. Add an environment variable:
   - `NEXT_PUBLIC_API_URL` = the deployed backend URL (e.g. `https://synapse-1-backend.vercel.app`)
3. Deploy. `frontend/vercel.json` pins the framework and, importantly, the
   install command (`npm install --legacy-peer-deps`) this project requires.

### Backend → Vercel (free tier)

1. Import the repo as a **second** Vercel project, **Root Directory** = `backend`.
2. Deploy — no extra config needed. `backend/vercel.json` routes all paths to
   `backend/api/index.py`, which imports the existing `main.py` FastAPI `app`
   unchanged. `backend/api/requirements.txt` is a trimmed dependency set
   Vercel's Python builder picks up automatically for that function.

**What had to change to make a stateful FastAPI app deployable as serverless
functions, and what you give up on the free tier:**

| Constraint | What changed |
|---|---|
| No persistent process → no long-lived WebSockets | `/ws/env` and `/ws/bio/{id}` are unused by the frontend now; everything polls REST endpoints instead (`/habitat/zones` every 2s, `/crew` every 3s, a new `/crew/{id}/bio-live` every 2s for a crew member's own view). Slightly less smooth than a true push stream, functionally equivalent. |
| Vercel's ~250MB function size limit | `torch` (and unused `scikit-learn`) are excluded from `backend/api/requirements.txt`. The affect estimator already has a documented, interpretable **rule-based fallback** for when PyTorch isn't installed — the Model Card page (`/ground/model-card`) shows a live banner reporting which inference path (`mlp` vs `rule_based`) this specific deployment is actually running, so nothing is silently misrepresented. |
| Ephemeral filesystem / no shared memory across instances | SQLite and in-memory caches (crew consent, ethics ledger, chromotherapy overrides) may occasionally reset across cold starts or when Vercel routes to a different instance. **Accepted as a known limitation of the free tier** — fine for demoing, not for a real deployment. Move the backend to a persistent host (Render/Railway/Fly, using the unmodified `backend/requirements.txt` + `Dockerfile`) when you're ready to pay, and this limitation goes away entirely — nothing else needs to change. |

CORS currently allows all origins for the demo; lock this down to your
frontend's domain for a real deployment.

### Local Docker (both services, full stack incl. trained MLP)

```bash
docker compose up
```

---

## Documentation

- [docs/NARRATIVE.md](docs/NARRATIVE.md) — Design narrative
- [docs/ETHICAL_STATEMENT.md](docs/ETHICAL_STATEMENT.md) — Ethical accountability statement
- [docs/ML_METHODS.md](docs/ML_METHODS.md) — ML model methods and references
- [ml/README.md](ml/README.md) — ML literature references
- [docs/DEMO.md](docs/DEMO.md) — Jury demo walkthrough
