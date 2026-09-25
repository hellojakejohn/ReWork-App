// GET ?format=pdf|docx&template=classic|modern: the cover letter as a file, with the same
// header as the resume.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { masterToParsed } from '@/lib/master-resume'
import { CoverLetterPdf } from '@/lib/resume-pdf'
import { coverLetterDocxBuffer, DOCX_MIME } from '@/lib/resume-docx'
import { isTemplateId } from '@/lib/resume-templates'
import { readStoredCoverLetter } from '@/lib/cover-letter-shared'

export const runtime = 'nodejs'

const fileSafe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const { id } = await params
  const format = request.nextUrl.searchParams.get('format') === 'docx' ? 'docx' : 'pdf'
  const templateParam = request.nextUrl.searchParams.get('template')
  const template = isTemplateId(templateParam) ? templateParam : 'classic'

  const application = await prisma.jobApplication.findFirst({
    where: { id, userId: session.user.id },
    select: { company: true, coverLetter: true, optimizedStructured: true, originalContent: true },
  })
  const letter = readStoredCoverLetter(application?.coverLetter)
  if (!application || !letter) {
    return new NextResponse('Cover letter not found', { status: 404 })
  }
  const resume = masterToParsed((application.optimizedStructured ?? application.originalContent ?? {}) as Record<string, unknown>)
  const filename = [fileSafe(resume.contact.fullName) || 'Cover', 'Cover_Letter', fileSafe(application.company)].filter(Boolean).join('_')

  try {
    const buffer =
      format === 'docx'
        ? await coverLetterDocxBuffer(resume, letter.text)
        : Buffer.from(await renderToBuffer(React.createElement(CoverLetterPdf, { resume, template, text: letter.text }) as never))
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': format === 'docx' ? DOCX_MIME : 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.${format}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('❌ Cover letter file failed:', error)
    return new NextResponse('Could not generate the file. Please try again.', { status: 500 })
  }
}
