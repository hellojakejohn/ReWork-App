import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'

// The page itself is a client component; this keeps its shell from being served to anyone
// who isn't an admin. Every admin API checks again.
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdminEmail(session.user.email)) notFound()
  return children
}
