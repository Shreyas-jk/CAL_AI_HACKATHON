"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, ContactShadows } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Group } from "three";
import type { RouterAction } from "@/lib/games/rag/types";
import { useRealtimeGame, LAT, CAP, type Packet, type World } from "@/lib/games/rag/useRealtimeGame";
import { KModel, KENNEY } from "./three/KModel";

// One connected line: FEED belt (-X) → JUNCTION (arm at origin) → branches.
// INTERNAL runs straight through (+X). HYBRID peels straight UP (+Z) then turns 90° to
// its bin; WEB peels straight DOWN (-Z) then turns 90° to its bin. Branch length ∝ latency.
// Render only — game logic untouched.
const BELT_Y = 0.4;
const FRONT_X = -1.4;     // feed queue front (next to junction)
const QSTEP = 1.7;        // queued-box spacing (back-up grows -X = congestion)
const BOX_TINT = "#e6b77c";
const FLOOR = "#d3ccbd";
const FEED_TINT = "#9a9aa2";

interface Cell { pos: [number, number, number]; rotY: number; }
interface Branch {
  action: RouterAction; label: string; color: string; beltColor: string; binColor: string;
  cells: Cell[]; bin: [number, number, number]; sign: [number, number, number];
  initDeg: number;                 // arm swing direction: 0 straight, +90 up, -90 down
  path: (p: number) => [number, number, number]; // glide position along the L-path
}

// INTERNAL — straight +X
const internal: Branch = {
  action: "refine", label: "INTERNAL", color: "#34d399", beltColor: "#74c9a0", binColor: "#2fe09b",
  cells: [{ pos: [2.3, 0, 0], rotY: 0 }, { pos: [4.3, 0, 0], rotY: 0 }],
  bin: [6.3, 0, 0], sign: [3.3, 1.7, 0], initDeg: 0,
  path: (p) => [0.6 + p * 5.7, BELT_Y, 0],
};
// HYBRID — up (+Z) for `vlen`, then 90° turn (+X) to bin
function upDownBranch(action: RouterAction, label: string, color: string, beltColor: string, binColor: string, zdir: 1 | -1, vlen: number, hlen: number): Branch {
  const cells: Cell[] = [];
  for (let i = 0; i < vlen; i++) cells.push({ pos: [0, 0, zdir * (1.7 + i * 2)], rotY: Math.PI / 2 });
  const cz = zdir * (1.7 + (vlen - 1) * 2);            // corner z (last vertical piece)
  for (let j = 0; j < hlen; j++) cells.push({ pos: [1.7 + j * 2, 0, cz], rotY: 0 });
  const bin: [number, number, number] = [1.7 + hlen * 2, 0, cz];
  const Lv = Math.abs(cz), Lh = 1.7 + hlen * 2;
  return {
    action, label, color, beltColor, binColor, cells, bin,
    sign: [0, 1.7, zdir * (0.8 + (vlen - 1))], initDeg: zdir * 90,
    path: (p) => { const d = p * (Lv + Lh); return d <= Lv ? [0, BELT_Y, zdir * d] : [Math.min(d - Lv, Lh), BELT_Y, cz]; },
  };
}
const BRANCHES: Branch[] = [
  internal,
  upDownBranch("hybrid", "HYBRID", "#f5b500", "#e0bb63", "#ffc62e", 1, LAT.hybrid - 1, 1),
  upDownBranch("web", "WEB", "#f87171", "#e09090", "#ff7a7a", -1, LAT.web - 2, 2),
];
const rad = (d: number) => (d * Math.PI) / 180;

