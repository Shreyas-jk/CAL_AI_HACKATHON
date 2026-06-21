"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, Text } from "@react-three/drei";
import { EffectComposer, ChromaticAberration } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { VisionCase, VisionRun, VisionSettings } from "@/lib/games/visionDetective/types";

interface VisionSceneProps {
  visionCase: VisionCase;
  run: VisionRun;
  settings: VisionSettings;
  submitted: boolean;
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float beam = smoothstep(0.09, 0.0, abs(vUv.x - fract(uTime * 0.28)));
    float grid = step(0.985, sin(vUv.y * 90.0) * 0.5 + 0.5);
    float alpha = beam * 0.55 + grid * 0.12;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export default function VisionScene(props: VisionSceneProps) {
  const showGlitch = !props.run.solved && props.submitted;
  return (
    <Canvas
      camera={{ position: [0, 3.3, 7.2], fov: 44 }}
      dpr={[1, 1.25]}
      frameloop="demand"
      gl={{ antialias: true, powerPreference: "low-power" }}
    >
      <color attach="background" args={["#060713"]} />
      <fog attach="fog" args={["#060713", 7, 13]} />
      <ambientLight intensity={0.42} />
      <directionalLight position={[3, 5, 4]} intensity={1.15} />
      <pointLight position={[-3, 2.5, 2]} color="#22d3ee" intensity={1.45} />
      <pointLight position={[3, 1.8, 1]} color="#34d399" intensity={props.run.solved ? 1 : 0.28} />
      <EvidenceRoom {...props} />
      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={0.85} maxPolarAngle={1.35} />
      {showGlitch && (
        <EffectComposer>
          <ChromaticAberration offset={new THREE.Vector2(0.004, 0.003)} radialModulation={false} modulationOffset={0} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

function EvidenceRoom({ visionCase, run, settings, submitted }: VisionSceneProps) {
  const evidenceSet = useMemo(() => new Set(run.unlockedEvidenceIds), [run.unlockedEvidenceIds]);
  const isGlitching = submitted && !run.solved;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
        <planeGeometry args={[9, 8]} />
        <meshStandardMaterial color="#0d1022" roughness={0.85} metalness={0.15} />
      </mesh>
      <mesh position={[0, -1.05, 0]} scale={[4.5, 0.12, 2.3]}>
        <boxGeometry />
        <meshStandardMaterial color="#171a2c" roughness={0.55} metalness={0.25} />
      </mesh>
      <CasePanel visionCase={visionCase} evidenceSet={evidenceSet} settings={settings} isGlitching={isGlitching} />
      <EvidencePins visionCase={visionCase} evidenceSet={evidenceSet} />
      {settings.regionGrounding && <ScanBeam solved={run.solved} />}
      {visionCase.id === "ocr" && settings.ocr && <OcrReveal />}
      <Text position={[0, 1.92, -0.08]} fontSize={0.16} color="#22d3ee" anchorX="center" anchorY="middle">
        {visionCase.title.toUpperCase()}
      </Text>
      <Html position={[0, -0.78, 1.35]} center transform distanceFactor={6}>
        <div className="rounded border border-accent2/40 bg-black/70 px-3 py-1.5 text-center text-[10px] uppercase tracking-wide text-accent2">
          {submitted ? run.verdict.replace("-", " ") : "interrogate the evidence"}
        </div>
      </Html>
    </group>
  );
}

function CasePanel({
  visionCase,
  evidenceSet,
  settings,
  isGlitching,
}: {
  visionCase: VisionCase;
  evidenceSet: Set<string>;
  settings: VisionSettings;
  isGlitching: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.x = isGlitching ? Math.sin(clock.elapsedTime * 38) * 0.025 : 0;
  });
  return (
    <group ref={ref} position={[0, 0.45, 0]} rotation={[-0.08, 0, 0]}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[3.8, 2.5, 0.08]} />
        <meshStandardMaterial color="#111827" roughness={0.55} metalness={0.1} emissive="#050816" />
      </mesh>
      <SceneIllustration scene={visionCase.scene} />
      {visionCase.evidence.map((box) => (
        <EvidenceBox3D key={box.id} box={box} active={evidenceSet.has(box.id)} grounded={settings.regionGrounding} />
      ))}
    </group>
  );
}

function SceneIllustration({ scene }: { scene: VisionCase["scene"] }) {
  if (scene === "doorway") {
    return (
      <group>
        <mesh position={[0, 0.08, 0.07]} scale={[1.55, 1.9, 0.035]}>
          <boxGeometry />
          <meshStandardMaterial color="#182036" roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.03, 0.13]} scale={[0.82, 1.45, 0.035]}>
          <boxGeometry />
          <meshStandardMaterial color="#050813" roughness={0.9} />
        </mesh>
        <mesh position={[-0.48, 0.03, 0.18]} scale={[0.08, 1.58, 0.08]}>
          <boxGeometry />
          <meshStandardMaterial color="#5c6f8f" roughness={0.55} />
        </mesh>
        <mesh position={[0.48, 0.03, 0.18]} scale={[0.08, 1.58, 0.08]}>
          <boxGeometry />
          <meshStandardMaterial color="#5c6f8f" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.84, 0.18]} scale={[1.06, 0.08, 0.08]}>
          <boxGeometry />
          <meshStandardMaterial color="#5c6f8f" roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.73, 0.2]} scale={[1.18, 0.08, 0.1]}>
          <boxGeometry />
          <meshStandardMaterial color="#8ea4bf" roughness={0.48} />
        </mesh>
        <mesh position={[0.36, -0.04, 0.22]} scale={[0.04, 0.04, 0.035]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color="#d6b45f" roughness={0.4} metalness={0.25} />
        </mesh>
        <Text position={[0, -0.92, 0.18]} fontSize={0.08} color="#9fb8d5" anchorX="center">
          DOORWAY
        </Text>
        <mesh position={[0.32, -0.55, 0.28]} scale={[0.55, 0.38, 0.16]}>
          <boxGeometry />
          <meshStandardMaterial color="#b9874b" roughness={0.7} />
        </mesh>
        <mesh position={[0.32, -0.25, 0.285]} scale={[0.58, 0.035, 0.17]}>
          <boxGeometry />
          <meshStandardMaterial color="#d2a15d" roughness={0.65} />
        </mesh>
        <mesh position={[0.58, -0.55, 0.285]} scale={[0.035, 0.39, 0.17]}>
          <boxGeometry />
          <meshStandardMaterial color="#7a5227" roughness={0.75} />
        </mesh>
        <BackpackModel position={[-0.9, -0.62, 0.18]} />
      </group>
    );
  }
  if (scene === "receipt") {
    return (
      <ReceiptModel />
    );
  }
  return (
    <group>
      <mesh position={[0, -0.63, 0.12]} scale={[2.2, 0.32, 0.08]}>
        <boxGeometry />
        <meshStandardMaterial color="#4b3545" roughness={0.7} />
      </mesh>
      <MugModel position={[-0.62, -0.36, 0.2]} />
      <FruitBowlModel position={[0.55, -0.36, 0.2]} />
      <Text position={[0.18, 0.45, 0.18]} fontSize={0.13} color="#f87171" anchorX="center">
        NO CAT REGION FOUND
      </Text>
    </group>
  );
}

