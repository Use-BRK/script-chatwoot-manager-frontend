import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Oxygen-Sans",
          "Ubuntu",
          "Cantarell",
          '"Helvetica Neue"',
          "sans-serif",
        ],
      },
      fontSize: {
        xs: ["11px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "24px" }],
        "2xl": ["30px", { lineHeight: "36px" }],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "8px",
        lg: "10px",
        full: "9999px",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0,0,0,0.05)",
        md: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
        "blue-glow":
          "0 4px 15px 0 rgba(31,147,255,0.4), 0 2px 6px 0 rgba(0,0,0,0.15)",
        "ruby-glow": "0 2px 6px 0 rgba(255,59,92,0.5)",
      },
      colors: {
        background: "rgb(var(--background-color) / <alpha-value>)",
        foreground: "rgb(var(--slate-12) / <alpha-value>)",
        muted: {
          DEFAULT: "rgb(var(--slate-3) / <alpha-value>)",
          foreground: "rgb(var(--slate-11) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--solid-1) / <alpha-value>)",
          foreground: "rgb(var(--slate-12) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--solid-1) / <alpha-value>)",
          foreground: "rgb(var(--slate-12) / <alpha-value>)",
        },
        border: "rgb(var(--border-weak) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        input: "rgb(var(--border-weak) / <alpha-value>)",
        ring: "rgb(var(--blue-9) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--blue-9) / <alpha-value>)",
          foreground: "rgb(255 255 255 / <alpha-value>)",
          hover: "rgb(var(--blue-10) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--iris-9) / <alpha-value>)",
          foreground: "rgb(255 255 255 / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--solid-blue) / <alpha-value>)",
          foreground: "rgb(var(--text-blue) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--teal-9) / <alpha-value>)",
          foreground: "rgb(255 255 255 / <alpha-value>)",
          subtle: "rgb(var(--teal-3) / <alpha-value>)",
          text: "rgb(var(--teal-11) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--amber-9) / <alpha-value>)",
          foreground: "rgb(var(--amber-12) / <alpha-value>)",
          subtle: "rgb(var(--amber-3) / <alpha-value>)",
          text: "rgb(var(--amber-11) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--ruby-9) / <alpha-value>)",
          foreground: "rgb(255 255 255 / <alpha-value>)",
          subtle: "rgb(var(--ruby-3) / <alpha-value>)",
          text: "rgb(var(--ruby-11) / <alpha-value>)",
        },
        slate: {
          1: "rgb(var(--slate-1) / <alpha-value>)",
          2: "rgb(var(--slate-2) / <alpha-value>)",
          3: "rgb(var(--slate-3) / <alpha-value>)",
          4: "rgb(var(--slate-4) / <alpha-value>)",
          5: "rgb(var(--slate-5) / <alpha-value>)",
          6: "rgb(var(--slate-6) / <alpha-value>)",
          7: "rgb(var(--slate-7) / <alpha-value>)",
          8: "rgb(var(--slate-8) / <alpha-value>)",
          9: "rgb(var(--slate-9) / <alpha-value>)",
          10: "rgb(var(--slate-10) / <alpha-value>)",
          11: "rgb(var(--slate-11) / <alpha-value>)",
          12: "rgb(var(--slate-12) / <alpha-value>)",
        },
        blue: {
          1: "rgb(var(--blue-1) / <alpha-value>)",
          2: "rgb(var(--blue-2) / <alpha-value>)",
          3: "rgb(var(--blue-3) / <alpha-value>)",
          4: "rgb(var(--blue-4) / <alpha-value>)",
          5: "rgb(var(--blue-5) / <alpha-value>)",
          6: "rgb(var(--blue-6) / <alpha-value>)",
          7: "rgb(var(--blue-7) / <alpha-value>)",
          8: "rgb(var(--blue-8) / <alpha-value>)",
          9: "rgb(var(--blue-9) / <alpha-value>)",
          10: "rgb(var(--blue-10) / <alpha-value>)",
          11: "rgb(var(--blue-11) / <alpha-value>)",
          12: "rgb(var(--blue-12) / <alpha-value>)",
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 200ms cubic-bezier(0,0,0.2,1)",
        "accordion-up": "accordion-up 200ms cubic-bezier(0,0,0.2,1)",
        "fade-in": "fade-in 200ms cubic-bezier(0,0,0.2,1)",
        "scale-in": "scale-in 150ms cubic-bezier(0,0,0.2,1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
