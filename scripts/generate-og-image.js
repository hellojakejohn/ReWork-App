// Builds public/og-image.png (1200x630): the engraved hero logo on paper with
// "Same you. Better fit." in Newsreader. Run: node scripts/generate-og-image.js
//
// Rendered with next/og (satori + resvg, bundled with Next), which takes the font file
// directly, so the result doesn't depend on fonts installed on the machine.
const fs = require('fs');
const path = require('path');
const { ImageResponse } = require('next/dist/compiled/@vercel/og/index.node.js');

const WIDTH = 1200;
const HEIGHT = 630;
const PAPER = '#FBFAF7';
const FOREST = '#17301F';
const LOGO = path.join(__dirname, '../public/brand/rework-logo-engraved-on-paper.svg');
const FONT = require.resolve('@fontsource/newsreader/files/newsreader-latin-500-normal.woff');
const OUT = path.join(__dirname, '../public/og-image.png');

// The logo's own proportions (1608x575); shown 820px wide.
const LOGO_RATIO = 575 / 1608;
const LOGO_WIDTH = 820;

const h = (type, style, children) => ({ type, props: { style, children } });

async function generateOGImage() {
  const logo = `data:image/svg+xml;base64,${fs.readFileSync(LOGO).toString('base64')}`;
  const card = h(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: PAPER,
    },
    [
      { type: 'img', props: { src: logo, width: LOGO_WIDTH, height: Math.round(LOGO_WIDTH * LOGO_RATIO) } },
      h('div', { marginTop: 14, fontFamily: 'Newsreader', fontSize: 76, letterSpacing: '-0.02em', color: FOREST }, 'Same you. Better fit.'),
    ]
  );

  const response = new ImageResponse(card, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [{ name: 'Newsreader', data: fs.readFileSync(FONT), weight: 500, style: 'normal' }],
  });
  fs.writeFileSync(OUT, Buffer.from(await response.arrayBuffer()));
  console.log(`OG image written to ${path.relative(process.cwd(), OUT)} (${WIDTH}x${HEIGHT})`);
}

generateOGImage().catch((error) => {
  console.error('OG image failed:', error);
  process.exit(1);
});
