/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        upay: {
          green: '#2e7d32',
          light: '#4caf50',
          dark: '#1b5e20',
        }
      }
    },
  },
  plugins: [],
}