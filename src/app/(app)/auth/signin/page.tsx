import type { Metadata } from "next"
import { Suspense } from "react"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { SignInPanel } from "@/components/auth/sign-in-panel"

export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/auth/signin" },
}

export default function SignInPage() {
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
