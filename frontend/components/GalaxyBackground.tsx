"use client";

/*
  SYNAPSE-1 Surreal Galaxy Background
  ------------------------------------
  Shader-driven spiral galaxy: differential rotation (inner stars overtake
  outer), iridescent palette drift, per-star twinkle, additive nebula sprites,
  a dream camera, and occasional shooting stars. Deep-ocean/cyan palette to
  match the Neuro-Core OS. Sits behind content at z-index 0.

  Respects prefers-reduced-motion (renders one static frame).
*/

import { useRef, useEffect } from "react";
import * as THREE from "three";

function makeGlowTexture(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function makeStreakTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 16;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.8, "rgba(150,220,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,1)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 16);
  return new THREE.CanvasTexture(c);
}

const GALAXY_VERT = `
uniform float uTime;
uniform float uSpin;
uniform float uSize;
attribute float aScale;
attribute float aRandom;
attribute vec3 aColorA;
attribute vec3 aColorB;
varying vec3 vColorA;
varying vec3 vColorB;
varying float vRandom;
void main() {
  vec3 p = position;
  float r = length(p.xz);
  float angle = atan(p.z, p.x);
  angle += uTime * uSpin * (1.0 / (r * 0.45 + 0.6));
  p.x = cos(angle) * r;
  p.z = sin(angle) * r;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * aScale * (14.0 / -mv.z);
  vColorA = aColorA; vColorB = aColorB; vRandom = aRandom;
}`;

const GALAXY_FRAG = `
uniform float uTime;
uniform float uMix;
varying vec3 vColorA;
varying vec3 vColorB;
varying float vRandom;
void main() {
  float d = distance(gl_PointCoord, vec2(0.5));
  float glow = pow(1.0 - smoothstep(0.0, 0.5, d), 2.2);
  float twinkle = 0.65 + 0.35 * sin(uTime * (1.2 + vRandom * 3.5) + vRandom * 40.0);
  vec3 col = mix(vColorA, vColorB, uMix);
  gl_FragColor = vec4(col, glow * twinkle);
}`;

