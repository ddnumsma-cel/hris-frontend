import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  title: 'MSMA HRIS',
  description: 'MSMA HRIS HR dashboard (sample, synthetic data)',
  applicationName: 'MSMA HRIS',
  icons: { icon: '/app-icon/192' },
  appleWebApp: { capable: true, title: 'MSMA HRIS', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F5F1' },
    { media: '(prefers-color-scheme: dark)', color: '#111315' },
  ],
};

// Applies the saved appearance before first paint so the page never flashes the wrong theme.
const appearanceScript = `try{var p=JSON.parse(localStorage.getItem('msma-prefs')||'{}');var t=p.theme||'LIGHT';var d=t==='DARK'||(t==='SYSTEM'&&matchMedia('(prefers-color-scheme: dark)').matches);var h=document.documentElement;if(d)h.classList.add('dark');h.dataset.textSize=p.textSize||'STANDARD';h.dataset.density=p.tableDensity||'COMFORTABLE'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-PH"
      className={`${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
