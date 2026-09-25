"use client"

import { signIn, getProviders } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { Logo } from "@/components/ui/logo"

function SignInContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const [providers, setProviders] = useState<Record<string, { id: string; name: string; type: string }> | null>(null)

  useEffect(() => {
    document.title = "Sign In - ReWork"
    async function loadProviders() {
      const res = await getProviders()
      setProviders(res)
    }
    loadProviders()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-black relative overflow-hidden bg-dots-sm">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <Card className="w-full max-w-md bg-gray-900/50 backdrop-blur-xl border border-gray-800 shadow-2xl">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="mx-auto mb-2">
              <Logo size="small" variant="simple" className="mx-auto" badgePosition="none" />
            </div>
            <CardTitle className="text-3xl font-bold text-white">Welcome to ReWork</CardTitle>
            <CardDescription className="text-gray-400">
              Sign in to start optimizing your resumes with AI
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm backdrop-blur-sm">
                {error === 'OAuthSignin' && 'Error with OAuth sign in'}
                {error === 'OAuthCallback' && 'Error in OAuth callback'}
                {error === 'OAuthCreateAccount' && 'Could not create OAuth account'}
                {error === 'EmailCreateAccount' && 'Could not create email account'}
                {error === 'Callback' && 'Error in callback'}
                {error === 'OAuthAccountNotLinked' && 'Account already exists with different provider'}
                {error === 'EmailSignin' && 'Check your email for sign in link'}
                {error === 'CredentialsSignin' && 'Invalid credentials'}
                {error === 'SessionRequired' && 'Please sign in to access this page'}
              </div>
            )}

            {providers ? (
              <div className="space-y-3">
                {providers.google && (
                  <Button
                    onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                    className="w-full bg-white text-black hover:bg-white/90 border-0 h-12 font-medium text-base transition-all hover:shadow-lg hover:shadow-white/20"
                    size="lg"
                  >
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                )}

                {!providers.google && (
                  <div className="text-center text-gray-500 text-sm">
                    Loading authentication providers...
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-800">
              By signing in, you agree to our{' '}
              <a href="/terms" className="underline hover:text-gray-400">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="underline hover:text-gray-400">
                Privacy Policy
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  )
}