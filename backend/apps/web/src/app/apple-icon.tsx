import { ImageResponse } from 'next/og';

// Icon used by Safari "Add to Dock" (macOS) and iPhone/iPad home screens.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0E6B63',
        color: '#FFFFFF',
        fontSize: 110,
        fontWeight: 700,
        fontFamily: 'sans-serif',
      }}
    >
      M
    </div>,
    size,
  );
}
