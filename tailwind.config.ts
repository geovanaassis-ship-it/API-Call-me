import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6ff",
          200: "#b8ccff",
          300: "#8ea9ff",
          400: "#5f7ffb",
          500: "#3a5ce6",
          600: "#2a44c0",
          700: "#233699",
          800: "#1f2f7a",
          900: "#1c2a63",
        },
      },
    },
  },
  plugins: [],
};

export default config;
