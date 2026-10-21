import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import fs from 'node:fs'

// Local mkcert-issued cert so phones on the LAN see a trusted HTTPS origin —
// iOS Safari requires a secure context for getUserMedia (face scan).
const certKeyPath = path.resolve(import.meta.dirname, '.certs/key.pem')
const certPath = path.resolve(import.meta.dirname, '.certs/cert.pem')
const https =
  fs.existsSync(certKeyPath) && fs.existsSync(certPath)
    ? { key: fs.readFileSync(certKeyPath), cert: fs.readFileSync(certPath) }
    : undefined

// A browser that once opened a build (npm run preview / an installed app) keeps its service worker,
// which goes on serving that old build. The dev server would answer the worker's update check
// (/sw.js) with the app's HTML, so the old worker could never be replaced. In dev, answer with a
// worker that clears its caches, removes itself and reloads the open tabs onto the dev server.
const SW_RESET = `
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key)
    await self.registration.unregister()
    for (const tab of await self.clients.matchAll({ type: 'window' })) tab.navigate(tab.url)
  })())
})
`
const resetOldServiceWorker = (): Plugin => ({
  name: 'reset-old-service-worker',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] !== '/sw.js') return next()
      res.setHeader('Content-Type', 'text/javascript')
      res.setHeader('Cache-Control', 'no-cache')
      res.end(SW_RESET)
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  // With VITE_API_URL=/api the app reaches the MSMA HRIS backend through this server (no CORS, and it
  // works from other PCs too); HEYHR_API_TARGET says where the backend runs.
  server: { https, proxy: { '/api': { target: process.env.HEYHR_API_TARGET ?? 'http://127.0.0.1:4000', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') } } },
  preview: { https },
  plugins: [
    resetOldServiceWorker(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-64.png', 'brand/msma-mark.png'],
      manifest: {
        name: 'MSMA',
        short_name: 'MSMA',
        description: 'People operations for MSMA Group — leave, payroll, attendance, and compliance.',
        theme_color: '#0e1835',
        background_color: '#0e1835',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
