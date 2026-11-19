/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        stage: '#121216',
        surface: '#1a1b22',
        surfaceHover: '#242632',
        borderDark: '#2c2e3b',
      },
    },
  },
  plugins: [],
};
