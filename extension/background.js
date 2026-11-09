// Click the toolbar button:
// - On an application form, right after pressing Apply in ReWork: fill the form with that
//   job's application kit (apply-fill.js). The person checks it and submits it themselves.
// - Anywhere else: read the job on this tab (save-job.js, the same script as the bookmarklet)
//   and open ReWork's /save page with it in a new tab next to this one.
// activeTab only: the extension can read or fill a page only when the user clicks it there.
// Its one host permission is ReWork itself, to fetch the user's own kit with their own login.
const ORIGIN = "https://rework.hellojakejohn.com"
const SAVE_PREFIX = ORIGIN + "/save#job="

async function getPacket() {
  try {
    const res = await fetch(ORIGIN + "/api/apply/packet", { credentials: "include", cache: "no-store" })
    if (!res.ok) return null
    const data = await res.json()
    return data && data.packet ? data.packet : null
  } catch (e) {
    return null
  }
}

async function resumeFile(packet) {
  try {
    const url = ORIGIN + "/api/resumes/" + encodeURIComponent(packet.resumeId) + "/download?template=classic&applicationId=" + encodeURIComponent(packet.applicationId)
    const res = await fetch(url, { credentials: "include" })
    if (!res.ok) return undefined
    const bytes = new Uint8Array(await res.arrayBuffer())
    let bin = ""
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    const name = (packet.contact.fullName || "Resume").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") + "_Resume.pdf"
    return { name: name, type: "application/pdf", base64: btoa(bin) }
  } catch (e) {
    return undefined
  }
}

async function looksLikeForm(tabId) {
  try {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => document.querySelectorAll('input[type="email"], input[type="tel"], input[type="file"], input[autocomplete*="name"], input[name*="name" i], textarea').length,
    })
    return !!r && r.result >= 2
  } catch (e) {
    return false
  }
}

async function fill(tabId, packet) {
  packet.resume = await resumeFile(packet)
  await chrome.scripting.executeScript({ target: { tabId: tabId }, func: (p) => { window.__reworkPacket = p }, args: [packet] })
  await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ["apply-fill.js"] })
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return
  const packet = await getPacket()
  if (packet && (await looksLikeForm(tab.id))) {
    try {
      await fill(tab.id, packet)
      return
    } catch (e) {
      // Fall through to saving the job.
    }
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["save-job.js"] })
  } catch (e) {
    // Chrome's own pages and the Web Store can't be read by any extension.
    chrome.tabs.create({ url: ORIGIN + "/save", index: tab.index + 1 })
  }
})

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!sender.tab || typeof message?.open !== "string" || !message.open.startsWith(SAVE_PREFIX)) return
  chrome.tabs.create({ url: message.open, index: sender.tab.index + 1 })
})
