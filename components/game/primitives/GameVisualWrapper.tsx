"use client";
import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 40;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  hue: number;
}

function initParticles(w: number, h: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    size: 1 + Math.random() * 2,
    opacity: 0.15 + Math.random() * 0.25,
    hue: 220 + Math.random() * 60,
  }));
}

const EFFECT_STYLES = `
@keyframes gv-glow-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
@keyframes gv-float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
}
@keyframes gv-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

export default function GameVisualWrapper({
  children,
  accentColor = "#7c5cff",
  status = "playing",
}: {
  children: React.ReactNode;
  accentColor?: string;
  status?: "idle" | "playing" | "won" | "lost";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width;
      canvas.height = rect.height;
      if (particlesRef.current.length === 0) {
        particlesRef.current = initParticles(canvas.width, canvas.height);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!ctx || !canvas) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 65%, ${p.opacity})`;
        ctx.fill();
      }

      // Draw connections between nearby particles
      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const a = particlesRef.current[i];
          const b = particlesRef.current[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `hsla(240, 50%, 60%, ${0.08 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const glowColor =
    status === "won"
      ? "rgba(52, 211, 153, 0.15)"
      : status === "lost"
      ? "rgba(248, 113, 113, 0.12)"
      : `${accentColor}18`;

  return (
    <>
      <style>{EFFECT_STYLES}</style>
      <div className="relative rounded-2xl overflow-hidden">
        {/* Ambient particle canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none z-0"
          style={{ opacity: 0.6 }}
        />

        {/* Corner glow effects */}
        <div
          className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl pointer-events-none z-0"
          style={{
            background: glowColor,
            animation: "gv-glow-pulse 4s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full blur-3xl pointer-events-none z-0"
          style={{
            background: glowColor,
            animation: "gv-glow-pulse 4s ease-in-out infinite 2s",
          }}
        />

        {/* Content */}
        <div className="relative z-10">{children}</div>
      </div>
    </>
  );
}
