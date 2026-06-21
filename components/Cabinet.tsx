import type { ReactNode } from "react";

// Retro arcade-cabinet / CRT bezel that frames a game viewport. Theme only — it
// wraps whatever is rendered inside (2D SVG or a 3D canvas); it never changes the
// contents. The dark frame is what bridges the dark 3D scenes with the light page.
export default function Cabinet({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={"cabinet " + className}>
      {label && (
        <div className="label flex items-center justify-between px-1 pb-1.5 text-[0.6rem]">
          <span className="text-mint">● {label}</span>
          <span className="text-coral">✦ ARCADE</span>
        </div>
      )}
      <div className="cabinet-screen">{children}</div>
    </div>
  );
}
