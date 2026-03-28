/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./popup.html",
    "./options.html",
    "./offscreen.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#047857', // Emerald 700 - Islamic green
        primaryDark: '#064e3b',
        primaryLight: '#34d399',
        bgDark: '#111827',
        bgCard: '#1f2937',
        textMain: '#f3f4f6',
      }
    },
  },
  plugins: [],
}
