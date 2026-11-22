// GET /api/og/share?k=fit&s=40&f=5&o=1&m=8 (or k=tailor&b=40&a=63&n=9) -> a 1200x630 PNG
// share card: the score on a cloth tape measure, in the brand colors and type. Public,
// numbers only (src/lib/share.ts), cached for a day.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { parseShare, shareHeadline, type ShareCard } from '@/lib/share'

export const runtime = 'nodejs'

const PAPER = '#FBFAF7'
const FOREST = '#17301F'
const SECONDARY = '#3D5444'
const ACCENT = '#C23D22'
const SUCCESS = '#2E7D4F'
const SAGE = '#DCE8DE'
const TAPE = '#F7ECC4'

const font = (file: string) => readFile(join(process.cwd(), 'src/lib/fonts', file))

function Tape({ value, from }: { value: number; from?: number }) {
  const width = 1072
  const at = (n: number) => Math.round((Math.max(0, Math.min(100, n)) / 100) * width)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width }}>
      <div style={{ display: 'flex', position: 'relative', width, height: 78, background: TAPE, border: `2px solid rgba(23,48,31,0.18)`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: at(value), background: 'rgba(46,125,79,0.28)' }} />
        {from !== undefined && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: at(Math.min(from, value)), background: 'rgba(23,48,31,0.12)' }} />}
        {Array.from({ length: 101 }, (_, i) => (
          <div
            key={i}
            style={{ position: 'absolute', left: at(i), top: 0, width: 2, height: i % 10 === 0 ? 40 : i % 5 === 0 ? 28 : 18, background: 'rgba(23,48,31,0.4)' }}
          />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <div key={`n${i}`} style={{ position: 'absolute', left: at(i * 10) + 6, bottom: 6, fontSize: 18, color: 'rgba(23,48,31,0.7)', fontFamily: 'Arimo' }}>
            {String(i * 10)}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', position: 'relative', height: 26 }}>
        <svg width="30" height="22" viewBox="0 0 30 22" style={{ position: 'absolute', left: at(value) - 15, top: 0 }}>
          <polygon points="15,0 30,22 0,22" fill={ACCENT} />
        </svg>
      </div>
    </div>
  )
}

function Card({ card }: { card: ShareCard }) {
  const fit = card.kind === 'fit'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: PAPER, padding: '56px 64px', fontFamily: 'Arimo', color: FOREST }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'Tinos', fontSize: 48, fontWeight: 700, letterSpacing: -1 }}>ReWork</div>
        <div style={{ display: 'flex', background: fit ? SAGE : 'rgba(46,125,79,0.14)', color: fit ? FOREST : SUCCESS, padding: '10px 22px', borderRadius: 999, fontSize: 24, fontWeight: 700 }}>
          {fit ? 'Free fit check' : 'Invented: 0'}
        </div>
      </div>
      <div style={{ display: 'flex', marginTop: 46, fontFamily: 'Tinos', fontSize: 86, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>{shareHeadline(card)}</div>
      <div style={{ display: 'flex', marginTop: 18, fontSize: 30, color: SECONDARY }}>
        {fit
          ? `${card.fits} fit · ${card.otherWords} in other words · ${card.alterations} need alterations`
          : `${card.kept} improvements, every one checked against the real resume`}
      </div>
      <div style={{ display: 'flex', marginTop: 56 }}>
        <Tape value={fit ? card.score : card.after} from={fit ? undefined : card.before} />
      </div>
      <div style={{ display: 'flex', marginTop: 'auto', fontSize: 28, fontWeight: 700, color: ACCENT }}>
        {fit ? 'Take your measurements at rework.careers/fit' : 'Same you. Better fit. rework.careers'}
      </div>
    </div>
  )
}

export async function GET(request: Request) {
  const card = parseShare(new URL(request.url).searchParams)
  if (!card) return new Response('Bad card', { status: 400 })
  const [tinos, arimo, arimoBold] = await Promise.all([font('Tinos_700Bold.ttf'), font('Arimo_400Regular.ttf'), font('Arimo_700Bold.ttf')])
  return new ImageResponse(<Card card={card} />, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Tinos', data: tinos, weight: 700, style: 'normal' },
      { name: 'Arimo', data: arimo, weight: 400, style: 'normal' },
      { name: 'Arimo', data: arimoBold, weight: 700, style: 'normal' },
    ],
    headers: { 'cache-control': 'public, max-age=86400, s-maxage=86400, immutable' },
  })
}
