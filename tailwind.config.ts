import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0A0D13", // canvas
          800: "#0F141D", // raised canvas
          700: "#151B27", // card
          600: "#1B2230", // card hover
          500: "#232C3D", // border
          400: "#33405A", // strong border
        },
        fg: {
          DEFAULT: "#E7EBF3",
          muted: "#94A0B8",
          faint: "#5E6B83",
        },
        // 自住 / Owner-occupier — warm, "home"
        live: {
          DEFAULT: "#F2A65A",
          soft: "#F6C490",
          dim: "rgba(242,166,90,0.12)",
        },
        // 投资 / Investor — cool, "capital"
        invest: {
          DEFAULT: "#34D6A6",
          soft: "#7DE8C8",
          dim: "rgba(52,214,166,0.12)",
        },
        brand: {
          DEFAULT: "#6E8BFF",
          dim: "rgba(110,139,255,0.14)",
        },
        danger: "#F2607A",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        pulsering: {
          "0%,100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 1.6s infinite",
        pulsering: "pulsering 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
