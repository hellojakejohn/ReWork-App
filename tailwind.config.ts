import type { Config } from 'tailwindcss'

// Every color is a CSS variable from src/app/globals.css (light on :root, dark on .dark).
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: { DEFAULT: token('surface'), raised: token('surface-raised') },
        border: token('border'),
        input: token('input'),
        text: {
          DEFAULT: token('text'),
          secondary: token('text-secondary'),
          muted: token('text-muted'),
          faint: token('text-faint'),
        },
        sage: token('sage'),
        re: token('re'),
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          fg: token('accent-fg'),
          strong: token('accent-strong'),
        },
        removed: token('removed'),
        success: { DEFAULT: token('success'), tint: token('success-tint') },
        warn: { DEFAULT: token('warn'), tint: token('warn-tint') },
        inverse: { DEFAULT: token('inverse'), fg: token('inverse-fg') },
        'resume-paper': token('resume-paper'),
        ring: token('text'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      borderRadius: {
        input: '12px',
        card: '20px',
        panel: '24px',
      },
      boxShadow: {
        float: '0 12px 40px -12px rgb(var(--shadow) / 0.18), 0 2px 8px -2px rgb(var(--shadow) / 0.06)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
