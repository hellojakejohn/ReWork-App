# Print kit for partners

- `one-pager.pdf`: one page for career counselors (what ReWork does, privacy, the free-month
  offer, the free tools). Print it, or attach it to partner emails (`../partners.md`).
- `workshop-deck.pdf`: 11 slides for a 30-minute workshop, "Find real jobs, and tailor your
  resume honestly" (library or workforce center). Two live demos: `/check` and a tailor.
  Bring a real job link and a sample resume in case the room has no laptops.

The free-month line assumes a partner code (`PARTNERS` in `src/lib/partner-rules.ts`). Ask
Claude to add the partner's code before handing these out, and write their link on the page:
`rework.careers/?ref=<code>`.

To change them, edit the `.html` file and print again:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer --print-to-pdf=one-pager.pdf one-pager.html
```
