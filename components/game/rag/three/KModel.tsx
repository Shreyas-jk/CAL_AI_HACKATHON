"use client";
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

// Loads a Kenney CC0 GLB, clones it (so it can be instanced), flat-shades for
// the low-poly toon look matching the efficiency game's Car Kit aesthetic.
export function KModel({ url, position, rotation, scale, tint, flatColor, onClick, onPointerOver, onPointerOut }: {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  tint?: string;       // multiplies the Kenney colormap (lane tints) — keeps the texture
  flatColor?: string;  // replaces the material with a clean solid color (e.g. cardboard boxes)
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (flatColor) {
        m.material = new THREE.MeshStandardMaterial({ color: flatColor, flatShading: true, metalness: 0, roughness: 1 });
      } else {
        const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
        const mat = src.clone();
        // keep the embedded colormap; crisp nearest filtering (it's a tiny color atlas), matte, flat-shaded
        if (mat.map) { mat.map.magFilter = THREE.NearestFilter; mat.map.minFilter = THREE.NearestFilter; mat.map.needsUpdate = true; }
        mat.flatShading = true; mat.metalness = 0; mat.roughness = 0.95;
        if (tint) mat.color = new THREE.Color(tint);
        mat.needsUpdate = true;
        m.material = mat;
      }
      m.castShadow = true; m.receiveShadow = true;
    });
    return root;
  }, [scene, tint, flatColor]);
  return (
    <group position={position} rotation={rotation} scale={scale} onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      <primitive object={obj} />
    </group>
  );
}

export const KENNEY = {
  conveyor: "/models/kenney/conveyor-long.glb",
  box: "/models/kenney/box-wide.glb",
  arm: "/models/kenney/robot-arm-a.glb",
  bin: "/models/kenney/hopper-high-square.glb",
  machine: "/models/kenney/machine.glb",
  structure: "/models/kenney/structure-high.glb",
  pipe: "/models/kenney/pipe-large.glb",
  screen: "/models/kenney/screen-panel-wide.glb",
};
Object.values(KENNEY).forEach((u) => useGLTF.preload(u));
