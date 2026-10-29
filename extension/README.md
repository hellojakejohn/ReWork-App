# Save to ReWork (Chrome extension)

A toolbar button that reads the job on the open tab (LinkedIn, Indeed, any job page) and
opens ReWork with it. The reader is the same script as the bookmarklet on `/save`
(`src/lib/save-job-script.ts`); ReWork's server never fetches LinkedIn or Indeed.

Permissions: `activeTab` and `scripting` only. The extension can read a page only after the
user clicks the button on it, and it only opens `https://rework.hellojakejohn.com/save#job=...`.

## Build

```bash
npx tsx scripts/build-extension.ts
```

Output: `extension-dist/` (load it unpacked) and `extension-dist.zip` (upload it). Both are
gitignored. Bump `version` in `manifest.json` before each upload.

## Try it locally

1. Chrome, `chrome://extensions`, turn on Developer mode.
2. Load unpacked, pick `extension-dist/`.
3. Open a LinkedIn or Indeed job, click the ReWork icon (pin it from the puzzle menu).

## Publish (Jake)

1. Register at the Chrome Web Store developer dashboard ($5 one-time).
2. New item, upload `extension-dist.zip`.
3. Listing: name "Save to ReWork", category Productivity, the screenshot
   `store/screenshot-1280x800.png`, the 128px
   icon (`icons/icon-128.png`).
4. Privacy tab:
   - single purpose: "Save the job posting on the current tab into ReWork"
   - activeTab: "read the job posting on the tab when the user clicks the button"
   - scripting: "run the job reader on that tab"
   - data: website content, used only to fill in the job in ReWork, never sold
   - privacy policy: https://rework.hellojakejohn.com/privacy
5. Submit. Review usually takes a few days.
