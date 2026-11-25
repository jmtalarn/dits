import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle at 30% 30%, #38bdf8, #0284c7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: 168,
          fontWeight: 800,
          letterSpacing: '-0.04em',
        }}
      >
        dits
      </div>
    ),
    { ...size }
  );
}
