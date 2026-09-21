import frappeUIPreset from 'frappe-ui/tailwind'

// The palette lives in src/index.css as CSS variables; these names let
// components use it directly (bg-paper, text-ink-main, border-line, …).
const palette = {
  paper: 'var(--paper)',
  card: 'var(--card)',
  wash: 'var(--wash)',
  line: 'var(--line)',
  'line-strong': 'var(--line-strong)',
  muted: 'var(--muted)',
  'ink-main': 'var(--ink)',
  'ink-mid': 'var(--ink-mid)',
  'ink-soft': 'var(--ink-soft)',
  accent: 'var(--accent)',
  'accent-wash': 'var(--accent-wash)',
  'accent-line': 'var(--accent-line)',
  signal: 'var(--signal)',
  'signal-wash': 'var(--signal-wash)',
  'signal-line': 'var(--signal-line)',
}

export default {
  presets: [frappeUIPreset],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    './node_modules/frappe-ui/src/components/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: palette,
    },
  },
}
