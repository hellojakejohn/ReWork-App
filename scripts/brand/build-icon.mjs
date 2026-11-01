// Builds the app icon, favicon and extension icons from the wordmark art: the needle and
// thread loop that stand in for the "o" (scripts/brand/rework-logo-source.webp), on a
// rounded square, with the thread running out to both sides. Sizes of 48 px and under get
// a bolder thread so the loop still reads in a browser tab.
// Run: node scripts/brand/build-icon.mjs
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

const SOURCE = 'scripts/brand/rework-logo-source.webp'
// Source columns holding only the needle, its loop and the thread (no letters).
const CROP = { left: 1048, top: 0, width: 310, height: 714 }
// Columns of the crop that hold the needle; anything else that isn't thread is a letter edge.
const NEEDLE_X = [60, 250]
// Where the thread leaves the crop, in source pixels from the top, and the needle's middle.
const THREAD_LEFT_Y = 331
const THREAD_RIGHT_Y = 336
const NEEDLE_MID_Y = (24 + 685) / 2

const SIZE = 1024
const BG = '#FBFAF7'
const THREAD = [180, 69, 43]
const isRed = (r, g, b) => r > g + 40 && r > b + 40

// The needle crop, letter edges removed; `bold` widens the thread by that many source px.
async function needleArt(bold) {
  const { data, info } = await sharp(SOURCE).extract(CROP).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const red = new Uint8Array(w * h)
  for (let p = 0; p < w * h; p++) {
    const i = p * 4
    const x = p % w
    if (data[i + 3] > 60 && isRed(data[i], data[i + 1], data[i + 2])) red[p] = 1
    else if (x < NEEDLE_X[0] || x > NEEDLE_X[1]) data[i + 3] = 0
  }
  if (bold) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let hit = false
        for (let dy = -bold; dy <= bold && !hit; dy++) {
          for (let dx = -bold; dx <= bold && !hit; dx++) {
            const yy = y + dy
            const xx = x + dx
            if (dx * dx + dy * dy <= bold * bold && yy >= 0 && yy < h && xx >= 0 && xx < w && red[yy * w + xx]) hit = true
          }
        }
        if (hit) {
          const i = (y * w + x) * 4
          data.set([...THREAD, 255], i)
        }
      }
    }
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
}

async function render({ scale, bold = 0 }) {
  const art = Math.round(CROP.width * scale)
  const artH = Math.round(CROP.height * scale)
  const artLeft = Math.round((SIZE - art) / 2)
  const artTop = Math.round(SIZE / 2 - NEEDLE_MID_Y * scale)
  const yL = artTop + THREAD_LEFT_Y * scale
  const yR = artTop + THREAD_RIGHT_Y * scale
  const xL = artLeft + 8
  const xR = artLeft + art - 8
  const width = 9 + bold * 2

  // Same three strokes as the wordmark's thread (build-logo.mjs), scaled with the art.
  const thread = (d) => `
    <path d="${d}" fill="none" stroke="#B4452B" stroke-width="${width * scale}" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#DC5436" stroke-width="${(width - 3) * scale}" stroke-linecap="round"/>
    ${bold ? '' : `<path d="${d}" fill="none" stroke="#EE7A5A" stroke-width="${2 * scale}" stroke-linecap="round" transform="translate(0 ${-2 * scale})"/>`}`
  const left = `M ${xL} ${yL} C ${xL - 80} ${yL + 24}, 230 ${yL + 30}, 110 ${yL + 6}`
  const right = `M ${xR} ${yR} C ${xR + 80} ${yR + 24}, 794 ${yR + 20}, 914 ${yR - 6}`

  const base = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <rect width="${SIZE}" height="${SIZE}" rx="225" fill="${BG}"/>
    ${thread(left)}
    ${thread(right)}
  </svg>`)
  const needle = await sharp(await needleArt(bold)).resize(art, artH).png().toBuffer()
  const top = Math.max(0, artTop)
  const clipped = await sharp(needle).extract({ left: 0, top: top - artTop, width: art, height: Math.min(artH - (top - artTop), SIZE - top) }).toBuffer()
  return sharp(base).composite([{ input: clipped, left: artLeft, top }]).png().toBuffer()
}

const icon = await render({ scale: 1.25 })
const small = await render({ scale: 1.42, bold: 7 })
const png = (size) => sharp(size <= 48 ? small : icon).resize(size, size).png().toBuffer()

writeFileSync('public/brand/rework-icon-512.png', await png(512))
writeFileSync('public/brand/rework-icon-192.png', await png(192))
writeFileSync('src/app/apple-icon.png', await png(180))
writeFileSync('src/app/icon.png', await png(512))
for (const s of [16, 32, 48, 128]) writeFileSync(`extension/icons/icon-${s}.png`, await png(s))

// favicon.ico: 16, 32 and 48 px PNGs in one ICO container.
const sizes = [16, 32, 48]
const images = await Promise.all(sizes.map(png))
const header = Buffer.alloc(6 + 16 * sizes.length)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
sizes.forEach((s, i) => {
  const e = 6 + 16 * i
  header.writeUInt8(s, e)
  header.writeUInt8(s, e + 1)
  header.writeUInt16LE(1, e + 4)
  header.writeUInt16LE(32, e + 6)
  header.writeUInt32LE(images[i].length, e + 8)
  header.writeUInt32LE(offset, e + 12)
  offset += images[i].length
})
writeFileSync('src/app/favicon.ico', Buffer.concat([header, ...images]))

console.log('icons written')
