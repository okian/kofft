/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,css}'],
  theme: {
    extend: {
      colors: {
        'accent-blue': '#3b82f6',
        'accent-teal': '#14b8a6'
      }
    },
  },
  plugins: [],
}