function ReceiptModel() {
  const rows = [
    ["LAMP", "$12.20"],
    ["TEA SET", "$18.40"],
    ["MUG", "$6.80"],
  ];
  return (
    <group>
      <mesh position={[0, -0.05, 0.12]} scale={[1.25, 1.78, 0.025]}>
        <boxGeometry />
        <meshStandardMaterial color="#eef2f5" roughness={0.78} />
      </mesh>

      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={`top-${i}`} position={[-0.56 + i * 0.14, 0.84, 0.155]} scale={[0.035, 0.045, 0.012]}>
          <boxGeometry />
          <meshStandardMaterial color="#111827" roughness={0.7} />
        </mesh>
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={`bottom-${i}`} position={[-0.56 + i * 0.14, -0.94, 0.155]} scale={[0.035, 0.045, 0.012]}>
          <boxGeometry />
          <meshStandardMaterial color="#111827" roughness={0.7} />
        </mesh>
      ))}

      <Text position={[0, 0.58, 0.18]} fontSize={0.1} color="#111827" anchorX="center">
        LAB MART
      </Text>
      <Text position={[0, 0.43, 0.18]} fontSize={0.055} color="#374151" anchorX="center">
        RECEIPT #0427
      </Text>
      <mesh position={[0, 0.31, 0.17]} scale={[0.9, 0.01, 0.01]}>
        <boxGeometry />
        <meshBasicMaterial color="#9ca3af" />
      </mesh>

      <Text position={[-0.5, 0.18, 0.18]} fontSize={0.055} color="#4b5563" anchorX="left">
        ITEM
      </Text>
      <Text position={[0.5, 0.18, 0.18]} fontSize={0.055} color="#4b5563" anchorX="right">
        PRICE
      </Text>

      {rows.map(([item, price], i) => {
        const y = 0.02 - i * 0.24;
        return (
          <group key={item}>
            <Text position={[-0.5, y, 0.18]} fontSize={0.078} color="#111827" anchorX="left">
              {item}
            </Text>
            <Text position={[0.5, y, 0.18]} fontSize={0.078} color="#111827" anchorX="right">
              {price}
            </Text>
            <mesh position={[0, y - 0.11, 0.17]} scale={[0.9, 0.006, 0.01]}>
              <boxGeometry />
              <meshBasicMaterial color="#cbd5e1" />
            </mesh>
          </group>
        );
      })}

      <Text position={[-0.5, -0.71, 0.18]} fontSize={0.065} color="#111827" anchorX="left">
        TOTAL
      </Text>
      <Text position={[0.5, -0.71, 0.18]} fontSize={0.065} color="#111827" anchorX="right">
        $37.40
      </Text>
      <Text position={[0, -0.83, 0.18]} fontSize={0.045} color="#64748b" anchorX="center">
        THANK YOU
      </Text>
    </group>
  );
}

