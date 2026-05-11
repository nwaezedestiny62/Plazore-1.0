/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./App.tsx", "./components/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: '#111111',
        secondary: '#6666',
        background: '#ffff',
        surface: '#f7f7f7',
        accent: '#ff4c3b',
        border: '#eeee',
      }
    },
  },
  plugins: [],
}