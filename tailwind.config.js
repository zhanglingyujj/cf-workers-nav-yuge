/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/frontend/**/*.{js,html}'],
    theme: {
        extend: {
            fontFamily: {
                sans: [
                    '-apple-system', 'system-ui', '"Segoe UI"', 'Roboto',
                    '"PingFang SC"', '"Microsoft YaHei"', '"Noto Sans SC"',
                    'sans-serif',
                ],
            },
            colors: {
                heritage: {
                    50: '#FAFAFA',
                    100: '#F4F4F5',
                    200: '#E4E4E7',
                    400: '#D4D4D8',
                    500: '#E4E4E7',
                    600: '#FFFFFF',
                    900: '#3F3F46',
                    neutral: '#F7F5F2',
                    surface: '#FFFFFF',
                    variant: '#F0EEEA',
                    outline: '#D1CDC5',
                    primary: '#1A1C1E',
                    secondary: '#6C7278',
                },
                // 暗色模式专属色阶（原 slate/#1e293b token 化，1:1 替换，视觉不变）
                'heritage-dark': {
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    900: '#0f172a',
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
