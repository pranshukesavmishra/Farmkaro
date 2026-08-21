import type { Config } from "tailwindcss";

/**
 * Colours resolve to CSS variables defined in globals.css, so a single set of
 * utilities works in both themes. The literal `forest`/`gold` ramp is kept for
 * places that must stay fixed regardless of theme (chips over satellite
 * imagery, map markers).
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        "canvas-2": "var(--canvas-2)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        ink: "var(--fg)",
        "ink-muted": "var(--fg-muted)",
        "ink-faint": "var(--fg-faint)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        brand: "var(--brand)",
        "brand-ink": "var(--brand-ink)",
        "brand-hover": "var(--brand-hover)",
        positive: "var(--positive)",
        gold: "var(--gold)",
        "gold-soft": "var(--gold-soft)",
        danger: "var(--danger)",

        // Fixed ramp — for elements layered over imagery, where the surrounding
        // theme must not change the contrast against the photograph.
        forest: {
          950: "#001A10",
          900: "#003622",
          700: "#0B4A32",
          500: "#1B6B47",
          300: "#5FA37F",
          200: "#A8D8BF",
          100: "#D9E8DE",
        },
        // Gold over imagery. `--gold` swaps to a deep ochre in the light theme
        // so it stays readable on paper, which would make it invisible on the
        // permanently-dark glass chrome that floats over satellite tiles.
        ochre: {
          300: "#E3BE76",
          400: "#C9A24B",
          900: "#1A1405",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        xs: "var(--t-xs)",
        sm: "var(--t-sm)",
        base: "var(--t-base)",
        md: "var(--t-md)",
        lg: "var(--t-lg)",
        xl: "var(--t-xl)",
        "2xl": "var(--t-2xl)",
        "3xl": "var(--t-3xl)",
      },
      borderRadius: {
        DEFAULT: "10px",
        lg: "var(--radius)",
        xl: "var(--radius)",
        "2xl": "var(--radius-lg)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      maxWidth: {
        prose: "68ch",
        shell: "1400px",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};
export default config;
