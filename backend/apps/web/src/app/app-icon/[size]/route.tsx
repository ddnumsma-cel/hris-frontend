import { ImageResponse } from 'next/og';

/** App icons for the installable web app: /app-icon/192, /app-icon/512 and /app-icon/maskable (512, padded). */
const SIZES: Record<string, { px: number; maskable: boolean }> = {
  '192': { px: 192, maskable: false },
  '512': { px: 512, maskable: false },
  maskable: { px: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const spec = SIZES[(await params).size];
  if (!spec) return new Response('Not found', { status: 404 });
  const { px, maskable } = spec;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: maskable ? '#0E6B63' : 'transparent',
      }}
    >
      <div
        style={{
          // Maskable icons keep the letter inside the central safe zone (80%).
          width: maskable ? '64%' : '100%',
          height: maskable ? '64%' : '100%',
          borderRadius: maskable ? 0 : px * 0.2,
          background: '#0E6B63',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: px * (maskable ? 0.42 : 0.6),
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        M
      </div>
    </div>,
    { width: px, height: px },
  );
}
