// GET /api/og/check -> the 1200x630 social card for /check (the free job checker), in the
// brand colors and type. Static, cached for a day.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

const PAPER = '#FBFAF7'
const FOREST = '#17301F'
const SECONDARY = '#3D5444'
const ACCENT = '#C23D22'
const SUCCESS = '#2E7D4F'
const TAPE = '#F7ECC4'

const font = (file: string) => readFile(join(process.cwd(), 'src/lib/fonts', file))

const ROWS: { mark: string; color: string; text: string }[] = [
  { mark: '?', color: SUCCESS, text: "Still on the employer's own job board?" },
  { mark: '!', color: ACCENT, text: 'Scam signs: money, ID, chat apps, crypto' },
  { mark: '!', color: '#875A00', text: 'Ghost-job signs: old, reposted, no pay, agency' },
]

function Card() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 1200, height: 630, background: PAPER, padding: '64px 72px', fontFamily: 'Arimo' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', background: TAPE, color: FOREST, fontSize: 24, fontWeight: 700, padding: '8px 18px', borderRadius: 999 }}>
          Free. No sign-up. Nothing saved.
        </div>
      </div>
      <div style={{ display: 'flex', marginTop: 28, fontFamily: 'Tinos', fontSize: 104, fontWeight: 700, color: FOREST, lineHeight: 1 }}>Is this job real?</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 44 }}>
        {ROWS.map((r) => (
          <div key={r.text} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 999, background: r.color, color: '#FFFFFF', fontSize: 30, fontWeight: 700 }}>
              {r.mark}
            </div>
            <div style={{ display: 'flex', fontSize: 36, color: SECONDARY }}>{r.text}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: 'auto', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: FOREST }}>rework.careers/check</div>
        <div style={{ display: 'flex', fontFamily: 'Tinos', fontSize: 40, fontWeight: 700, color: FOREST }}>
          <span style={{ color: '#8FA295' }}>re</span>work
        </div>
      </div>
    </div>
  )
}

export async function GET() {
  const [tinos, arimo, arimoBold] = await Promise.all([font('Tinos_700Bold.ttf'), font('Arimo_400Regular.ttf'), font('Arimo_700Bold.ttf')])
  return new ImageResponse(<Card />, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Tinos', data: tinos, weight: 700, style: 'normal' },
      { name: 'Arimo', data: arimo, weight: 400, style: 'normal' },
      { name: 'Arimo', data: arimoBold, weight: 700, style: 'normal' },
    ],
    headers: { 'cache-control': 'public, max-age=86400, s-maxage=86400' },
  })
}
