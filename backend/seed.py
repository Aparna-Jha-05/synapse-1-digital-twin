from __future__ import annotations
from sqlmodel import Session, select
from models import Crew, Zone


CREW_DATA = [
    ("crew01", "Dr. Vikram Nair", "Commander"),
    ("crew02", "Dr. Rohan Mehta", "Flight Surgeon"),
    ("crew03", "Dr. Priya Chandrasekaran", "Geologist"),
    ("crew04", "Dr. Arjun Sharma", "Systems Engineer"),
    ("crew05", "Dr. Kavya Reddy", "Biologist"),
    ("crew06", "Dr. Aditya Iyer", "Astrobiologist"),
    ("crew07", "Dr. Ravi Krishnan", "Structural Engineer"),
    ("crew08", "Dr. Meera Bose", "Psychologist"),
    ("crew09", "Dr. Ananya Patel", "Physicist"),
    ("crew10", "Dr. Suresh Rao", "Robotics Engineer"),
    ("crew11", "Dr. Divya Menon", "Chemist"),
    ("crew12", "Dr. Kiran Joshi", "Mission Specialist"),
]

ZONE_DATA = [
    # (zone_id, level, name, description, occupancy_cap)
    ("zone_atrium", "SPECIAL", "Hippocampal Anchor Atrium",
     "The central Z-axis spatial anchor. A 12m vertical atrium serving as the primary spatial reference for grid-cell navigation and psychological orientation.", 12),
    # SOMA - Level 1
    ("zone_soma_galley", "SOMA", "Galley & Dining Commons",
     "Communal nutrition and social dining space. Primary social cohesion zone.", 12),
    ("zone_soma_hearth", "SOMA", "Holographic Hearth",
     "The social fireplace — holographic projection of Earth environments. Subliminally rewarding social gathering space.", 8),
    ("zone_soma_common", "SOMA", "Soma Commons",
     "Open communal area for informal gathering, exercise, and decompression.", 10),
    # AXON - Level 2
    ("zone_axon_lab_a", "AXON", "Laboratory Alpha",
     "Primary science and research laboratory.", 4),
    ("zone_axon_lab_b", "AXON", "Laboratory Beta",
     "Secondary research laboratory and sample analysis.", 4),
    ("zone_axon_aeroponics", "AXON", "Aeroponic Garden",
     "Closed-loop food production. Each crew member adopts a bonsai station — Attention Restoration Theory operationalised.", 3),
    ("zone_axon_gallery", "AXON", "Axon Gallery",
     "Transitional corridor and movement space. Designed for circadian-supporting physical activity.", 6),
    # DENDRITE - Level 3 (private pods)
] + [
    (f"zone_dendrite_pod_{i:02d}", "DENDRITE", f"Pod {i:02d}",
     f"Private sleep pod for crew member {i:02d}. Water-tank radiation shielding surrounds this pod.", 1)
    for i in range(1, 13)
]


def seed_database(session: Session) -> None:
    """Seed or refresh crew names; seed zones only if empty."""
    for i, (crew_id, name, role) in enumerate(CREW_DATA):
        existing = session.exec(select(Crew).where(Crew.crew_id == crew_id)).first()
        if existing:
            existing.display_name = name
            existing.role = role
        else:
            session.add(Crew(
                crew_id=crew_id,
                display_name=name,
                role=role,
                avatar_seed=i * 7 + 13,
                consent_share_bio=True,
                consent_share_affect=True,
            ))

    if not session.exec(select(Zone)).first():
        for zone_id, level, name, desc, cap in ZONE_DATA:
            session.add(Zone(
                zone_id=zone_id,
                level=level,
                name=name,
                description=desc,
                occupancy_cap=cap,
            ))

    session.commit()
    print("[OK] Crew names refreshed; zones seeded if new")
