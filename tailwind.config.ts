import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#050816",
          900: "#0a0f23",
          800: "#101937",
        },
        accent: {
          cyan: "#62e6ff",
          mint: "#5ff5ba",
          amber: "#ffc857",
          coral: "#ff7f6b",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(98, 230, 255, 0.12), 0 20px 70px rgba(5, 8, 22, 0.45)",
        soft: "0 18px 45px rgba(3, 7, 18, 0.35)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        pulseGlow: "pulseGlow 3s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(95, 245, 186, 0.25)" },
          "50%": { boxShadow: "0 0 0 16px rgba(95, 245, 186, 0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

