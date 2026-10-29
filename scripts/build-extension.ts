// Builds the Chrome extension: extension/ plus save-job.js (the bookmarklet script for the
// production origin) into extension-dist/, zipped as extension-dist.zip for the Web Store.
// Run: npx tsx scripts/build-extension.ts
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { saveJobScript } from '../src/lib/save-job-script'

const ORIGIN = 'https://rework.hellojakejohn.com'
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'extension-dist')
const zip = path.join(root, 'extension-dist.zip')

rmSync(out, { recursive: true, force: true })
rmSync(zip, { force: true })
mkdirSync(out)
// README and store/ (listing images) are for us, not the package.
const skip = ['README.md', 'store']
cpSync(path.join(root, 'extension'), out, {
  recursive: true,
  filter: (src) => !skip.includes(path.relative(path.join(root, 'extension'), src).split(path.sep)[0]),
})
writeFileSync(path.join(out, 'save-job.js'), saveJobScript(ORIGIN))
execFileSync('zip', ['-qr', zip, '.'], { cwd: out })
console.log(`Built ${path.relative(root, out)}/ and ${path.relative(root, zip)}`)
