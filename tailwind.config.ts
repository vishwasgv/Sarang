import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}', './src/renderer/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00AEEF',
          50: '#E6F7FD',
          100: '#CCF0FB',
          200: '#99E1F7',
          300: '#66D1F3',
          400: '#33C2EF',
          500: '#00AEEF',
          600: '#0094CC',
          700: '#0079A8',
          800: '#005F85',
          900: '#004461'
        },
        // Phase 39: secondary accent, sampled from the new logo's violet swirl —
        // additive (brand blue stays primary everywhere it's already used
        // throughout the app), for gradients / secondary emphasis / the
        // occasional highlight where Phase 40's redesign wants one.
        accent: {
          DEFAULT: '#7C5CFC',
          50: '#F3F0FF',
          100: '#E9E3FE',
          200: '#D3C6FD',
          300: '#B79CFB',
          400: '#9B78F9',
          500: '#7C5CFC',
          600: '#6640E0',
          700: '#5230B8',
          800: '#3F2490',
          900: '#2C1968'
        },
        dark: '#0F172A',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        surface: '#F8FAFC',
        // shadcn/ui-style semantic tokens — HSL triplets defined in
        // globals.css (:root / .dark), so a single class like `bg-card`
        // adapts automatically with the `dark` class, and opacity
        // modifiers (`bg-muted/30`) work via <alpha-value>.
        background: 'hsl(var(--background) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        info: 'hsl(var(--info) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px'
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
        float: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
        modal: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)'
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        sidebar: '280px',
        'sidebar-collapsed': '72px',
        topbar: '64px'
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-in-left': 'slideInLeft 0.2s ease-out',
        'slide-in-up': 'slideInUp 0.2s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out'
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideInLeft: { from: { transform: 'translateX(-8px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        slideInUp: { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        scaleIn: { from: { transform: 'scale(0.95)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } }
      }
    }
  },
  plugins: []
}

export default config
