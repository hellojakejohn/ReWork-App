import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { AFTER_SIGN_IN, safeRedirect } from "@/lib/auth-redirect"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { SignInPanel } from "@/components/auth/sign-in-panel"

export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/auth/signin" },
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  // Already signed in: go where they were headed. Pressing Back into Google replays its
  // one-time callback, which fails ("Callback" error) even though the session is fine.
  const session = await getServerSession(authOptions)
  if (session?.user) {
    const { callbackUrl } = await searchParams
    const base = "http://rework.local"
    const target = new URL(safeRedirect(typeof callbackUrl === "string" ? callbackUrl : AFTER_SIGN_IN, base))
    redirect(target.origin === base ? `${target.pathname}${target.search}` : AFTER_SIGN_IN)
  }
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <SiteHeader links={false} />
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16">
        <Suspense fallback={<div className="h-96 w-full max-w-md rounded-panel bg-surface" />}>
          <SignInPanel />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  )
}
