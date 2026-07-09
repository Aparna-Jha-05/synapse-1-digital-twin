"use client";

import { useRef, useState, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls, Html, Float, Line, RoundedBox,
  Environment, Lightformer, ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";
import { useHabitatStore } from "@/lib/store";
import { LEVEL_COLORS } from "@/lib/types";

// ─── Heatmap colour resolvers ─────────────────────────────────────────────────
function getLuxColor(lux: number): THREE.Color {
  const t = Math.min(1, lux / 800);
  return new THREE.Color().setHSL(0.14 * t + 0.03, 0.85, 0.35 + 0.35 * t);
}
function getCO2Color(ppm: number): THREE.Color {
  const t = Math.min(1, Math.max(0, (ppm - 400) / 1600));
  return new THREE.Color().setHSL(0.33 - 0.33 * t, 0.8, 0.45);
}
function getAcousticColor(db: number): THREE.Color {
  const t = Math.min(1, Math.max(0, (db - 30) / 50));
  return new THREE.Color().setHSL(0.6 - 0.6 * t, 0.85, 0.5);
}
function getCCTColor(cct: number): THREE.Color {
  const t = Math.min(1, Math.max(0, (cct - 2000) / 5500));
  return new THREE.Color().setHSL(0.08 + 0.5 * t, 0.7, 0.5 + 0.08 * t);
}
function getCohesionColor(c: number): THREE.Color {
  return new THREE.Color().setHSL(0.33 * Math.min(1, Math.max(0, c)), 0.8, 0.48);
}
function resolveZoneColor(
  heatmapMode: string | null, zone: any,
  cohesionCell: { cohesion: number } | undefined, baseColor: THREE.Color,
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

// ─── Fresnel rim-glow material (holographic edge) ─────────────────────────────
const FRESNEL_VERT = `
varying vec3 vNormalW;
varying vec3 vViewDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FRESNEL_FRAG = `
uniform vec3 uColor;
uniform float uPower;
uniform float uIntensity;
varying vec3 vNormalW;
varying vec3 vViewDir;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), uPower);
  gl_FragColor = vec4(uColor * uIntensity, f);
}`;

function FresnelMat({ color, power = 2.6, intensity = 1.0 }: { color: THREE.ColorRepresentation; power?: number; intensity?: number }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: FRESNEL_VERT, fragmentShader: FRESNEL_FRAG,
    uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: power }, uIntensity: { value: intensity } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), []);
  (mat.uniforms.uColor.value as THREE.Color).set(color);
  mat.uniforms.uPower.value = power;
  mat.uniforms.uIntensity.value = intensity;
  return <primitive object={mat} attach="material" />;
}

// ─── Soft radial sprite texture (halos / floor glow) ──────────────────────────
function useGlowTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.25)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
}

// ─── Central Neuro-Core spire (Hippocampal Anchor) ────────────────────────────
function CoreSpire({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  const ringsRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const glow = useGlowTexture();

  useFrame((state, delta) => {
    if (ringsRef.current) ringsRef.current.rotation.y += delta * 0.4;
    if (beaconRef.current) {
      const p = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2);
      (beaconRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + p * 1.5;
      beaconRef.current.scale.setScalar(0.9 + p * 0.15);
    }
  });

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* Outer glass shell */}
      <mesh>
        <cylinderGeometry args={[1.15, 1.4, 12, 40, 1, true]} />
        <meshStandardMaterial color="#0e7490" transparent opacity={0.12} side={THREE.DoubleSide}
          metalness={0.4} roughness={0.1} />
      </mesh>
      {/* Fresnel edge */}
      <mesh>
        <cylinderGeometry args={[1.15, 1.4, 12, 40, 1, true]} />
        <FresnelMat color={selected ? "#67e8f9" : "#22d3ee"} power={2.2} intensity={selected ? 1.5 : 1.0} />
      </mesh>
      {/* Bright inner core */}
      <mesh>
        <cylinderGeometry args={[0.35, 0.45, 11.6, 24]} />
        <meshStandardMaterial color="#a5f3fc" emissive="#22d3ee" emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      {/* Pulsing energy rings climbing the core */}
      <group ref={ringsRef}>
        {[-4, -2, 0, 2, 4].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.5 + (i % 2) * 0.15, 0.03, 8, 48]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.6} toneMapped={false} transparent opacity={0.9} />
          </mesh>
        ))}
      </group>
      {/* Top beacon node */}
      <mesh ref={beaconRef} position={[0, 6.4, 0]}>
        <icosahedronGeometry args={[0.55, 2]} />
        <meshStandardMaterial color="#cffafe" emissive="#38bdf8" emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <sprite position={[0, 6.4, 0]} scale={[4, 4, 1]}>
        <spriteMaterial map={glow} color="#38bdf8" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {/* Base glow */}
      <sprite position={[0, -6, 0]} scale={[6, 6, 1]}>
        <spriteMaterial map={glow} color="#0891b2" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {selected && (
        <Html position={[1.8, 6.4, 0]} distanceFactor={16} pointerEvents="none">
          <div className="whitespace-nowrap rounded-md border border-cyan-400/40 bg-slate-950/85 px-2 py-1 text-[11px] font-medium text-cyan-300 shadow-lg">
            Hippocampal Anchor · Central Atrium
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Structural ring (torus per level) ────────────────────────────────────────
function LevelRing({ y, radius, color }: { y: number; radius: number; color: string }) {
  return (
    <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.05, 10, 96]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.55} toneMapped={false} />
    </mesh>
  );
}

// ─── Glowing neural connective tube (core → module) ───────────────────────────
function NeuralTube({ to, color }: { to: [number, number, number]; color: string }) {
  const points = useMemo(() => {
    const from = new THREE.Vector3(0, to[1] * 0.5, 0);
    const end = new THREE.Vector3(...to);
    const mid = from.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.6, 0));
    return new THREE.QuadraticBezierCurve3(from, mid, end).getPoints(24).map((p) => [p.x, p.y, p.z] as [number, number, number]);
  }, [to]);
  return <Line points={points} color={color} lineWidth={1.2} transparent opacity={0.35} />;
}

// ─── Soma / Axon module ───────────────────────────────────────────────────────
function ZoneModule({
  zoneId, level, position, size, onClick, selected, heatmapMode, zone, cohesionCell, label,
}: {
  zoneId: string; level: "SOMA" | "AXON"; position: [number, number, number];
  size: [number, number, number]; onClick: () => void; selected: boolean;
  heatmapMode: string | null; zone: any; cohesionCell?: { cohesion: number }; label: string;
}) {
  const [hovered, setHovered] = useState(false);
  const accent = LEVEL_COLORS[level];
  const base = new THREE.Color(accent);
  const color = resolveZoneColor(heatmapMode, zone, cohesionCell, base);
  const active = selected || hovered;
  const glow = useGlowTexture();

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => { document.body.style.cursor = "auto"; };
  }, [hovered]);

  return (
    <Float speed={2} rotationIntensity={0} floatIntensity={0.35} floatingRange={[-0.05, 0.05]}>
      <group position={position}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}>
        {/* Body */}
        <RoundedBox args={size} radius={0.14} smoothness={4}>
          <meshStandardMaterial color={color} metalness={0.55} roughness={0.28}
            emissive={color} emissiveIntensity={active ? 0.5 : 0.16}
            transparent opacity={0.92} />
        </RoundedBox>
        {/* Fresnel rim */}
        <mesh scale={1.015}>
          <boxGeometry args={size} />
          <FresnelMat color={accent} power={2.4} intensity={active ? 1.6 : 0.9} />
        </mesh>
        {/* Emissive base strip */}
        <mesh position={[0, -size[1] / 2 - 0.02, 0]}>
          <boxGeometry args={[size[0] * 0.85, 0.05, size[2] * 0.85]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
        {active && (
          <sprite scale={[size[0] * 2.4, size[1] * 2.4, 1]}>
            <spriteMaterial map={glow} color={accent} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        )}
        {active && (
          <Html position={[0, size[1] / 2 + 0.35, 0]} center distanceFactor={15} pointerEvents="none">
            <div className="whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium shadow-lg"
              style={{ borderColor: `${accent}66`, background: "rgba(2,6,23,0.85)", color: accent }}>
              {label}
            </div>
          </Html>
        )}
      </group>
    </Float>
  );
}

// ─── Dendrite sleep pod ───────────────────────────────────────────────────────
function DendritePod({
  zoneId, podNum, position, onClick, selected, heatmapMode, zone, cohesionCell,
}: {
  zoneId: string; podNum: number; position: [number, number, number];
  onClick: () => void; selected: boolean; heatmapMode: string | null;
  zone: any; cohesionCell?: { cohesion: number };
}) {
  const [hovered, setHovered] = useState(false);
  const accent = LEVEL_COLORS.DENDRITE;
  const base = new THREE.Color(accent);
  const color = resolveZoneColor(heatmapMode, zone, cohesionCell, base);
  const active = selected || hovered;

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => { document.body.style.cursor = "auto"; };
  }, [hovered]);

  return (
    <Float speed={2.5} rotationIntensity={0} floatIntensity={0.3} floatingRange={[-0.04, 0.04]}>
      <group position={position}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}>
        {/* Pod capsule */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.62, 0.7, 8, 20]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.22}
            emissive={color} emissiveIntensity={active ? 0.55 : 0.18} transparent opacity={0.9} />
        </mesh>
        {/* Fresnel rim */}
        <mesh rotation={[0, 0, Math.PI / 2]} scale={1.03}>
          <capsuleGeometry args={[0.62, 0.7, 8, 20]} />
          <FresnelMat color={accent} power={2.5} intensity={active ? 1.7 : 0.9} />
        </mesh>
        {/* Water-shield torus */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.95, 0.12, 12, 32]} />
          <meshStandardMaterial color="#0ea5e9" emissive="#0284c7" emissiveIntensity={0.6}
            metalness={0.2} roughness={0.1} transparent opacity={0.35} />
        </mesh>
        {active && (
          <Html position={[0, 1.2, 0]} center distanceFactor={15} pointerEvents="none">
            <div className="whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium shadow-lg"
              style={{ borderColor: `${accent}66`, background: "rgba(2,6,23,0.85)", color: accent }}>
              Pod {String(podNum).padStart(2, "0")}
            </div>
          </Html>
        )}
      </group>
    </Float>
  );
}

// ─── Ambient drifting motes ───────────────────────────────────────────────────
function Motes({ count = 220 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3 + Math.random() * 13, a = Math.random() * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 14;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  }, [count]);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.02; });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#7dd3fc" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}

// ─── Floor: radial glow disc + contact shadows ────────────────────────────────
function Floor() {
  const glow = useGlowTexture();
  return (
    <group position={[0, -6.2, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[22, 64]} />
        <meshBasicMaterial map={glow} color="#0e7490" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[15.6, 16, 96]} />
        <meshBasicMaterial color="#155e75" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <ContactShadows position={[0, 0.02, 0]} opacity={0.5} blur={2.6} scale={40} far={12} color="#000000" />
    </group>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function HabitatScene({ selectedZone, onSelectZone, cameraPreset, heatmapMode, cohesion, zones }: {
  selectedZone: string | null;
  onSelectZone: (id: string | null) => void;
  cameraPreset: string;
  heatmapMode: string | null;
  cohesion?: Record<string, { cohesion: number }>;
  zones: Record<string, any>;
}) {
  const controlsRef = useRef<any>(null);

  const somaZones = ["zone_soma_galley", "zone_soma_hearth", "zone_soma_common"];
  const axonZones = ["zone_axon_lab_a", "zone_axon_lab_b", "zone_axon_aeroponics", "zone_axon_gallery"];
  const dendriteZones = Array.from({ length: 12 }, (_, i) => `zone_dendrite_pod_${String(i + 1).padStart(2, "0")}`);

  const SOMA_Y = -3.4, SOMA_R = 6.5;
  const AXON_Y = 0.2, AXON_R = 9;
  const DEND_Y = 3.8, DEND_R = 12;

  const somaPos = (i: number): [number, number, number] => {
    const a = (i / somaZones.length) * Math.PI * 2;
    return [Math.cos(a) * SOMA_R, SOMA_Y, Math.sin(a) * SOMA_R];
  };
  const axonPos = (i: number): [number, number, number] => {
    const a = (i / axonZones.length) * Math.PI * 2 + Math.PI / 4;
    return [Math.cos(a) * AXON_R, AXON_Y, Math.sin(a) * AXON_R];
  };
  const dendPos = (i: number): [number, number, number] => {
    const a = (i / dendriteZones.length) * Math.PI * 2;
    return [Math.cos(a) * DEND_R, DEND_Y, Math.sin(a) * DEND_R];
  };

  // Camera presets
  useEffect(() => {
    const positions: Record<string, [number, number, number]> = {
      Overview: [17, 11, 17], Cutaway: [22, 3, 0], "Soma Ring": [0, -7, 15],
      "Dendrite Grid": [0, 15, 15], "Atrium Below": [0, -11, 0.1],
    };
    const targets: Record<string, [number, number, number]> = {
      Overview: [0, 0, 0], Cutaway: [0, 0, 0], "Soma Ring": [0, -3, 0],
      "Dendrite Grid": [0, 3, 0], "Atrium Below": [0, 0, 0],
    };
    const pos = positions[cameraPreset] ?? positions.Overview;
    const tgt = targets[cameraPreset] ?? [0, 0, 0];
    if (controlsRef.current) {
      controlsRef.current.object.position.set(...pos);
      controlsRef.current.target.set(...tgt);
      controlsRef.current.update();
    }
  }, [cameraPreset]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#67e8f9", "#0b1220", 0.5]} />
      <pointLight position={[0, 6, 0]} intensity={30} color="#22d3ee" distance={40} decay={1.6} />
      <directionalLight position={[10, 14, 8]} intensity={0.7} color="#e0f2fe" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="ring" intensity={2} color="#22d3ee" scale={8} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#a78bfa" scale={10} position={[-10, 2, -6]} />
        <Lightformer form="rect" intensity={1.2} color="#34d399" scale={10} position={[10, 2, 6]} />
        <Lightformer form="rect" intensity={0.8} color="#38bdf8" scale={12} position={[0, -8, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </Environment>

      {/* Deselect on empty-space click */}
      <mesh position={[0, 0, 0]} scale={60} visible={false} onClick={() => onSelectZone(null)}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>

      <CoreSpire selected={selectedZone === "zone_atrium"}
        onClick={() => onSelectZone(selectedZone === "zone_atrium" ? null : "zone_atrium")} />

      {/* Structural rings */}
      <LevelRing y={SOMA_Y} radius={SOMA_R} color={LEVEL_COLORS.SOMA} />
      <LevelRing y={AXON_Y} radius={AXON_R} color={LEVEL_COLORS.AXON} />
      <LevelRing y={DEND_Y} radius={DEND_R} color={LEVEL_COLORS.DENDRITE} />

      {/* Neural connective tubes */}
      {somaZones.map((id, i) => <NeuralTube key={id} to={somaPos(i)} color={LEVEL_COLORS.SOMA} />)}
      {axonZones.map((id, i) => <NeuralTube key={id} to={axonPos(i)} color={LEVEL_COLORS.AXON} />)}
      {dendriteZones.map((id, i) => <NeuralTube key={id} to={dendPos(i)} color={LEVEL_COLORS.DENDRITE} />)}

      {/* Soma modules */}
      {somaZones.map((id, i) => (
        <ZoneModule key={id} zoneId={id} level="SOMA" position={somaPos(i)} size={[2.4, 1.9, 2.4]}
          onClick={() => onSelectZone(selectedZone === id ? null : id)}
          selected={selectedZone === id} heatmapMode={heatmapMode} zone={zones[id]} cohesionCell={cohesion?.[id]}
          label={zones[id]?.name ?? id.replace("zone_", "").replace(/_/g, " ")} />
      ))}
      {/* Axon modules */}
      {axonZones.map((id, i) => (
        <ZoneModule key={id} zoneId={id} level="AXON" position={axonPos(i)} size={[2.1, 1.7, 2.1]}
          onClick={() => onSelectZone(selectedZone === id ? null : id)}
          selected={selectedZone === id} heatmapMode={heatmapMode} zone={zones[id]} cohesionCell={cohesion?.[id]}
          label={zones[id]?.name ?? id.replace("zone_", "").replace(/_/g, " ")} />
      ))}
      {/* Dendrite pods */}
      {dendriteZones.map((id, i) => (
        <DendritePod key={id} zoneId={id} podNum={i + 1} position={dendPos(i)}
          onClick={() => onSelectZone(selectedZone === id ? null : id)}
          selected={selectedZone === id} heatmapMode={heatmapMode} zone={zones[id]} cohesionCell={cohesion?.[id]} />
      ))}

      <Motes />
      <Floor />

      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.06} makeDefault
        autoRotate={!selectedZone} autoRotateSpeed={0.35}
        minDistance={8} maxDistance={45} enablePan={false} />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function HabitatViewer3D({ selectedZone, onSelectZone, cameraPreset, heatmapMode, cohesion }: {
  selectedZone: string | null;
  onSelectZone: (id: string | null) => void;
  cameraPreset: string;
  heatmapMode: string | null;
  cohesion?: Record<string, { cohesion: number }>;
}) {
  const { zones } = useHabitatStore();
  return (
    <div className="w-full h-full" style={{ background: "radial-gradient(ellipse at 50% 40%, #0a1424 0%, #05070f 70%)" }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [17, 11, 17], fov: 50 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}>
        <color attach="background" args={["#05070f"]} />
        <fog attach="fog" args={["#05070f", 26, 68]} />
        <Suspense fallback={null}>
          <HabitatScene selectedZone={selectedZone} onSelectZone={onSelectZone}
            cameraPreset={cameraPreset} heatmapMode={heatmapMode} cohesion={cohesion} zones={zones} />
        </Suspense>
      </Canvas>
    </div>
  );
}
