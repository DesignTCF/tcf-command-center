/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#F7F8F8',
        surface:  '#FFFFFF',
        surface2: '#F1F3F3',
        surface3: '#E8EBEB',
        border:   '#DDE1E1',
        border2:  '#C3C9C9',
        ink:      '#16201F',       // primary text — near black
        'ink-dim':   '#48514F',    // secondary text
        'ink-muted': '#6B7371',    // tertiary / labels
        teal:     '#0D9E9E',
        'teal-dim':  '#0A7A7A',
        'teal-soft': '#E4F4F4',
        gold:     '#A07A10',
        green:    '#157A50',
        'green-soft': '#E3F3EB',
        amber:    '#A86200',
        'amber-soft': '#FBF0DD',
        red:      '#B52B2B',
        'red-soft':  '#F8E4E4',
        blue:     '#2255AA',
        'blue-soft': '#E5ECF7',
        purple:   '#5533AA',
      },
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Helvetica Neue"', 'sans-serif'],
        mono: ['"SF Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs:   ['11px', '16px'],
        sm:   ['12.5px', '18px'],
        base: ['13.5px', '20px'],
        lg:   ['15px', '22px'],
        xl:   ['17px', '24px'],
        '2xl':['21px', '28px'],
        '3xl':['28px', '36px'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,32,31,0.04), 0 1px 3px rgba(22,32,31,0.06)',
        pop:  '0 4px 16px rgba(22,32,31,0.10)',
      },
    },
  },
  plugins: [],
}
