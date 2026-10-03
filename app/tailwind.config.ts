import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#07080d", 900: "#0a0c13", 800: "#0d0f17", 700: "#131624", 600: "#1a1e30" },
        brand: { violet: "#8b5cf6", indigo: "#6366f1", mint: "#14f195", sky: "#38bdf8" },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #8b5cf6 0%, #6366f1 45%, #14f195 100%)",
        "brand-text": "linear-gradient(90deg, #c4b5fd 0%, #818cf8 40%, #5eead4 75%, #14f195 100%)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,92,246,.25), 0 20px 60px -20px rgba(99,102,241,.55)",
        card: "0 1px 0 0 rgba(255,255,255,.04) inset, 0 20px 50px -30px rgba(0,0,0,.8)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "none" } },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(20,241,149,.45)" },
          "100%": { boxShadow: "0 0 0 10px rgba(20,241,149,0)" },
        },
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
      },
      animation: {
        "fade-up": "fade-up .45s ease-out both",
        "pulse-ring": "pulse-ring 1.6s ease-out infinite",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
