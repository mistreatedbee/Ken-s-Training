import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = "Ken's Training Institute"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const logoUrl = 'https://ken-s-training-nine.vercel.app/kti-logo.png'

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1210 0%, #3a2210 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
        }}
      >
        <img
          src={logoUrl}
          width={560}
          height={246}
          style={{ borderRadius: 16, objectFit: 'contain', background: 'white', padding: '24px 32px' }}
        />
        <div
          style={{
            marginTop: 36,
            fontSize: 46,
            fontWeight: 800,
            color: 'white',
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          Apply Online for Our Courses
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 26,
            color: 'rgba(255,255,255,0.72)',
            textAlign: 'center',
            maxWidth: 820,
          }}
        >
          A simple, step-by-step application. Everyone is welcome.
        </div>
        <div
          style={{
            marginTop: 40,
            background: 'rgba(232,89,12,0.85)',
            borderRadius: 40,
            padding: '12px 32px',
            fontSize: 20,
            color: 'white',
            fontWeight: 600,
          }}
        >
          ken-s-training-nine.vercel.app
        </div>
      </div>
    ),
    { ...size },
  )
}
