/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#FFFFFF',
        surface:  '#F5F5F5',
        surface2: '#EEEEEE',
        surface3: '#E5E5E5',
        border:   '#D8D8D8',
        border2:  '#BBBBBB',
        ink:      '#1A1A1A',       // primary text — near black
        'ink-dim':   '#444444',    // secondary text — dark gray
        'ink-muted': '#777777',    // tertiary text — medium gray (was #AAAAAA — too light)
        teal:     '#0D9E9E',       // slightly darker for better contrast on white
        'teal-dim':  '#0A7A7A',
        gold:     '#A07A10',       // darker gold for readability
        'gold-dim':  '#7A5C08',
        green:    '#157A50',       // darker green
        amber:    '#A86200',       // darker amber
        red:      '#B52B2B',       // darker red
        blue:     '#2255AA',       // darker blue
        purple:   '#5533AA',       // darker purple
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
