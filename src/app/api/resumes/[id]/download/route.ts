// GET /api/resumes/[id]/download?template=classic|modern[&applicationId=...][&format=pdf|docx]
// PDF (default) or Word file of the master, or of one tailored version (JobApplication)
// made from it. Word is always the Classic structure (see src/lib/resume-docx.ts).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { masterToParsed } from '@/lib/master-resume'
import { ResumePdf } from '@/lib/resume-pdf'
import { isTemplateId } from '@/lib/resume-templates'
import { DOCX_MIME, resumeDocxBuffer } from '@/lib/resume-docx'

export const runtime = 'nodejs'

const fileSafe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const { id } = await params
  const applicationId = request.nextUrl.searchParams.get('applicationId')
  const templateParam = request.nextUrl.searchParams.get('template')
  const template = isTemplateId(templateParam) ? templateParam : 'classic'
  const format = request.nextUrl.searchParams.get('format') === 'docx' ? 'docx' : 'pdf'

  const resume = await prisma.resume.findFirst({ where: { id, userId: session.user.id } })
  if (!resume) {
    return new NextResponse('Resume not found', { status: 404 })
  }

  let source: Record<string, unknown> = resume
  let company = ''
  if (applicationId) {
    const application = await prisma.jobApplication.findFirst({
      where: { id: applicationId, resumeId: resume.id, userId: session.user.id },
      select: { company: true, optimizedStructured: true },
    })
    if (!application?.optimizedStructured) {
      return new NextResponse('Tailored version not found', { status: 404 })
    }
    source = application.optimizedStructured as Record<string, unknown>
    company = application.company
  }

  const parsed = masterToParsed(source)
  const baseName = [fileSafe(parsed.contact.fullName) || 'Resume', 'Resume', fileSafe(company)].filter(Boolean).join('_')
  if (format === 'docx') {
    try {
      const buffer = await resumeDocxBuffer(parsed)
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': DOCX_MIME,
          'Content-Disposition': `attachment; filename="${baseName}.docx"`,
          'Cache-Control': 'no-store',
        },
      })
    } catch (error) {
      console.error('❌ DOCX generation failed:', error)
      return new NextResponse('Could not generate the Word file. Please try again.', { status: 500 })
    }
  }
  try {
    const buffer = await renderToBuffer(React.createElement(ResumePdf, { resume: parsed, template }) as never)
    const filename = `${baseName}.pdf`
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('❌ PDF generation failed:', error)
    return new NextResponse('Could not generate the PDF. Please try again.', { status: 500 })
  }
}
