import type { MetadataRoute } from 'next';

/**
 * Makes the web dashboard installable as a desktop app (Windows and macOS: Chrome/Edge "Install", Safari
 * "Add to Dock"). It then opens in its own window with a Start menu / Dock icon. Needs https or localhost.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'MSMA HRIS',
    short_name: 'MSMA HRIS',
    description:
      'HR dashboard for MSMA Solutions: employees, 201 files, approvals and payroll (sample data).',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F6F5F1',
    theme_color: '#1B1D1F',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/app-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app-icon/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: '201 files', url: '/records' },
      { name: 'Approvals', url: '/approvals' },
      { name: 'Employees', url: '/employees' },
    ],
  };
}
