// Tiny pixel-art icon set (retro arcade). Blocky SVG on a 16x16 grid, crisp edges,
// fills with currentColor so it inherits text color. Visual only.
type IconName = "gamepad" | "floppy" | "play" | "sparkle" | "reset";

const PATHS: Record<IconName, string> = {
  // chunky game controller
  gamepad:
    "M3 6h10v1h1v4h-1v1h-3v-1H6v1H3v-1H2V7h1V6zM5 8H4v1H3v1h1v1h1v-1h1V9H5V8zm5 0v1h1v1h1V9h-1V8h-1zm-1 1h1v1h-1V9z",
  // floppy disk save
  floppy:
    "M3 3h8l2 2v8H3V3zm2 0v3h5V3H5zm2 0v3h1V3H7zM5 9h6v3H5V9z",
  // play triangle
  play: "M5 3l8 5-8 5V3z",
  // 4-point sparkle
  sparkle: "M8 1l1.4 4.6L14 8l-4.6 1.4L8 14l-1.4-4.6L2 8l4.6-1.4L8 1z",
  // circular reset arrow (approx, blocky)
  reset:
    "M8 3a5 5 0 1 1-4.9 6h2.1A3 3 0 1 0 8 5v2L4 4l4-3v2z",
};

export default function PixelIcon({
  name,
  className = "w-4 h-4",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
