"use client";
import { useEffect, useRef } from "react";
import { defaultPuzzle, type Puzzle } from "./puzzle";
export default function SeatGame({ puzzle = defaultPuzzle }: { puzzle?: Puzzle }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<any>(null);

  useEffect(() => {
    let destroyed = false;
    (async () => {
      const Phaser = (await import("phaser")).default;
      const { createGame } = await import("./scene");
      if (destroyed || !hostRef.current) return;
      gameRef.current = createGame(Phaser, hostRef.current, {
        puzzle,
        onWin: () => {
          import("canvas-confetti").then((m) =>
            m.default({
              particleCount: 180,
              spread: 95,
              origin: { y: 0.55 },
              colors: ["#f4c04a", "#e39aa0", "#a78bfa", "#4fd19a", "#5ab0e0", "#e879c8"],
            })
          );
        },
      });
    })();
    return () => {
      destroyed = true;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [puzzle]);

  return (
    <div className="rounded-2xl overflow-hidden border shadow-inner" style={{ background: "#f2e8d5", borderColor: "#e0cfad" }}>
      <div ref={hostRef} className="w-full" style={{ aspectRatio: "1280 / 720" }} />
    </div>
  );
}
