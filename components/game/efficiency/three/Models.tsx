"use client";
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Real CC0 low-poly assets:
//  - car.glb  — Quaternius "Sports Car" (CC0, poly.pizza). Body material "White".
//  - decoration-*.glb — Kenney "Starter-Kit-Racing" (CC0) roadside dressing.
// Front wheels sit at +Z, so the car is rotated PI to face down-track (-Z).

const CAR = "/models/car.glb";

function flatten(mat: THREE.Material): THREE.Material {
  const m = mat.clone() as THREE.MeshStandardMaterial;
  if ("flatShading" in m) { m.flatShading = true; m.needsUpdate = true; }
  return m;
}

/** The sports car, body recolored, optionally ghosted (semi-transparent). */
export function CarModel({ color, opacity = 1, scale = 0.85 }: { color: string; opacity?: number; scale?: number }) {
  const { scene } = useGLTF(CAR);
  const obj = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      const mat = flatten(src) as THREE.MeshStandardMaterial;
      if (src.name === "White") mat.color = new THREE.Color(color); // the paintable body panels
      if (opacity < 1) { mat.transparent = true; mat.opacity = opacity; mat.depthWrite = false; }
      mesh.material = mat;
      mesh.castShadow = true;
    });
    return root;
  }, [scene, color, opacity]);
  // rotate so the nose (front wheels at +Z) points down-track (-Z)
  return <primitive object={obj} rotation={[0, Math.PI, 0]} scale={scale} />;
}

/** A roadside decoration prop (forest / tents), flat-shaded, cloned per instance. */
export function Prop({ url, scale = 1, rotation = [0, 0, 0], position = [0, 0, 0] }: {
  url: string; scale?: number; rotation?: [number, number, number]; position?: [number, number, number];
}) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(flatten) : flatten(mesh.material);
    });
    return root;
  }, [scene]);
  return <primitive object={obj} scale={scale} rotation={rotation} position={position} />;
}

useGLTF.preload(CAR);
useGLTF.preload("/models/decoration-forest.glb");
useGLTF.preload("/models/decoration-tents.glb");
