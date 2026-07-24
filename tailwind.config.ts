import type { Config } from 'tailwindcss';

const config: Config = {
    content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                ink: '#0f0f10',
            },
        },
    },
    plugins: [],
};

export default config;
