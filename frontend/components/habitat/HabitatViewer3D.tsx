"use client";

import { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Html, Line, Sphere, Box, Cylinder, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { useHabitatStore } from "@/lib/store";
import { LEVEL_COLORS } from "@/lib/types";

// ─── Zone Colors ─────────────────────────────────────────────────────────────
function getLuxColor(lux: number): THREE.Color {
  const t = Math.min(1, lux / 800);
  return new THREE.Color().setHSL(0.17 * t, 0.8, 0.3 + 0.4 * t);
}

function getCO2Color(ppm: number): THREE.Color {
  const t = Math.min(1, Math.max(0, (ppm - 400) / 1600));
  return new THREE.Color().setHSL(0.33 - 0.33 * t, 0.7, 0.4);
}

function getAcousticColor(db: number): THREE.Color {
  const t = Math.min(1, Math.max(0, (db - 30) / 50));
  return new THREE.Color().setHSL(0.6 - 0.6 * t, 0.8, 0.4);
}

function getCCTColor(cct: number): THREE.Color {
  // Warm (2000K, orange) → cool (7500K, blue-white)
  const t = Math.min(1, Math.max(0, (cct - 2000) / 5500));
  return new THREE.Color().setHSL(0.08 + 0.5 * t, 0.6, 0.45 + 0.1 * t);
}

function getCohesionColor(c: number): THREE.Color {
  // Low cohesion (red) → high cohesion (green)
  return new THREE.Color().setHSL(0.0 + 0.33 * Math.min(1, Math.max(0, c)), 0.75, 0.42);
}

/** Shared heatmap → colour resolver for all zone types. */
function resolveZoneColor(
  heatmapMode: string | null,
  zone: any,
  cohesionCell: { cohesion: number } | undefined,
  baseColor: THREE.Color,
): THREE.Color {
  switch (heatmapMode) {
    case "Lux": return getLuxColor(zone?.lux ?? 400);
    case "CCT": return getCCTColor(zone?.cct ?? 4000);
    case "CO₂": return getCO2Color(zone?.co2_ppm ?? 800);
    case "Acoustic": return getAcousticColor(zone?.db_spl ?? 45);
    case "Cohesion": return cohesionCell ? getCohesionColor(cohesionCell.cohesion) : baseColor;
    default: return baseColor;
  }
}

// ─── Ambient airflow particle field (surreal life) ────────────────────────────
function AirflowParticles({ count = 260 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useRef<Float32Array>();
  if (!positions.current) {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 4 + Math.random() * 12;
      const a = Math.random() * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    positions.current = arr;
  }
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.03;
      const y = ref.current.geometry.attributes.position.array as Float32Array;
      for (let i = 1; i < y.length; i += 3) {
        y[i] += Math.sin(Date.now() * 0.0004 + i) * 0.004;
      }
      ref.current.geometry.attributes.position.needsUpdate = true;
    }
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions.current, 3]}
          count={count} array={positions.current} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#38bdf8" transparent opacity={0.35}
        depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ─── Atrium (Hippocampal Anchor) ──────────────────────────────────────────────
