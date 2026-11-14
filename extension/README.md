# Save to ReWork (Chrome extension)

A toolbar button that reads the job on the open tab (LinkedIn, Indeed, any job page) and
opens ReWork with it. Since 0.2.0 it also fills application forms: after "Apply" on the
Result card, clicking it on the form fills contact details, attaches the tailored resume and
adds the cover letter and saved answers (`src/lib/apply-fill.ts`). It never submits, and never
touches dropdowns, checkboxes or work-authorization, salary or demographic questions. The reader is the same script as the bookmarklet on `/save`
(`src/lib/save-job-script.ts`); ReWork's server never fetches LinkedIn or Indeed.

Permissions: `activeTab`, `scripting`, and one host permission: ReWork itself, to fetch the
user's own application kit with their own login (`/api/apply/packet`, the resume download). The
extension can read or fill a page only after the user clicks the button on it.

Limit: forms inside a frame from another site (a company page embedding a Greenhouse form) are
out of reach with activeTab. Opening the form on its own page (the board's link) works.

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
   - activeTab: "read the job posting, or fill the application form, on the tab when the user clicks the button"
   - scripting: "run the job reader or the form filler on that tab"
   - host permission (rework.hellojakejohn.com): "fetch the user's own application kit from their ReWork account"
   - data: website content, used only to fill in the job in ReWork, never sold
   - privacy policy: https://rework.hellojakejohn.com/privacy
5. Submit. Review usually takes a few days.
