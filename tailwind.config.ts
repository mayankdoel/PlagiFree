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
    },
  },
  plugins: [],
};

export default config;
