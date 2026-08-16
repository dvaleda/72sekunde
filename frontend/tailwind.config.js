/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#1F6F4A',
          greenDark: '#154C33',
          gold: '#C9A24B',
        },
      },
      fontFamily: {
        display: ['"Poppins"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
