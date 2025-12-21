
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          900: 'rgb(var(--color-slate-900) / <alpha-value>)',
          800: 'rgb(var(--color-slate-800) / <alpha-value>)',
          700: 'rgb(var(--color-slate-700) / <alpha-value>)',
          600: 'rgb(var(--color-slate-600) / <alpha-value>)',
          500: 'rgb(var(--color-slate-500) / <alpha-value>)',
          400: 'rgb(var(--color-slate-400) / <alpha-value>)',
          300: 'rgb(var(--color-slate-300) / <alpha-value>)',
          200: 'rgb(var(--color-slate-200) / <alpha-value>)',
          100: 'rgb(var(--color-slate-100) / <alpha-value>)',
          50:  'rgb(var(--color-slate-50) / <alpha-value>)',
        },
        white: 'rgb(var(--color-white) / <alpha-value>)',
      }
    },
  },
  plugins: [],
}
