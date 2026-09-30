/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Command-center palette — deep navy base, signal accents.
        base: {
          950: '#070b14',
          900: '#0b1220',
          850: '#0f1729',
          800: '#141f36',
          700: '#1c2b4a',
          600: '#27395f',
        },
        signal: {
          DEFAULT: '#38bdf8',
          muted: '#0ea5e9',
        },
        confidence: {
          high: '#34d399',
          medium: '#fbbf24',
          low: '#fb7185',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
