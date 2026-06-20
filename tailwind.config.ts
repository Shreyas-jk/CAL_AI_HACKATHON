import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a12", panel: "#13131f", edge: "#262636",
        accent: "#7c5cff", accent2: "#22d3ee", good: "#34d399", bad: "#f87171",
      },
      fontFamily: { mono: ["ui-monospace","SFMono-Regular","Menlo","monospace"] },
    },
  },
  plugins: [],
};
export default config;
