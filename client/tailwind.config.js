/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#2563EB', // Blue-600
                    dark: '#1D4ED8',
                    light: '#3B82F6'
                },
                secondary: {
                    DEFAULT: '#111827', // Gray-900 (Sidebar)
                    hover: '#374151'    // Gray-700
                },
                accent: {
                    warning: '#D97706', // Amber-600
                    success: '#16A34A', // Green-600
                    danger: '#DC2626'   // Red-600
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
