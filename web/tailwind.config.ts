import type { Config } from "tailwindcss";

/**
 * Palette is the FarmKaro brand ramp, anchored on the live site's #003622.
 * Green is used strategically (CTA, active, verified, selected parcel) —
 * the map and satellite imagery stay the most saturated thing on screen.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: {
          950: "#001A10",
          900: "#003622",
          700: "#0B4A32",
          500: "#1B6B47",
          300: "#5FA37F",
          100: "#D9E8DE",
        },
        ink: "#0A0F0C",
        charcoal: "#1C211D",
        "off-white": "#F7F6F2",
        mute: { 400: "#8A9089", 200: "#E4E3DE" },
        gold: "#C9A24B",
        danger: "#B3392E",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.25rem" },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-up": "fade-up .5s cubic-bezier(.22,.61,.36,1) both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};
export default config;
