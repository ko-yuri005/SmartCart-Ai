/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        velora: {
          ivory: '#F8F5EF',
          white: '#FFFFFF',
          forest: '#254B3B',
          forestHover: '#1B382C',
          forestLight: '#EDF3EE',
          sage: '#DCE7D9',
          terracotta: '#C76F4A',
          terracottaLight: '#F9ECE6',
          gold: '#E6BE65',
          dustyblue: '#DCE7EE',
          charcoal: '#282824',
          secondary: '#77766F',
          border: '#E8E3D9',
          card: '#FFFFFF',
          surfaceMuted: '#F1EDE4',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
