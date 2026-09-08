/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class', '[data-appearance="dark"]'],
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                sf: {
                    canvas: 'var(--sf-canvas)',
                    surface: 'var(--sf-surface)',
                    raised: 'var(--sf-raised)',
                    inset: 'var(--sf-inset)',
                    hover: 'var(--sf-hover)',
                    text: 'var(--sf-text)',
                    muted: 'var(--sf-muted)',
                    divider: 'var(--sf-divider)',
                    border: 'var(--sf-border)',
                    control: 'var(--sf-control)',
                    primary: 'var(--sf-primary)',
                    'on-primary': 'var(--sf-on-primary)',
                    'primary-hover': 'var(--sf-primary-hover)',
                    emerald: 'var(--sf-primary)',
                    'emerald-hover': 'var(--sf-primary-hover)',
                    sidebar: 'var(--sf-sidebar)',
                    'side-text': 'var(--sf-side-text)',
                    'side-muted': 'var(--sf-side-muted)',
                    'side-active': 'var(--sf-side-active)',
                    earth: 'var(--sf-earth)',
                    'earth-bg': 'var(--sf-earth-bg)',
                    ochre: 'var(--sf-ochre)',
                    'ochre-bg': 'var(--sf-ochre-bg)',
                    blue: 'var(--sf-blue)',
                    'blue-bg': 'var(--sf-blue-bg)',
                    link: 'var(--sf-link)',
                    focus: 'var(--sf-focus)',
                    'success-bg': 'var(--sf-success-bg)',
                    success: 'var(--sf-success)',
                    'warning-bg': 'var(--sf-warning-bg)',
                    warning: 'var(--sf-warning)',
                    'danger-bg': 'var(--sf-danger-bg)',
                    danger: 'var(--sf-danger)',
                    'info-bg': 'var(--sf-info-bg)',
                    info: 'var(--sf-info)',
                    selected: 'var(--sf-selected)',
                    disabled: 'var(--sf-disabled-bg)',
                    'disabled-text': 'var(--sf-disabled-text)',
                },
                primary: {
                    DEFAULT: '#276B51',
                    dark: '#20583F',
                    light: '#8ED3B8'
                },
                secondary: {
                    DEFAULT: '#111827',
                    hover: '#374151'
                },
                accent: {
                    warning: '#D97706',
                    success: '#16A34A',
                    danger: '#DC2626'
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
