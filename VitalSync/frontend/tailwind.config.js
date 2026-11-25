/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        page: {
          light: '#C9DDF7',
          DEFAULT: '#C9DDF7',
          dark: '#0B1329',
        },
        card: {
          light: '#FFFFFF',
          DEFAULT: '#FFFFFF',
          dark: '#16223F',
          darker: '#0F182E',
        },
        primary: {
          DEFAULT: '#1FA89A', // Primary Teal
          teal: '#1FA89A',
          hover: '#198b7f',
          light: '#e6f7f5',
          dark: '#146f65',
        },
        accent: {
          DEFAULT: '#4A7BD0', // Accent Blue
          blue: '#4A7BD0',
          hover: '#3a66b2',
          light: '#edf2fc',
          dark: '#2c4d87',
        },
        alert: {
          DEFAULT: '#E5484D', // Alert Red
          red: '#E5484D',
          hover: '#c93b40',
          light: '#fdf2f2',
          dark: '#9e1c23',
        },
        stable: {
          DEFAULT: '#30A46C', // Stable Green
          green: '#30A46C',
          hover: '#278a5b',
          light: '#edf8f2',
          dark: '#1b5f3e',
        },
        attention: {
          DEFAULT: '#F5A524', // Attention Amber
          amber: '#F5A524',
          hover: '#d98e16',
          light: '#fef7ec',
          dark: '#9e6209',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '14px',
        'card-sm': '12px',
        'card-lg': '16px',
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
        'soft-md': '0 8px 30px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.05)',
        'soft-lg': '0 12px 40px -6px rgba(15, 23, 42, 0.12), 0 6px 16px -3px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
};
