import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0e1613",
        surface: "#16211d",
        line: "#26332e",
        muted: "#93a69e",
        accent: "#35b394",
        brass: "#e0a83c",
        // Brand (public/light surfaces) — sampled from the Quorum lockup.
        brand: "#F26522",
        "brand-dark": "#D9531A",
        "brand-tint": "#FFF3EC",
        navy: "#262261",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        pixel: ["var(--font-pixel)", "ui-monospace", "monospace"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
