import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#090d18",
        surface: "#101726",
        "surface-2": "#182036",
        "surface-3": "#263050",
        accent: "#38bdf8",
        "accent-dim": "#0e7090",
        warning: "#fbbf24",
        danger: "#f87171",
        success: "#34d399",
        muted: "#8fa3c8",
        border: "#182036",
        soma: "#c4b5fd",
        axon: "#6ee7b7",
        dendrite: "#93c5fd",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 8s linear infinite",
        "neural-pulse": "neuralPulse 2s ease-in-out infinite",
        "fade-in": "fadeIn 0.5s ease-in",
        "slide-up": "slideUp 0.3s ease-out",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        neuralPulse: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "neural-grid":
          "radial-gradient(circle at 1px 1px, rgba(56,189,248,0.08) 1px, transparent 0)",
      },
      boxShadow: {
        glow: "0 0 24px rgba(56,189,248,0.25)",
        "glow-warning": "0 0 24px rgba(251,191,36,0.25)",
        "glow-danger": "0 0 24px rgba(248,113,113,0.25)",
        "glow-success": "0 0 18px rgba(52,211,153,0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