function Atrium({ onClick, selected, heatmapMode }: { onClick: () => void; selected: boolean; heatmapMode: string | null }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group position={[0, 0, 0]} onClick={onClick}>
      {/* Vertical atrium shaft */}
      <Cylinder ref={meshRef} args={[1.5, 1.5, 8, 16, 1, true]} rotation={[0, 0, 0]}>
        <meshStandardMaterial color={selected ? "#06b6d4" : "#0e7490"} transparent opacity={0.3}
          wireframe={false} side={THREE.DoubleSide} />
      </Cylinder>
      {/* Inner glow */}
      <Cylinder args={[0.8, 0.8, 8, 8, 1, true]}>
        <meshStandardMaterial color="#06b6d4" transparent opacity={0.15} emissive="#06b6d4" emissiveIntensity={0.5} />
      </Cylinder>
      {/* Label */}
      <Text position={[0, 5, 0]} fontSize={0.35} color="#06b6d4" anchorX="center" anchorY="bottom">
        HIPPOCAMPAL ANCHOR
      </Text>
      <Text position={[0, 4.5, 0]} fontSize={0.25} color="#0e7490" anchorX="center" anchorY="bottom">
        Central Atrium
      </Text>
      {selected && (
        <Html position={[2, 0, 0]}>
          <div className="bg-surface/90 border border-accent/40 rounded-lg px-3 py-2 text-xs text-accent">
            zone_atrium · SPECIAL
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Soma Zone ────────────────────────────────────────────────────────────────
function SomaZone({ zoneId, angle, radius, onClick, selected, heatmapMode, zone, cohesionCell }: {
  zoneId: string; angle: number; radius: number; onClick: () => void;
  selected: boolean; heatmapMode: string | null; zone: any; cohesionCell?: { cohesion: number };
}) {
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const baseColor = new THREE.Color(LEVEL_COLORS.SOMA);
  const color = resolveZoneColor(heatmapMode, zone, cohesionCell, baseColor);

  return (
    <group position={[x, -3, z]} onClick={onClick}>
      <Box args={[2.5, 2, 2.5]} castShadow>
        <meshStandardMaterial color={selected ? "#c4b5fd" : color} transparent opacity={0.8}
          emissive={selected ? "#7c3aed" : "#4c1d95"} emissiveIntensity={selected ? 0.4 : 0.1} />
      </Box>
      <Text position={[0, 1.3, 0]} fontSize={0.25} color="#a78bfa" anchorX="center">
        {zone?.name?.replace(/^(Soma\s)/i, "").slice(0, 16) ?? zoneId}
      </Text>
    </group>
  );
}

// ─── Axon Zone ────────────────────────────────────────────────────────────────
function AxonZone({ zoneId, angle, radius, onClick, selected, heatmapMode, zone, cohesionCell }: {
  zoneId: string; angle: number; radius: number; onClick: () => void;
  selected: boolean; heatmapMode: string | null; zone: any; cohesionCell?: { cohesion: number };
}) {
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const baseColor = new THREE.Color(LEVEL_COLORS.AXON);
  const color = resolveZoneColor(heatmapMode, zone, cohesionCell, baseColor);

  return (
    <group position={[x, 0, z]} onClick={onClick}>
      <Box args={[2.2, 1.8, 2.2]} castShadow>
        <meshStandardMaterial color={selected ? "#6ee7b7" : color} transparent opacity={0.75}
          emissive={selected ? "#065f46" : "#022c22"} emissiveIntensity={selected ? 0.4 : 0.1} />
      </Box>
      <Text position={[0, 1.1, 0]} fontSize={0.22} color="#34d399" anchorX="center">
        {zone?.name?.slice(0, 16) ?? zoneId}
      </Text>
    </group>
  );
}

// ─── Dendrite Pod ─────────────────────────────────────────────────────────────
function DendritePod({ zoneId, podNum, angle, radius, onClick, selected, heatmapMode, zone, cohesionCell }: {
  zoneId: string; podNum: number; angle: number; radius: number; onClick: () => void;
  selected: boolean; heatmapMode: string | null; zone: any; cohesionCell?: { cohesion: number };
}) {
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const baseColor = new THREE.Color(LEVEL_COLORS.DENDRITE);
  const color = resolveZoneColor(heatmapMode, zone, cohesionCell, baseColor);

  return (
    <group position={[x, 3.5, z]} onClick={onClick}>
      {/* Pod body */}
      <Box args={[1.5, 1.8, 1.5]}>
        <meshStandardMaterial color={selected ? "#93c5fd" : color} transparent opacity={0.85}
          emissive={selected ? "#1e40af" : "#1e3a5f"} emissiveIntensity={selected ? 0.6 : 0.15} />
      </Box>
      {/* Water shield ring */}
      <Cylinder args={[1.1, 1.1, 1.8, 8, 1, true]}>
        <meshStandardMaterial color="#0ea5e9" transparent opacity={0.15} />
      </Cylinder>
      <Text position={[0, 1.2, 0]} fontSize={0.22} color="#60a5fa" anchorX="center">
        Pod {String(podNum).padStart(2, "0")}
      </Text>
    </group>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function HabitatScene({ selectedZone, onSelectZone, cameraPreset, heatmapMode, cohesion }: {
  selectedZone: string | null;
  onSelectZone: (id: string | null) => void;
  cameraPreset: string;
  heatmapMode: string | null;
  cohesion?: Record<string, { cohesion: number }>;
}) {
  const { zones } = useHabitatStore();
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  // Camera presets
  useEffect(() => {
    const positions: Record<string, [number, number, number]> = {
      Overview: [18, 14, 18],
      Cutaway: [20, 2, 0],
      "Soma Ring": [0, -8, 16],
      "Dendrite Grid": [0, 12, 14],
      "Atrium Below": [0, -10, 0.1],
    };
    const targets: Record<string, [number, number, number]> = {
      Overview: [0, 0, 0],
      Cutaway: [0, 0, 0],
      "Soma Ring": [0, -3, 0],
      "Dendrite Grid": [0, 3, 0],
      "Atrium Below": [0, 0, 0],
    };
    const pos = positions[cameraPreset] ?? positions.Overview;
    const tgt = targets[cameraPreset] ?? [0, 0, 0];
    camera.position.set(...pos);
    if (controlsRef.current) {
      controlsRef.current.target.set(...tgt);
      controlsRef.current.update();
    }
  }, [cameraPreset]);

  const somaZones = ["zone_atrium", "zone_soma_galley", "zone_soma_hearth", "zone_soma_common"];
  const axonZones = ["zone_axon_lab_a", "zone_axon_lab_b", "zone_axon_aeroponics", "zone_axon_gallery"];
  const dendriteZones = Array.from({ length: 12 }, (_, i) => `zone_dendrite_pod_${String(i + 1).padStart(2, "0")}`);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 8, 0]} intensity={1.5} color="#06b6d4" />
      <pointLight position={[10, 0, 10]} intensity={0.5} color="#a78bfa" />
      <pointLight position={[-10, 0, -10]} intensity={0.5} color="#34d399" />

      {/* Atrium */}
      <Atrium onClick={() => onSelectZone(selectedZone === "zone_atrium" ? null : "zone_atrium")}
        selected={selectedZone === "zone_atrium"} heatmapMode={heatmapMode} />

      {/* Ambient airflow field */}
      <AirflowParticles />

      {/* Soma zones */}
      {somaZones.filter(id => id !== "zone_atrium").map((id, i) => (
        <SomaZone key={id} zoneId={id} angle={(i / 3) * Math.PI * 2} radius={6}
          onClick={() => onSelectZone(selectedZone === id ? null : id)}
          selected={selectedZone === id} heatmapMode={heatmapMode} zone={zones[id]}
          cohesionCell={cohesion?.[id]} />
      ))}

      {/* Axon zones */}
      {axonZones.map((id, i) => (
        <AxonZone key={id} zoneId={id} angle={(i / 4) * Math.PI * 2 + Math.PI / 4} radius={9}
          onClick={() => onSelectZone(selectedZone === id ? null : id)}
          selected={selectedZone === id} heatmapMode={heatmapMode} zone={zones[id]}
          cohesionCell={cohesion?.[id]} />
      ))}

      {/* Dendrite pods */}
      {dendriteZones.map((id, i) => (
        <DendritePod key={id} zoneId={id} podNum={i + 1}
          angle={(i / 12) * Math.PI * 2} radius={12}
          onClick={() => onSelectZone(selectedZone === id ? null : id)}
          selected={selectedZone === id} heatmapMode={heatmapMode} zone={zones[id]}
          cohesionCell={cohesion?.[id]} />
      ))}

      {/* Connector lines from atrium */}
      {[...somaZones.slice(1), ...axonZones].map((id, i) => {
        const angle = id.includes("soma")
          ? ((somaZones.indexOf(id) - 1) / 3) * Math.PI * 2
          : (axonZones.indexOf(id) / 4) * Math.PI * 2 + Math.PI / 4;
        const r = id.includes("soma") ? 6 : 9;
        const y = id.includes("soma") ? -3 : 0;
        return (
          <Line key={id} points={[[0, 0, 0], [Math.cos(angle) * r, y, Math.sin(angle) * r]]}
            color="#06b6d4" transparent opacity={0.15} lineWidth={1} />
        );
      })}

      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} makeDefault />

      {/* Floor grid */}
      <gridHelper args={[40, 40, "#1e293b", "#0f172a"]} position={[0, -5, 0]} />
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HabitatViewer3D({ selectedZone, onSelectZone, cameraPreset, heatmapMode, cohesion }: {
  selectedZone: string | null;
  onSelectZone: (id: string | null) => void;
  cameraPreset: string;
  heatmapMode: string | null;
  cohesion?: Record<string, { cohesion: number }>;
}) {
  return (
    <div className="w-full h-full bg-background">
      <Canvas shadows camera={{ position: [18, 14, 18], fov: 55 }} gl={{ antialias: true }}>
        <color attach="background" args={["#030712"]} />
        <fog attach="fog" args={["#030712", 30, 80]} />
        <Suspense fallback={null}>
          <HabitatScene selectedZone={selectedZone} onSelectZone={onSelectZone}
            cameraPreset={cameraPreset} heatmapMode={heatmapMode} cohesion={cohesion} />
        </Suspense>
      </Canvas>
    </div>
  );
}