export default function FactoryLine(props: {
  grid: Parameters<typeof useRealtimeGame>[0]["grid"]; schedule: Parameters<typeof useRealtimeGame>[0]["schedule"];
  auto: boolean; winBar: number; onPeek: (q: string) => void; onEnd: (r: { status: "won" | "lost"; accuracy: number; breaches: number; timeouts: number }) => void;
}) {
  const { world, doRoute, selectPkt } = useRealtimeGame(props);
  const acc = world.total ? Math.round((100 * world.correct) / world.total) : 100;
  const congestion = world.queue.length / CAP;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-edge" style={{ height: 470, background: "linear-gradient(#1b2030,#11141c)" }}>
      <style>{"@keyframes pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}"}</style>
      <Canvas camera={{ position: [1, 21, 12], fov: 27, near: 1, far: 200 }} dpr={[1, 2]}>
        <color attach="background" args={["#1a1f2b"]} />
        <Suspense fallback={null}>
          <Scene world={world} doRoute={doRoute} selectPkt={selectPkt} auto={props.auto} />
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-3 gap-2 p-2 text-xs">
        <HudMeter label="QC Integrity" value={`${Math.round(world.integrity)}`} sub="0 = line down" fill={world.integrity / 100} tint={world.integrity <= 30 ? "#f87171" : "#34d399"} />
        <HudMeter label="QC Accuracy" value={`${acc}%`} sub={`${world.correct}/${world.total} · bar ${Math.round(props.winBar * 100)}%`} fill={acc / 100} tint={acc >= props.winBar * 100 ? "#34d399" : "#f5b500"} />
        <HudMeter label="Belt load" value={`${world.queue.length}/${CAP}`} sub={`${world.timeouts} dropped`} fill={congestion} tint={congestion > 0.8 ? "#f87171" : "#22d3ee"} />
      </div>
      {!props.auto && <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2 text-center text-[11px] text-gray-400">click a chute sign to divert the front package · click a package to scan it · slow lanes take longer</div>}
    </div>
  );
}

function CamRig() {
  const { camera } = useThree();
  useEffect(() => { camera.lookAt(1, 0.3, -0.8); }, [camera]);
  return null;
}

function Scene({ world, doRoute, selectPkt, auto }: { world: World; doRoute: (a: RouterAction) => void; selectPkt: (p: Packet) => void; auto: boolean; }) {
  return (
    <>
      <CamRig />
      <hemisphereLight args={["#fff6e8", "#cdbfa6", 1.05]} />
      <directionalLight position={[8, 28, 12]} intensity={2.4} color="#fff3d6" />
      <ambientLight intensity={0.65} color="#fff7ee" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1, 0, -0.5]}>
        <planeGeometry args={[46, 30]} />
        <meshStandardMaterial color={FLOOR} flatShading />
      </mesh>
      <ContactShadows position={[1, 0.02, -0.5]} scale={44} blur={3} far={16} opacity={0.42} color="#5b513f" resolution={1024} />

      {/* FEED belt into the junction */}
      {[-1, -3, -5, -7, -9].map((x) => <KModel key={x} url={KENNEY.conveyor} position={[x, 0, 0]} flatColor={FEED_TINT} />)}

      {/* branches: belts (with corners), bins, signs, stamps */}
      {BRANCHES.map((b) => (
        <group key={b.action}>
          {b.cells.map((c, i) => <KModel key={i} url={KENNEY.conveyor} position={c.pos} rotation={[0, c.rotY, 0]} flatColor={b.beltColor} />)}
          <KModel url={KENNEY.bin} position={b.bin} flatColor={b.binColor} />
          <ChuteSign b={b} busy={!!world.lanes[b.action].busy} clickable={!auto} onRoute={() => doRoute(b.action)} />
          <BinStamp b={b} last={world.lanes[b.action].busy ? null : world.lanes[b.action].last} />
        </group>
      ))}

      <Arm world={world} />
      <Packages world={world} selectPkt={selectPkt} auto={auto} />
    </>
  );
}

function Arm({ world }: { world: World }) {
  const ref = useRef<Group>(null);
  const targetDeg = useMemo(() => {
    let best: Branch | null = null, t = -1;
    for (const b of BRANCHES) { const ln = world.lanes[b.action]; if (ln.busy && ln.start > t) { t = ln.start; best = b; } }
    return best ? best.initDeg : 0;
  }, [world]);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += (Math.PI - rad(targetDeg) - ref.current.rotation.y) * Math.min(1, dt * 5); });
  return <group ref={ref} position={[0.2, BELT_Y, 0]} rotation={[0, Math.PI, 0]}><KModel url={KENNEY.arm} scale={1.15} tint="#aab0ba" /></group>;
}

