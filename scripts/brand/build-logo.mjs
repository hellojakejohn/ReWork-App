// Builds the raster wordmarks in public/brand from the ChatGPT art in
// scripts/brand/rework-logo-source.webp. Run: node scripts/brand/build-logo.mjs
//
// 1. Draws the missing stretch of thread behind the "e" and "w" (the source drops it).
// 2. engraved: the art as is (hero, both themes: dark letters with a cream rim).
// 3. solid: hatching and rim filled in, for the small header logo on light pages.
// 4. solid-dark: solid letters in mist, for the header on dark pages.
// Then run node scripts/generate-og-image.js to refresh the social card.
import sharp from 'sharp'

const SRC = 'scripts/brand/rework-logo-source.webp'
const OUT = 'public/brand'
const WIDTH = 1200 // largest use is ~310 css px wide, so this covers 3x screens

// Bezier through the e and w; ends tuck under the letter rims so the joins don't show.
const THREAD = 'M 350 313 C 400 322, 450 334, 520 330 S 640 298, 720 304 S 860 336, 985 331'
const threadSvg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<path d="${THREAD}" fill="none" stroke="#B4452B" stroke-width="11"/>
<path d="${THREAD}" fill="none" stroke="#DC5436" stroke-width="8"/>
<path d="${THREAD}" fill="none" stroke="#EE7A5A" stroke-width="2" transform="translate(0,-2)" opacity="0.7"/>
</svg>`

// Letters and needle body are this green; the mist is the dark-mode text color.
const FOREST = [31, 46, 36]
const MIST = [234, 241, 234]
// The needle sits in this column; it keeps its own look in every version.
const NEEDLE = [1150, 1275]

const isRed = (r, g, b) => r > g + 40 && r > b + 40
const isDark = (r, g, b) => r + g + b < 260

// Square min/max filter, separable (dilate when max, erode when min).
function morph(mask, w, h, rad, max) {
  const pass = (src, horiz) => {
    const out = new Uint8Array(w * h)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let v = max ? 0 : 1
        for (let k = -rad; k <= rad; k++) {
          const xx = horiz ? x + k : x
          const yy = horiz ? y : y + k
          const s = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : src[yy * w + xx]
          v = max ? Math.max(v, s) : Math.min(v, s)
        }
        out[y * w + x] = v
      }
    return out
  }
  return pass(pass(mask, true), false)
}

const meta = await sharp(SRC).metadata()
const { width: w, height: h } = meta
const base = await sharp(Buffer.from(threadSvg(w, h)))
  .composite([{ input: SRC }])
  .png()
  .toBuffer()
const { data } = await sharp(base).raw().ensureAlpha().toBuffer({ resolveWithObject: true })

// Closing the dark mask fills the thin cream hatch lines but not the rim, which only
// has dark on one side.
const dark = new Uint8Array(w * h)
for (let i = 0; i < w * h; i++) {
  const [r, g, b, a] = data.subarray(i * 4, i * 4 + 4)
  dark[i] = a > 128 && isDark(r, g, b) ? 1 : 0
}
const closed = morph(morph(dark, w, h, 4, true), w, h, 4, false)
// A little wider, so the soft inner edge of the rim goes too.
const body = morph(closed, w, h, 2, true)

const recolor = (fill) => {
  const out = Buffer.from(data)
  for (let i = 0; i < w * h; i++) {
    const x = i % w
    if (x >= NEEDLE[0] && x <= NEEDLE[1]) continue
    const p = i * 4
    if (out[p + 3] === 0) continue
    // Inside a letter everything goes (the source lets the thread show through the
    // hatching). Outside, the rim takes the fill and the thread stays.
    if (body[i]) out[p + 3] = 255
    else if (isRed(out[p], out[p + 1], out[p + 2])) continue
    out[p] = fill[0]; out[p + 1] = fill[1]; out[p + 2] = fill[2]
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
}

const save = (img, name) =>
  img.resize({ width: WIDTH }).webp({ quality: 90, alphaQuality: 100 }).toFile(`${OUT}/${name}.webp`)

await save(sharp(base), 'rework-logo-engraved')
await save(recolor(FOREST), 'rework-logo')
await save(recolor(MIST), 'rework-logo-dark')
console.log(`built ${w}x${h} -> ${OUT}/rework-logo{,-dark,-engraved}.webp`)
