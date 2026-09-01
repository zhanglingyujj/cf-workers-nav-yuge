/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: ['./src/frontend/**/*.{js,html}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Public Sans"', 'system-ui', 'sans-serif'],
                label: ['"Space Grotesk"', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'monospace'],
            },
            colors: {
                heritage: {
                    50: '#FDF2F0',
                    100: '#FCE4E0',
                    200: '#F8C9C0',
                    400: '#E68170',
                    500: '#B8422E',
                    600: '#9A3622',
                    900: '#3D150C',
                    neutral: '#F7F5F2',
                    surface: '#FFFFFF',
                    variant: '#F0EEEA',
                    outline: '#D1CDC5',
                    primary: '#1A1C1E',
                    secondary: '#6C7278',
                },
                glass: {
                    border: 'rgba(255, 255, 255, 0.2)',
                    darkBorder: 'rgba(255, 255, 255, 0.1)',
                }
            },
            animation: {
                'blob': 'blob 15s infinite',
            },
            keyframes: {
                blob: {
                    '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
                    '33%': { transform: 'translate(20px, -30px) scale(1.05)' },
                    '66%': { transform: 'translate(-15px, 15px) scale(0.95)' },
                }
            },
        }
    }
}
