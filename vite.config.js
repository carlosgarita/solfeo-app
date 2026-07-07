import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
            // El plugin genera un `virtual:pwa-register` que registramos desde main.tsx.
            injectRegister: false,
            injectManifest: {
                // Precacheamos todo lo que salga en /dist (JS, CSS, HTML, íconos, fuentes).
                globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,webmanifest}'],
                // VexFlow puede ser grande; damos margen (5 MiB).
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            },
            manifest: {
                name: 'Solfeo · Práctica musical',
                short_name: 'Solfeo',
                description: 'App de práctica de solfeo: notas, ritmos y melodías con reproducción de audio.',
                theme_color: '#0b1020',
                background_color: '#0b1020',
                display: 'standalone',
                orientation: 'portrait',
                lang: 'es',
                start_url: '/',
                scope: '/',
                icons: [
                    {
                        src: '/icons/pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: '/icons/pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: '/icons/pwa-maskable-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                    {
                        src: '/icons/apple-touch-icon.png',
                        sizes: '180x180',
                        type: 'image/png',
                        purpose: 'any',
                    },
                ],
                categories: ['education', 'music'],
            },
            devOptions: {
                enabled: false,
            },
        }),
    ],
    server: {
        port: 5173,
        strictPort: true,
        open: true,
    },
});