function Packages({ world, selectPkt, auto }: { world: World; selectPkt: (p: Packet) => void; auto: boolean; }) {
  const frontUid = world.selectedUid ?? world.queue[0]?.uid ?? null;
  const items = useMemo(() => {
    const arr: { uid: number; pkt: Packet; target: [number, number, number]; sel: boolean; queued: boolean }[] = [];
    world.queue.forEach((p, i) => arr.push({ uid: p.uid, pkt: p, target: [FRONT_X - i * QSTEP, BELT_Y, 0], sel: p.uid === frontUid, queued: true }));
    for (const b of BRANCHES) { const ln = world.lanes[b.action]; if (ln.busy) { const p = Math.min(1, (world.tick - ln.start) / ln.latency); arr.push({ uid: ln.busy.uid, pkt: ln.busy, target: b.path(p), sel: false, queued: false }); } }
    return arr;
  }, [world, frontUid]);

  const refs = useRef(new Map<number, Group>());
  const inited = useRef(new Set<number>());
  const tmp = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    for (const it of items) {
      const g = refs.current.get(it.uid); if (!g) continue;
      if (!inited.current.has(it.uid)) { g.position.set(...it.target); inited.current.add(it.uid); }
      else g.position.lerp(tmp.current.set(...it.target), Math.min(1, dt * 7));
    }
  });

  return (
    <>
      {items.map((it) => (
        <group key={it.uid} ref={(el) => { if (el) refs.current.set(it.uid, el); else { refs.current.delete(it.uid); inited.current.delete(it.uid); } }}
          onClick={it.queued && !auto ? (e) => { e.stopPropagation(); selectPkt(it.pkt); } : undefined}>
          <KModel url={KENNEY.box} flatColor={BOX_TINT} />
          {it.sel && <mesh position={[0, 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.5, 0.62, 20]} /><meshBasicMaterial color="#22d3ee" /></mesh>}
          <Html position={[0, 0.95, 0]} center distanceFactor={13} zIndexRange={[18, 0]}>
            <div className={"flex items-center gap-1 rounded border px-1 py-0.5 text-[9px] " + (it.sel ? "border-accent2 bg-accent2/20 text-accent2" : "border-edge bg-ink/85 text-gray-200")}>
              <span>{it.pkt.query_id}</span><BarCue bars={it.pkt.bars} />
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}

function ChuteSign({ b, busy, clickable, onRoute }: { b: Branch; busy: boolean; clickable: boolean; onRoute: () => void; }) {
  return (
    <Html position={b.sign} center distanceFactor={15} zIndexRange={[20, 0]}>
      <button onClick={clickable ? onRoute : undefined}
        className={"whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-semibold shadow-md " + (clickable && !busy ? "cursor-pointer hover:brightness-125" : "opacity-70 cursor-default")}
        style={{ borderColor: b.color, color: b.color, background: "#0a0c12cc" }}>
        {b.label} · {LAT[b.action]}t{busy ? " · busy" : ""}
      </button>
    </Html>
  );
}

function BinStamp({ b, last }: { b: Branch; last: { ok: boolean; q: string } | null; }) {
  if (!last) return null;
  return (
    <Html position={[b.bin[0], 2.1, b.bin[2]]} center distanceFactor={15}>
      <div className={"animate-[pop_.25s_ease-out] rounded px-1.5 py-0.5 text-[11px] font-bold " + (last.ok ? "bg-green-500/95 text-black" : "bg-red-500/95 text-black")}>
        {last.ok ? "✓ APPROVED" : "✗ REJECTED"} {last.q}
      </div>
    </Html>
  );
}

function BarCue({ bars }: { bars: number }) {
  const c = bars === 1 ? "#f87171" : bars === 2 ? "#f5b500" : "#34d399";
  return <span className="inline-flex items-end gap-px">{[1, 2, 3].map((x) => <i key={x} style={{ width: 2, height: 2 + x * 2, background: x <= bars ? c : "#2a2b3a", display: "inline-block" }} />)}</span>;
}

function HudMeter({ label, value, sub, fill, tint }: { label: string; value: string; sub: string; fill: number; tint: string; }) {
  return (
    <div className="rounded-lg border border-edge bg-ink/80 px-2.5 py-1.5 backdrop-blur">
      <div className="text-[9px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="font-mono text-base font-bold" style={{ color: tint }}>{value} <span className="text-[9px] font-normal text-gray-500">{sub}</span></div>
      <div className="mt-1 h-1.5 rounded bg-ink border border-edge overflow-hidden"><div className="h-full" style={{ width: `${Math.max(0, Math.min(100, fill * 100))}%`, background: tint }} /></div>
    </div>
  );
}
