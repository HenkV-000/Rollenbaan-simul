/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#19312d',
        paper: '#f3f4ee',
        safety: '#e66b3d',
        mint: '#c9e1d4',
      },
    },
  },
  plugins: [],
};
