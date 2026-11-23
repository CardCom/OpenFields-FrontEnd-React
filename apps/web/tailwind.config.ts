import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefdfa',
          100: '#d2f7ef',
          500: '#0f766e',
          800: '#0b4a45',
          900: '#00353b',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
