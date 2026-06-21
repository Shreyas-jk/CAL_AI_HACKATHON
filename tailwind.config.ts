import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neural Arcade retro palette
        parchment: "#FFF8ED",   // warm page background
        paper: "#FFFDF7",       // card fill (a touch lighter than the page)
        charcoal: "#2D3142",    // base text + borders
        coral: "#FF6B6B",       // primary accent
        "coral-dark": "#E0554F",
        mint: "#4ECDC4",        // secondary accent
        "mint-dark": "#2FA39A",

        // Semantic aliases so existing className usages re-theme automatically:
        accent: "#FF6B6B",      // primary   -> coral
        accent2: "#4ECDC4",     // secondary -> mint
        panel: "#13131f",       // kept DARK: game panels (bg-panel) stay intact
        edge: "#3a3c52",        // border tone visible on BOTH parchment + dark game panels
        ink: "#1E2128",         // kept DARK: game / CRT surfaces (bg-ink/*)
        good: "#2FA39A",        // success (legible mint)
        bad: "#E0554F",         // error   (legible coral)
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "JetBrains Mono", "Menlo", "monospace"],
        serif: ["var(--font-serif)", "Georgia", "Times New Roman", "serif"],
        sans: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
      },
      boxShadow: {
        retro: "3px 3px 0 0 #2D3142",
        "retro-sm": "2px 2px 0 0 #2D3142",
        "retro-lg": "5px 5px 0 0 #2D3142",
      },
    },
  },
  plugins: [],
};
export default config;
