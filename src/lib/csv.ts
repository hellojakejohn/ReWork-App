// One CSV field, safe to open in Excel/Sheets. Pure.
// Quotes are doubled, and a value starting with = + - @ (or a tab/CR) gets a leading '
// so a Google account named "=HYPERLINK(...)" can't run as a formula on the admin's machine.
export function csvField(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}
