"use client"

import { signIn, getProviders } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FREE_TAILORS_PER_MONTH } from "@/lib/plans"

const ERRORS: Record<string, string> = {
  OAuthSignin: "Google sign-in didn't start. Please try again.",
  OAuthCallback: "Google sign-in didn't finish. Please try again.",
  OAuthCreateAccount: "We couldn't create your account. Please try again.",
  OAuthAccountNotLinked: "That email is already linked to a different sign-in method.",
  Callback: "Sign-in didn't finish. Please try again.",
  SessionRequired: "Sign in to see that page.",
}

export function SignInPanel() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  // Deep link to come back to; the server's redirect callback keeps it same-origin.
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const [providers, setProviders] = useState<Record<string, { id: string; name: string; type: string }> | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    void getProviders().then(setProviders)
  }, [])

  return (
    <div className="w-full max-w-md rounded-panel bg-surface p-8 shadow-float sm:p-10">
      <h1 className="font-serif text-4xl font-medium tracking-tight text-text">Sign in</h1>
      <p className="mt-3 leading-relaxed text-text-secondary">
        Upload your resume once, paste a job link, and get a version written for that job. Nothing made up.
      </p>

      {error && (
        <p role="alert" className="mt-6 rounded-input bg-removed px-4 py-3 text-sm text-text">
          {ERRORS[error] ?? "Sign-in didn't work. Please try again."}
        </p>
      )}

      <div className="mt-8">
        {!providers ? (
          <div className="flex h-12 items-center justify-center" aria-label="Loading">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        ) : providers.google ? (
          <Button
            variant="inverse"
            size="lg"
            className="w-full"
            loading={starting}
            onClick={() => {
              setStarting(true)
              void signIn("google", { callbackUrl })
            }}
          >
            {!starting && (
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continue with Google
          </Button>
        ) : (
          <p className="text-sm text-text-muted">Sign-in isn&apos;t available right now. Please try again in a minute.</p>
        )}
      </div>

      <p className="mt-6 text-sm text-text-muted">New here? The same button creates your account. {FREE_TAILORS_PER_MONTH} free tailors a month, no card.</p>

      <p className="mt-8 border-t border-border pt-6 text-xs leading-relaxed text-text-muted">
        By signing in, you agree to the{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-text">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-text">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  )
}