function MugModel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh scale={[0.18, 0.34, 0.18]}>
        <cylinderGeometry args={[0.72, 0.62, 1, 32]} />
        <meshStandardMaterial color="#8ed4e7" roughness={0.42} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.18, 0]} scale={[0.19, 0.035, 0.19]}>
        <torusGeometry args={[0.65, 0.08, 8, 32]} />
        <meshStandardMaterial color="#d7f7ff" roughness={0.35} />
      </mesh>
      <mesh position={[0.17, 0.01, 0.01]} rotation={[0, Math.PI / 2, 0]} scale={[0.11, 0.11, 0.11]}>
        <torusGeometry args={[0.95, 0.16, 10, 32, Math.PI * 1.35]} />
        <meshStandardMaterial color="#8ed4e7" roughness={0.42} />
      </mesh>
      <Text position={[0, -0.03, 0.2]} fontSize={0.06} color="#0f3340" anchorX="center">
        MUG
      </Text>
    </group>
  );
}

function FruitBowlModel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, -0.06, 0]} scale={[0.48, 0.16, 0.28]}>
        <sphereGeometry args={[0.72, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#7b4a30" roughness={0.64} />
      </mesh>
      <mesh position={[-0.16, 0.08, 0.04]} scale={[0.16, 0.14, 0.16]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.5} />
      </mesh>
      <mesh position={[0.08, 0.1, 0.05]} scale={[0.15, 0.14, 0.15]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#ef4444" roughness={0.45} />
      </mesh>
      <mesh position={[0.25, 0.07, 0.02]} scale={[0.14, 0.13, 0.14]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#facc15" roughness={0.48} />
      </mesh>
      <mesh position={[0.09, 0.23, 0.05]} rotation={[0.2, 0, -0.35]} scale={[0.025, 0.11, 0.025]}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshStandardMaterial color="#5b351f" roughness={0.6} />
      </mesh>
      <mesh position={[0.16, 0.26, 0.05]} rotation={[0, 0, -0.45]} scale={[0.08, 0.03, 0.035]}>
        <sphereGeometry args={[1, 16, 8]} />
        <meshStandardMaterial color="#4ade80" roughness={0.5} />
      </mesh>
      <Text position={[0, -0.22, 0.23]} fontSize={0.06} color="#ffd79a" anchorX="center">
        FRUIT
      </Text>
    </group>
  );
}

function BackpackModel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh scale={[0.34, 0.46, 0.16]}>
        <sphereGeometry args={[0.55, 24, 16]} />
        <meshStandardMaterial color="#2563a8" roughness={0.72} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.03, 0.09]} scale={[0.24, 0.28, 0.035]}>
        <boxGeometry />
        <meshStandardMaterial color="#1d4f8f" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.31, 0.03]} rotation={[Math.PI / 2, 0, 0]} scale={[0.16, 0.05, 0.12]}>
        <torusGeometry args={[0.9, 0.12, 8, 24, Math.PI]} />
        <meshStandardMaterial color="#93b7db" roughness={0.55} />
      </mesh>
      <mesh position={[-0.16, 0.02, 0.13]} rotation={[0.15, 0, -0.08]} scale={[0.03, 0.38, 0.025]}>
        <boxGeometry />
        <meshStandardMaterial color="#0f2f59" roughness={0.82} />
      </mesh>
      <mesh position={[0.16, 0.02, 0.13]} rotation={[0.15, 0, 0.08]} scale={[0.03, 0.38, 0.025]}>
        <boxGeometry />
        <meshStandardMaterial color="#0f2f59" roughness={0.82} />
      </mesh>
      <Text position={[0, -0.08, 0.16]} fontSize={0.075} color="#dbeafe" anchorX="center">
        BAG
      </Text>
    </group>
  );
}

