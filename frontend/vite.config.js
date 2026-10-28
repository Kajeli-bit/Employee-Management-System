import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'nilric-logo.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Nilric Employee Management System',
        short_name: 'Nilric EMS',
        description: 'Secure employee, attendance and company management for Nilric.',
        start_url: '/login',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#f7f3fa',
        theme_color: '#4a266a',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{html,js,css,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Clerk sessions and authenticated EMS responses are private and
            // must never be persisted by the service worker.
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
            options: { cacheName: 'ems-private-api' },
          },
          {
            // Cache only same-origin versioned build assets, not user content.
            urlPattern: ({ request, url }) =>
              url.origin === self.location.origin &&
              request.method === 'GET' &&
              url.pathname.startsWith('/assets/') &&
              (request.destination === 'script' || request.destination === 'style' || request.destination === 'font' || request.destination === 'image') &&
              /\.(?:js|css|woff2|svg|png)$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ems-static-assets',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
