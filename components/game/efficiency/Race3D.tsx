"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { GradientTexture } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Group, PerspectiveCamera } from "three";
import { CarModel, Prop } from "./three/Models";
import type { RaceOutcome } from "./RaceTrack";

export interface Race3DProps {
  yourSpeed: number;
  paperSpeed: number;
  outcome: RaceOutcome;
  closeness: number;     // 0..1 — how near the paper's quality this build is
  qualityPct: number;
  paperQualityPct: number;
  onDone: (o: RaceOutcome) => void;
}

const DUR = 5.0;          // seconds — one run across the track, then it ends (no loop)
const TRACK_LEN = 60;     // world units from the start line to the finish
const SEG = 4;            // dash spacing
const PROP_SEG = 12;      // roadside prop spacing
const BASE_FOV = 55;
const LANE_X = 1.5;       // half the gap between the two lanes
const CAM_BACK = 9.5;     // camera distance behind your car
const CAM_UP = 3.4;

// roadside low-poly buildings — cohesive daytime palette
const BUILDING_COLORS = ["#d97757", "#5fa8a0", "#e0b35c", "#6b7fb0", "#c98a9e", "#7fa86b"];

function Building({ position, seed }: { position: [number, number, number]; seed: number }) {
  const color = BUILDING_COLORS[seed % BUILDING_COLORS.length];
  const h = 3 + ((seed * 1.7) % 4); // deterministic 3..7
  const w = 2.4, d = 2.4;
  return (
    <group position={position}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0, h + 0.12, 0]}>
        <boxGeometry args={[w + 0.2, 0.28, d + 0.2]} />
        <meshStandardMaterial color="#2e2b3a" flatShading />
      </mesh>
      {[0.35, 0.6, 0.85].map((f, i) => (
        <mesh key={i} position={[0, h * f, d / 2 + 0.01]}>
          <boxGeometry args={[w * 0.7, 0.32, 0.05]} />
          <meshStandardMaterial color="#fdf6e3" emissive="#cfe6fb" emissiveIntensity={0.25} flatShading />
        </mesh>
      ))}
    </group>
  );
}

// chase-cam logic — UNCHANGED. How far YOU have travelled at race fraction t.
function cutFor(o: RaceOutcome, closeness: number): number {
  return o === "memwall" ? 0 : o === "breakdown" ? 0.26 : o === "unreliable" ? 0.42 + 0.5 * closeness : 1;
}
function yourTravel(t: number, o: RaceOutcome, speed: number, closeness: number): number {
  return speed * Math.min(t, cutFor(o, closeness));
}

