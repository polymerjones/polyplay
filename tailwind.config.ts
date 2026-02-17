import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ["Avenir Next", "Avenir", "Trebuchet MS", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(125, 211, 252, 0.3), 0 16px 42px rgba(15, 23, 42, 0.4)"
      }
    }
  },
  plugins: []
} satisfies Config;
