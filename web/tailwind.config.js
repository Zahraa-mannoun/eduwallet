import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2E5FAC',
          50: '#EEF3FA',
          100: '#DCE7F5',
          200: '#B0C7E8',
          300: '#84A7DB',
          400: '#5883C3',
          500: '#2E5FAC',
          600: '#254C89',
          700: '#1C3966',
          800: '#132644',
          900: '#0A1322',
        },
        sidebar: {
          DEFAULT: '#0F172A',
          hover: '#1E293B',
          muted: '#94A3B8',
        },
        surface: '#F1F5F9',
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
