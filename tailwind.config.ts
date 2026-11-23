import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#050505", 900: "#0a0a0a", 850: "#111111", 800: "#171717", 700: "#222222", 600: "#2e2e2e", 500: "#404040" },
        volt: { DEFAULT: "#ffd60a", 400: "#ffe24d", 600: "#e6b800" },
        pulse: { DEFAULT: "#f5f5f4", 600: "#a8a29e" },
        ember: { DEFAULT: "#ff6b3d" },
        orchid: { DEFAULT: "#a78bfa" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { rise: "rise .35s cubic-bezier(.2,.7,.2,1) both" },
    },
  },
  plugins: [],
} satisfies Config;
