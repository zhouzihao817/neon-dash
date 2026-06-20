/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        neon: {
          bg: "#0A0A14",
          blue: "#00D4FF",
          pink: "#FF2D95",
          purple: "#B44CFF",
          gold: "#FFD700",
          gray: "#2A2A3E",
        },
      },
      fontFamily: {
        orbitron: ['"Orbitron"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "neon-flicker": "neon-flicker 3s linear infinite",
        "scan-line": "scan-line 4s linear infinite",
        "float": "float 3s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px #FFD700, 0 0 40px #FFD700" },
          "50%": { boxShadow: "0 0 40px #FFD700, 0 0 80px #FFD700" },
        },
        "neon-flicker": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};
