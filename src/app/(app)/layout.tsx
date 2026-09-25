import { Toaster } from 'sonner'
import { Providers } from '@/components/providers'

// Pages that need the session (dashboard, tracker, pricing, sign-in, admin). The public
// pages (landing, terms, privacy) sit outside this group so they ship no auth JS.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      {children}
      <Toaster position="top-center" richColors theme="dark" expand={false} closeButton offset={20} />
    </Providers>
  )
}
