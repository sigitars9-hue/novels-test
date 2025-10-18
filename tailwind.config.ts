// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",          // ⬅️ tambahkan
  ],
  safelist: [
    // kelas yang sering dipakai kondisional (biar tidak ter-purge saat production build)
    "backdrop-blur",
    "backdrop-blur-sm",
    "backdrop-blur-md",
    "backdrop-blur-lg",
    "backdrop-blur-xl",
    "bg-white/5",
    "bg-white/10",
    "bg-white/20",
    "bg-zinc-900/40",
    "bg-zinc-950/40",
    "ring-white/10",
    "ring-amber-300/40",
    "ring-emerald-300/40",
    "shadow-2xl",
  ],
  theme: {
    extend: {
      borderRadius: {
        "xl": "0.875rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      boxShadow: {
        glass: "0 10px 30px 0 rgba(0,0,0,.35)",
      },
      backdropBlur: {
        xs: "2px",
      },
      // opsional: gradient untuk hero
      backgroundImage: {
        "radial-faded": "radial-gradient(60% 60% at 50% 0%, rgba(255,255,255,.06), rgba(0,0,0,0))",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("tailwind-scrollbar")({ nocompatible: true }),
  ],
};

export default config;
