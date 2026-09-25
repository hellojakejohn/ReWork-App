// Admin allowlist from ADMIN_EMAILS (comma separated). Server only.
const DEFAULT_ADMIN_EMAILS = ['hellojakejohn@gmail.com', 'jakobmjohnson9@gmail.com']

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS
  if (!raw || !raw.trim()) return DEFAULT_ADMIN_EMAILS
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && getAdminEmails().includes(email.toLowerCase())
}