function EvidenceBox3D({
  box,
  active,
  grounded,
}: {
  box: VisionCase["evidence"][number];
  active: boolean;
  grounded: boolean;
}) {
  const x = ((box.x + box.width / 2) / 100 - 0.5) * 3.8;
  const y = (0.5 - (box.y + box.height / 2) / 100) * 2.5;
  const w = (box.width / 100) * 3.8;
  const h = (box.height / 100) * 2.5;
  const color = box.kind === "target" || box.kind === "text" ? "#34d399" : box.kind === "missing" ? "#fbbf24" : "#f87171";
  return (
    <group position={[x, y, 0.22]}>
      <mesh visible={active || grounded}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.2 : 0.08} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments visible={active || grounded}>
        <edgesGeometry args={[new THREE.PlaneGeometry(w, h)]} />
        <lineBasicMaterial color={color} transparent opacity={active ? 1 : 0.35} />
      </lineSegments>
      {active && (
        <Html position={[0, h / 2 + 0.12, 0]} center transform distanceFactor={5.5}>
          <div className="whitespace-nowrap rounded border border-white/20 bg-black/80 px-2 py-1 text-[10px] text-white">
            {box.label}
          </div>
        </Html>
      )}
    </group>
  );
}

function ScanBeam({ solved }: { solved: boolean }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(solved ? "#34d399" : "#22d3ee") } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [solved]
  );
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh position={[0, 0.47, 0.31]} rotation={[-0.08, 0, 0]}>
      <planeGeometry args={[3.9, 2.55]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function OcrReveal() {
  return (
    <Html position={[1.55, 0.22, 0.65]} transform distanceFactor={5}>
      <div className="w-40 rounded border border-good/50 bg-black/75 p-2 font-mono text-[10px] text-good shadow-lg shadow-good/10">
        <div>OCR STREAM</div>
        <div>LAMP 12.20</div>
        <div>TEA SET 18.40</div>
        <div>MUG 6.80</div>
      </div>
    </Html>
  );
}

function EvidencePins({ visionCase, evidenceSet }: { visionCase: VisionCase; evidenceSet: Set<string> }) {
  return (
    <group position={[0, -0.86, 0.8]}>
      {visionCase.evidence.map((box, i) => evidenceSet.has(box.id) && (
        <mesh key={box.id} position={[-0.7 + i * 0.7, 0, 0]}>
          <octahedronGeometry args={[0.12, 0]} />
          <meshStandardMaterial color="#34d399" emissive="#0d5f48" />
        </mesh>
      ))}
    </group>
  );
}
