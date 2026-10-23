import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema
const feedbackSchema = z.object({
  type: z.enum(['BUG_REPORT', 'FEATURE_REQUEST', 'GENERAL_FEEDBACK']),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000, 'Message too long'),
  email: z.string().email().optional().or(z.literal('')),
  pageUrl: z.string().url(),
})

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    
    // Validate input
    const validation = feedbackSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { type, message, email, pageUrl } = validation.data

    // Get user agent from request headers
    const userAgent = request.headers.get('user-agent') || undefined

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Create feedback entry
    const feedback = await prisma.feedback.create({
      data: {
        userId: user.id,
        type,
        message,
        email: email || null,
        pageUrl,
        userAgent,
      },
    })

    // Optional: Send email notification to admin (implement if needed)
    // await sendAdminNotification(feedback)

    return NextResponse.json(
      { 
        message: 'Feedback submitted successfully',
        id: feedback.id 
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Feedback submission error:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Optional: Admin endpoint to fetch feedback (implement later if needed)
  return NextResponse.json(
    { error: 'Method not implemented' },
    { status: 501 }
  )
}