export default function GalaxyBackground({
  count = 13000,
  bgStars = 2200,
  opacity = 0.7,
  energyRef,
}: {
  count?: number;
  bgStars?: number;
  opacity?: number;
  energyRef?: { current: boolean };
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 300);
    camera.position.set(0, 3.4, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const disposables: Array<{ dispose?: () => void }> = [];
    const glowTex = makeGlowTexture(); disposables.push(glowTex);

    // ---- galaxy points ----
    const COUNT = count;
    const pos = new Float32Array(COUNT * 3);
    const colA = new Float32Array(COUNT * 3);
    const colB = new Float32Array(COUNT * 3);
    const scl = new Float32Array(COUNT);
    const rnd = new Float32Array(COUNT);
    const branches = 4, radius = 7, randomness = 0.5;
    // Deep-ocean nebula palette: teal->blue arms, drifting toward mint->violet
    const aIn = new THREE.Color("#7AF0FF"), aOut = new THREE.Color("#2E5BFF");
    const bIn = new THREE.Color("#B8FFE3"), bOut = new THREE.Color("#7A5CFF");

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      const r = Math.pow(Math.random(), 1.6) * radius;
      const branch = ((i % branches) / branches) * Math.PI * 2;
      const spinAngle = r * 1.1;
      const rx = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * randomness * r;
      const ry = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * randomness * r * 0.3;
      const rz = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * randomness * r;
      pos[i3] = Math.cos(branch + spinAngle) * r + rx;
      pos[i3 + 1] = ry;
      pos[i3 + 2] = Math.sin(branch + spinAngle) * r + rz;
      const t = r / radius;
      const ca = aIn.clone().lerp(aOut, t);
      const cb = bIn.clone().lerp(bOut, t);
      colA[i3] = ca.r; colA[i3 + 1] = ca.g; colA[i3 + 2] = ca.b;
      colB[i3] = cb.r; colB[i3 + 1] = cb.g; colB[i3 + 2] = cb.b;
      scl[i] = Math.random() < 0.02 ? 2.2 + Math.random() * 1.5 : 0.4 + Math.random();
      rnd[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColorA", new THREE.BufferAttribute(colA, 3));
    geo.setAttribute("aColorB", new THREE.BufferAttribute(colB, 3));
    geo.setAttribute("aScale", new THREE.BufferAttribute(scl, 1));
    geo.setAttribute("aRandom", new THREE.BufferAttribute(rnd, 1));
    const uniforms = {
      uTime: { value: 0 },
      uSpin: { value: 0.14 },
      uMix: { value: 0 },
      uSize: { value: 3.0 * renderer.getPixelRatio() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms, vertexShader: GALAXY_VERT, fragmentShader: GALAXY_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const galaxy = new THREE.Points(geo, mat);
    galaxy.rotation.x = 0.35;
    scene.add(galaxy);
    disposables.push(geo, mat);

    // ---- core glow + nebula clouds ----
    const nebulaGroup = new THREE.Group();
    nebulaGroup.rotation.x = 0.35;
    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0x9ad8ff, transparent: true, opacity: 0.45,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    core.scale.setScalar(5);
    nebulaGroup.add(core);
    disposables.push(core.material);

    const NEBULA_COLORS = [0x2e5bff, 0x1fb8c9, 0x7a5cff, 0x3a2a8f, 0x4aa8ff];
    const clouds: Array<{ s: THREE.Sprite; spin: number; bob: number }> = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.SpriteMaterial({
        map: glowTex, color: NEBULA_COLORS[i % NEBULA_COLORS.length],
        transparent: true, opacity: 0.09 + Math.random() * 0.07,
        depthWrite: false, blending: THREE.AdditiveBlending,
        rotation: Math.random() * Math.PI,
      });
      const s = new THREE.Sprite(m);
      const ang = Math.random() * Math.PI * 2;
      const rr = 1.5 + Math.random() * 4.5;
      s.position.set(Math.cos(ang) * rr, (Math.random() - 0.5) * 1.6, Math.sin(ang) * rr);
      s.scale.setScalar(5 + Math.random() * 7);
      clouds.push({ s, spin: (Math.random() - 0.5) * 0.05, bob: Math.random() * Math.PI * 2 });
      nebulaGroup.add(s);
      disposables.push(m);
    }
    scene.add(nebulaGroup);

    // ---- distant starfield ----
    const S = bgStars;
    const sp = new Float32Array(S * 3);
    for (let i = 0; i < S; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const rr = 45 + Math.random() * 70;
      sp[i * 3] = rr * Math.sin(ph) * Math.cos(th);
      sp[i * 3 + 1] = rr * Math.cos(ph);
      sp[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const sMat = new THREE.PointsMaterial({
      size: 0.1, color: 0xdfefff, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(sGeo, sMat);
    scene.add(stars);
    disposables.push(sGeo, sMat);

    // ---- shooting stars ----
    const streakTex = makeStreakTexture(); disposables.push(streakTex);
    const streaks: Array<{ mesh: THREE.Mesh; life: number; vel: THREE.Vector3; next: number }> = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.MeshBasicMaterial({
        map: streakTex, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.035), m);
      mesh.visible = false;
      scene.add(mesh);
      streaks.push({ mesh, life: 0, vel: new THREE.Vector3(), next: 2 + i * 4 + Math.random() * 4 });
      disposables.push(m, mesh.geometry);
    }
    const fireStreak = (st: typeof streaks[number]) => {
      const y = 2 + Math.random() * 6;
      st.mesh.position.set(-14 + Math.random() * 6, y, -6 - Math.random() * 10);
      st.vel.set(14 + Math.random() * 8, -(2 + Math.random() * 4), 0);
      st.mesh.rotation.z = Math.atan2(st.vel.y, st.vel.x);
      st.mesh.visible = true;
      st.life = 1;
    };

    // ---- interaction + loop ----
    const mouse = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", onResize);

    let raf = 0, spin = 0.14;
    const clock = new THREE.Clock();

    const tick = () => {
      const t = clock.getElapsedTime();
      const energized = !!(energyRef && energyRef.current);

      spin += ((energized ? 1.2 : 0.14) - spin) * 0.025;
      uniforms.uTime.value = t;
      uniforms.uSpin.value = spin;
      uniforms.uMix.value = 0.5 + 0.5 * Math.sin(t * 0.07);

      nebulaGroup.rotation.y += 0.0004 + spin * 0.001;
      clouds.forEach((c) => {
        c.s.material.rotation += c.spin * 0.016;
        c.s.position.y += Math.sin(t * 0.3 + c.bob) * 0.0009;
      });
      stars.rotation.y -= 0.00012;

      streaks.forEach((st) => {
        if (st.life > 0) {
          st.life -= 0.016 / 1.1;
          st.mesh.position.addScaledVector(st.vel, 0.016);
          (st.mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.max(st.life, 0) * Math.PI) * 0.9;
          if (st.life <= 0) { st.mesh.visible = false; st.next = t + 4 + Math.random() * 8; }
        } else if (t > st.next) fireStreak(st);
      });

      const breathe = Math.sin(t * 0.12) * 0.5;
      camera.position.x += (mouse.x * 1.2 - camera.position.x) * 0.03;
      camera.position.y += (3.4 - mouse.y * 1.0 - camera.position.y) * 0.03;
      camera.position.z = (energized ? 6.8 : 9) + breathe;
      camera.lookAt(0, 0, 0);
      camera.rotation.z += Math.sin(t * 0.05) * 0.02;

      renderer.render(scene, camera);
      if (!reduced) raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      disposables.forEach((d) => d.dispose && d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [count, bgStars, energyRef]);

  return <div ref={mountRef} style={{ position: "fixed", inset: 0, zIndex: 0, opacity, pointerEvents: "none" }} />;
}
