import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { burnConfig } from "@/lib/token-burn"
import { BurnView } from "@/components/token/burn-view"

// /dashboard/token: burn $REWORK for Pro. Linked from /token only, never from the product flow.
export const dynamic = "force-dynamic"

export default async function BurnPage() {
  if (!burnConfig()) notFound()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/dashboard/token")
  return <BurnView />
}
