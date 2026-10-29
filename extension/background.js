// Click the toolbar button: read the job on this tab (save-job.js, the same script as the
// bookmarklet) and open ReWork's /save page with it in a new tab next to this one.
// activeTab only: the extension can read a page only when the user clicks it there.
const SAVE_PREFIX = "https://rework.hellojakejohn.com/save#job="

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["save-job.js"] })
  } catch {
    // Chrome's own pages and the Web Store can't be read by any extension.
    chrome.tabs.create({ url: "https://rework.hellojakejohn.com/save", index: tab.index + 1 })
  }
})

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!sender.tab || typeof message?.open !== "string" || !message.open.startsWith(SAVE_PREFIX)) return
  chrome.tabs.create({ url: message.open, index: sender.tab.index + 1 })
})
