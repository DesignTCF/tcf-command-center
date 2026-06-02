/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#FFFFFF',
        surface:  '#F7F7F7',
        surface2: '#EFEFEF',
        surface3: '#E5E5E5',
        border:   '#E0E0E0',
        border2:  '#CCCCCC',
        ink:      '#111111',
        'ink-dim':   '#555555',
        'ink-muted': '#AAAAAA',
        teal:     '#1AADAD',
        'teal-dim':  '#128888',
        gold:     '#B8921E',
        'gold-dim':  '#8F6E10',
        green:    '#1A9E6A',
        amber:    '#C47A0A',
        red:      '#CC3333',
        blue:     '#3366CC',
        purple:   '#6644BB',
      },
      fontFamily: {
        sans: ['"Inter"', '"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', '"Helvetica Neue"', 'sans-serif'],
        mono: ['"SF Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs:   ['11px', '16px'],
        sm:   ['12.5px', '18px'],
        base: ['13.5px', '20px'],
        lg:   ['15px', '22px'],
        xl:   ['17px', '24px'],
        '2xl':['20px', '28px'],
        '3xl':['28px', '36px'],
      },
    },
  },
  plugins: [],
}
