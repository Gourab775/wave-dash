/** @type {import('tailwindcss').Config} */
// Scans the game shell (and the standalone static copy) for utility classes,
// including the ones toggled at runtime inside its scripts.
module.exports = {
  content: ["./public/wave-dash.html", "./index.html"],
  theme: {
    extend: {},
  },
  plugins: [],
};
