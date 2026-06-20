"use client";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, ContactShadows } from "@react-three/drei";
import { Suspense } from "react";
import { CarModel } from "./three/Models";

export type PartId = "engine" | "tires" | "trunk" | "cooling";

export interface GarageCar3DProps {
  selected: PartId | null;
  onSelect: (p: PartId) => void;
  best: Record<PartId, boolean>; // is the player's current choice the opponent's best?
  carColor?: string;
}

const HOTSPOTS: { id: PartId; label: string; icon: string; pos: [number, number, number] }[] = [
  { id: "engine", label: "Engine", icon: "🔩", pos: [0, 1.5, -2.1] },
  { id: "tires", label: "Tires", icon: "🛞", pos: [1.3, 0.6, -1.3] },
  { id: "trunk", label: "Trunk", icon: "🧳", pos: [0, 1.5, 2.1] },
  { id: "cooling", label: "Cooling", icon: "❄️", pos: [-1.35, 0.95, 0.5] },
];

function Marker({ h, selected, best, onSelect }: {
  h: (typeof HOTSPOTS)[number]; selected: boolean; best: boolean; onSelect: (p: PartId) => void;
}) {
  return (
    <Html position={h.pos} center distanceFactor={3.25} zIndexRange={[20, 0]}>
      <button
        onClick={(e) => { e.stopPropagation(); onSelect(h.id); }}
        className={"flex items-center gap-0.5 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-semibold shadow-md transition " +
          (selected ? "border-accent2 bg-accent2 text-ink" : "border-edge bg-ink/85 text-gray-200 hover:border-accent2")}
      >
        <span>{h.icon}</span>
        <span>{h.label}</span>
        <span className={best ? "text-[#f5b500]" : "text-gray-500"}>{best ? "★" : "•"}</span>
      </button>
    </Html>
  );
}

function Scene(p: GarageCar3DProps) {
  return (
    <>
      <hemisphereLight args={["#cfe6fb", "#5b5750", 0.9]} />
      <directionalLight position={[5, 9, 4]} intensity={1.5} color="#fff4e0" />
      <ambientLight intensity={0.45} />

      {/* soft grounding shadow only — no turntable disc (that read as a black ring) */}
      <ContactShadows position={[0, 0, 0]} opacity={0.32} scale={11} blur={3} far={4} />

      <CarModel color={p.carColor ?? "#7c5cff"} scale={1.4} />

      {HOTSPOTS.map((h) => (
        <Marker key={h.id} h={h} selected={p.selected === h.id} best={p.best[h.id]} onSelect={p.onSelect} />
      ))}

      <OrbitControls target={[0, 0.8, 0]} enablePan={false} enableZoom={false}
        minPolarAngle={0.7} maxPolarAngle={1.45} autoRotate autoRotateSpeed={0.5} />
    </>
  );
}

export default function GarageCar3D(props: GarageCar3DProps) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-edge bg-gradient-to-b from-[#1a2740] to-[#0c0f1a]" style={{ height: 340 }}>
      <Canvas camera={{ position: [4.8, 3.0, 5.8], fov: 42 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <Scene {...props} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2 text-center text-[11px] text-gray-400">
        click a part to swap its tech · ★ = the test car's choice · drag to rotate
      </div>
    </div>
  );
}
