// DELETE { confirm: "DELETE" } -> cancels any live Stripe subscription, deletes stored
// files, then deletes the user (see deleteAccount in src/lib/account.ts). The client
// signs out afterwards; the session row is already gone by cascade.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AccountDeletionError, deleteAccount } from '@/lib/account'

export const runtime = 'nodejs'

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => null)
  if (body?.confirm !== 'DELETE') {
    return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 })
  }
  try {
    const result = await deleteAccount(session.user.id)
    return NextResponse.json({ success: true, canceledSubscriptions: result.canceledSubscriptions.length })
  } catch (error) {
    if (error instanceof AccountDeletionError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status })
    }
    console.error('[account] delete failed:', error)
    return NextResponse.json({ error: 'Something went wrong deleting your account. Nothing was charged. Please try again.' }, { status: 500 })
  }
}
