/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./popup.html",
    "./options.html",
    "./offscreen.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#047857', 
        primaryDark: '#064e3b',
        gold: '#d97706',
        bgLight: '#fdfbf7',
        bgDark: '#0f172a',
        cardLight: '#ffffff',
        cardDark: '#1e293b',
        textLight: '#1f2937',
        textDark: '#f8fafc',
      }
    },
  },
  plugins: [],
}
