/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0A',
        surface: '#111111',
        surface2: '#161616',
        surface3: '#1C1C1C',
        border: '#222222',
        border2: '#2A2A2A',
        ink: '#F0EDE8',
        'ink-dim': '#888888',
        'ink-muted': '#444444',
        teal: '#2ABFBF',
        'teal-dim': '#1A9090',
        gold: '#C9A84C',
        'gold-dim': '#A07830',
        green: '#3ECF8E',
        amber: '#F5A623',
        red: '#E05252',
        blue: '#5B8CF5',
        purple: '#9B7CF5',
      },
      fontFamily: {
        sans: ['"Inter"', '"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', '"Helvetica Neue"', 'sans-serif'],
        mono: ['"SF Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs: ['11px', '16px'],
        sm: ['12.5px', '18px'],
        base: ['13.5px', '20px'],
        lg: ['15px', '22px'],
        xl: ['17px', '24px'],
        '2xl': ['20px', '28px'],
        '3xl': ['28px', '36px'],
      },
    },
  },
  plugins: [],
}
