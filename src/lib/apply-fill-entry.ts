// Extension entry (bundled to extension-dist/apply-fill.js). The background script first sets
// window.__reworkPacket on the application page, then runs this file there.
import { fillPage, showBanner, type ApplyPacket } from './apply-fill'

const w = window as unknown as { __reworkPacket?: ApplyPacket }
if (w.__reworkPacket) {
  showBanner(document, fillPage(document, w.__reworkPacket))
  delete w.__reworkPacket
}
