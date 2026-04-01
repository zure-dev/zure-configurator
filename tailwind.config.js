/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/configurator-premium/**/*.{ts,tsx}',
    './src/components/configurator/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        body: ['DM Sans', 'Helvetica Neue', 'sans-serif'],
      },
      colors: {
        stone: {
          50: '#FAFAF8',
          100: '#F5F4F1',
          150: '#F0EDE8',
          200: '#E8E5E0',
          300: '#D0CDC6',
          400: '#A8A49D',
          500: '#888480',
          600: '#6B6862',
          700: '#4A4844',
          800: '#2C2A27',
          900: '#1A1A1A',
        },
        success: '#2D6A4F',
        danger: '#C53030',
      },
      animation: {
        'preview-in': 'previewIn 0.15s ease-out',
        'sheet-up': 'sheetUp 0.25s ease-out',
        'spin-slow': 'spin 0.8s linear infinite',
      },
      keyframes: {
        previewIn: {
          from: { opacity: '0', transform: 'translateY(4px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        sheetUp: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
