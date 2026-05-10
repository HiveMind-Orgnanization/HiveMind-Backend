/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4ADE80',
        secondary: '#2563EB',
        accent: '#F59E42'
      },
      fontFamily: {
        sans: ['system-ui', 'ui-rounded', 'sans-serif']
      }
    }
  },
  plugins: []
};
