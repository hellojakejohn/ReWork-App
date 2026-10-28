"use client"

import { CONTACT_EMAIL } from "@/lib/plans"

// Last resort when the root layout itself fails: no fonts, tokens or components can be
// trusted here, so it is plain HTML with inline styles in the brand colors.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#FBFAF7", color: "#17301F", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 16px" }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: 36, margin: 0 }}>Something broke on our side.</h1>
          <p style={{ lineHeight: 1.6 }}>
            Nothing you saved is lost. Try again in a minute, and if it keeps happening, email {CONTACT_EMAIL}
            {error.digest ? ` with code ${error.digest}` : ""}.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 16, padding: "12px 20px", borderRadius: 999, border: 0, background: "#17301F", color: "#FBFAF7", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
