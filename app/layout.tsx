import "./globals.css";
import type { Metadata } from "next";
import PixelIcon from "@/components/PixelIcon";

export const metadata: Metadata = {
  title: "Neural Arcade — The Paper Simulator",
  description: "Turn dense ML/AI research papers into interactive, playable retro arcade experiments.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b-2 border-charcoal bg-parchment/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-4">
            <a href="/" className="flex items-center gap-2.5 group">
              <span className="grid place-items-center w-8 h-8 rounded-md bg-coral border-[1.5px] border-charcoal shadow-retro-sm">
                <PixelIcon name="gamepad" className="w-4 h-4 text-charcoal" />
              </span>
              <span className="label text-sm sm:text-base font-bold leading-tight">
                Neural Arcade
                <span className="hidden sm:inline text-charcoal/55"> : The Paper Simulator</span>
              </span>
            </a>
            <span className="tag">Cal Hacks · Ddoski&apos;s Lab</span>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
