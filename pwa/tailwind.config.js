/** Cores vêm de variáveis CSS definidas pelo tema de leitura escolhido. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: v('surface'),
        'surface-low': v('surface-low'),
        'surface-high': v('surface-high'),
        'on-surface': v('on-surface'),
        muted: v('muted'),
        outline: v('outline'),
        primary: v('primary'),
        'on-primary': v('on-primary'),
        'primary-container': v('primary-container'),
        'on-primary-container': v('on-primary-container'),
        secondary: v('secondary'),
        'secondary-container': v('secondary-container'),
        tertiary: v('tertiary'),
        danger: v('danger'),
      },
      fontFamily: {
        ui: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans', 'sans-serif'],
        reading: ['var(--reading-font)', 'Georgia', 'serif'],
      },
      maxWidth: { reading: '46rem' },
    },
  },
  plugins: [],
};
