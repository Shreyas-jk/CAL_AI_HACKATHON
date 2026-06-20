import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PaperTrail AI — Make papers playable",
  description: "Turn dense ML/AI research papers into interactive, playable experiments.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-gray-100 antialiased">
        <header className="border-b border-edge/60">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 font-semibold">
              <span className="text-accent2">▦</span> PaperTrail<span className="text-accent">AI</span>
            </a>
            <span className="tag">Cal Hacks · Ddoski's Lab</span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 py-10 text-xs text-gray-500">
          Powered by Claude · Redis · Arize — Make papers playable.
        </footer>
      </body>
    </html>
  );
}
