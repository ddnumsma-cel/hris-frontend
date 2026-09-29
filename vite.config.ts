import { defineConfig } from 'vite'
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

// https://vite.dev/config/
export default defineConfig({
  server: { https },
  preview: { https },
  plugins: [
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