function Scene({ p, onDone }: { p: Race3DProps; onDone: (o: RaceOutcome) => void }) {
  const you = useRef<Group>(null);
  const ghost = useRef<Group>(null);
  const smoke = useRef<Group>(null);
  const elapsed = useRef(0);
  const done = useRef(false);
  const stalled = p.outcome === "breakdown" || p.outcome === "memwall";
  const cutT = cutFor(p.outcome, p.closeness);

  const dashMarks = useMemo(() => {
    const arr: { z: number; side?: number }[] = [];
    for (let z = 6; z > -72; z -= SEG) { arr.push({ z }); arr.push({ z, side: -3.15 }); arr.push({ z, side: 3.15 }); }
    return arr;
  }, []);
  const propRows = useMemo(() => {
    const arr: { z: number; left: boolean }[] = [];
    let i = 0;
    for (let z = 6; z > -72; z -= PROP_SEG) arr.push({ z, left: i++ % 2 === 0 });
    return arr;
  }, []);

  useFrame((state, delta) => {
    if (done.current) return;
    elapsed.current += Math.min(delta, 0.05);
    const t = Math.min(1, elapsed.current / DUR);

    const yt = yourTravel(t, p.outcome, p.yourSpeed, p.closeness);
    const gt = p.paperSpeed * t;
    const moving = t < cutT;
    const spd = moving ? p.yourSpeed : 0;

    // One run across the track: both cars drive forward (-z) toward the finish line at
    // -TRACK_LEN. The test car reaches it at t=1; you finish level only if you keep pace.
    const yourZ = -TRACK_LEN * (yt / p.paperSpeed);
    const testZ = -TRACK_LEN * (gt / p.paperSpeed);
    if (you.current) {
      you.current.position.z = yourZ;
      you.current.position.y = moving ? Math.sin(state.clock.elapsedTime * 22) * 0.012 : 0;
      you.current.rotation.z = stalled && !moving ? -0.07 : 0;
    }
    if (ghost.current) {
      ghost.current.position.z = testZ;
      ghost.current.position.y = Math.sin(state.clock.elapsedTime * 22 + 1) * 0.012;
    }

    // camera chases your car — centered between lanes, minimal motion, no shake loop
    const cam = state.camera as PerspectiveCamera;
    const bob = moving ? Math.sin(state.clock.elapsedTime * 6) * 0.015 : 0;
    cam.position.set(0, CAM_UP + bob, yourZ + CAM_BACK);
    const targetFov = BASE_FOV + Math.min(4, spd * 0.6);
    cam.fov += (targetFov - cam.fov) * 0.08;
    cam.updateProjectionMatrix();
    cam.lookAt(0, 0.6, yourZ - 12);

    if (smoke.current) {
      const on = stalled && !moving;
      smoke.current.visible = on;
      if (on) smoke.current.children.forEach((m, i) => {
        const ph = (state.clock.elapsedTime * 1.4 + i * 0.5) % 1.5;
        m.position.y = 0.6 + ph * 0.8;
        m.position.z = 2.0 + ph * 0.4;
        m.scale.setScalar(0.25 + ph * 0.6);
        const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (mat) mat.opacity = Math.max(0, 0.5 - ph * 0.33);
      });
    }

    if (t >= 1 && !done.current) { done.current = true; onDone(p.outcome); }
  });

  return (
    <>
      {/* bright daytime low-poly lighting */}
      <hemisphereLight args={["#cfe6fb", "#6b6658", 0.95]} />
      <directionalLight position={[8, 14, 5]} intensity={1.7} color="#fff4e0" />
      <ambientLight intensity={0.5} />
      <fog attach="fog" args={["#bcd9f5", 30, 95]} />

      {/* blue daytime gradient sky (lighter near the horizon) */}
      <mesh position={[0, 9, -73]}>
        <planeGeometry args={[300, 110]} />
        <meshBasicMaterial fog={false}>
          <GradientTexture stops={[0, 0.55, 1]} colors={["#1a5fc0", "#5a9bd8", "#cfe6fb"]} />
        </meshBasicMaterial>
      </mesh>

      {/* ground both sides + near-black asphalt road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -24]}>
        <planeGeometry args={[120, 170]} />
        <meshStandardMaterial color="#3f4a39" flatShading />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -24]}>
        <planeGeometry args={[6.6, 170]} />
        <meshStandardMaterial color="#0a0a0c" flatShading />
      </mesh>
      {/* solid side lane lines */}
      {[-3.0, 3.0].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, -24]}>
          <planeGeometry args={[0.16, 170]} />
          <meshStandardMaterial color="#e8c349" flatShading />
        </mesh>
      ))}

      {/* static center dashes + posts along the track */}
      <group>
        {dashMarks.map((m, i) =>
          m.side === undefined ? (
            <mesh key={i} position={[0, 0.04, m.z]}>
              <boxGeometry args={[0.16, 0.02, 1.6]} />
              <meshStandardMaterial color="#f0f0f0" flatShading />
            </mesh>
          ) : (
            <mesh key={i} position={[m.side, 0.4, m.z]}>
              <boxGeometry args={[0.16, 0.8, 0.16]} />
              <meshStandardMaterial color={i % 2 ? "#f87171" : "#e5e7eb"} flatShading />
            </mesh>
          )
        )}
      </group>

      {/* finish line */}
      <group position={[0, 0.05, -TRACK_LEN]}>
        {Array.from({ length: 13 }).flatMap((_, i) => [0, 1].map((r) => (
          <mesh key={`f${i}-${r}`} position={[-3 + i * 0.5, 0, -0.3 + r * 0.6]}>
            <boxGeometry args={[0.5, 0.02, 0.6]} />
            <meshStandardMaterial color={(i + r) % 2 ? "#0a0a0c" : "#f0f0f0"} flatShading />
          </mesh>
        )))}
        {[-3.3, 3.3].map((x) => (
          <mesh key={x} position={[x, 1.4, 0]}>
            <boxGeometry args={[0.2, 2.8, 0.2]} />
            <meshStandardMaterial color="#e5e7eb" flatShading />
          </mesh>
        ))}
        <mesh position={[0, 2.9, 0]}>
          <boxGeometry args={[6.9, 0.5, 0.18]} />
          <meshStandardMaterial color="#7c5cff" flatShading />
        </mesh>
      </group>

      {/* static roadside dressing: CC0 trees one side, colored low-poly buildings the other */}
      <group>
        {propRows.map((r, i) => (
          <group key={i}>
            <Prop url="/models/decoration-forest.glb" position={[r.left ? -7.5 : 7.5, 0, r.z]} scale={0.32} />
            <Building position={[r.left ? 10.5 : -10.5, 0, r.z - PROP_SEG / 2]} seed={i} />
          </group>
        ))}
      </group>

      {/* your car — left lane */}
      <group ref={you} position={[-LANE_X, 0, 0]}>
        <CarModel color="#7c5cff" />
        <group ref={smoke} visible={false}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[0, 0.6, 2.0]}>
              <icosahedronGeometry args={[0.4, 0]} />
              <meshStandardMaterial color="#9ca3af" transparent opacity={0.4} flatShading />
            </mesh>
          ))}
        </group>
      </group>

      {/* test car (paper) — right lane, starts level */}
      <group ref={ghost} position={[LANE_X, 0, 0]}>
        <CarModel color="#f5b500" opacity={0.5} />
      </group>
    </>
  );
}

export default function Race3D(props: Race3DProps) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-edge" style={{ height: 360 }}>
      <Canvas camera={{ position: [0, 3.4, 9.5], fov: BASE_FOV }} dpr={[1, 2]}>
        <color attach="background" args={["#bcd9f5"]} />
        <Suspense fallback={null}>
          <Scene p={props} onDone={props.onDone} />
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 text-xs">
        <div className="rounded-lg bg-ink/70 border border-accent/40 px-2.5 py-1.5">
          <div className="text-[#7c5cff] font-semibold">YOU</div>
          <div className="text-gray-200 font-mono">{props.yourSpeed.toFixed(1)}x @ {props.qualityPct}%</div>
        </div>
        <div className="rounded-lg bg-ink/70 border border-[#f5b500]/40 px-2.5 py-1.5 text-right">
          <div className="text-[#f5b500] font-semibold">TEST CAR</div>
          <div className="text-gray-200 font-mono">{props.paperSpeed.toFixed(1)}x @ {props.paperQualityPct}%</div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2 text-center text-[11px] text-gray-300">
        two lanes · draw level or pull ahead of the test car to win — fall back or sputter and you lose
      </div>
    </div>
  );
}
