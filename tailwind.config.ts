import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#050816",
          900: "#0a0f23",
        },
      },
    },
  },
  plugins: [],
};

export default config;
