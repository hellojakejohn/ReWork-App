// src/app/api/resumes/[id]/download/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import PDFResumeDocument from '@/lib/pdf-generator';

// Handle both GET and POST requests
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const applicationId = request.nextUrl.searchParams.get('applicationId') || undefined;
  return handleDownload(request, resolvedParams, { applicationId });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  try {
    const body = await request.json();
    return handleDownload(request, resolvedParams, body);
  } catch (error) {
    console.error('❌ Failed to parse request body:', error);
    return handleDownload(request, resolvedParams, {});
  }
}

async function handleDownload(
  request: NextRequest,
  params: { id: string },
  options: {
    // When set, render that JobApplication's tailored version instead of the master
    applicationId?: string;
    version?: 'original' | 'optimized'; 
    template?: string;
    colors?: { primary: string; accent: string };
    enableOnePageOptimization?: boolean;
  } = {}
) {
  try {
    const { id } = params;
    console.log('🚀 Starting PDF download for resume:', id);
    console.log('📋 Download options:', options);

    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get user with plan information
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    // Get resume with all structured data
    const resume = await prisma.resume.findFirst({
      where: {
        id: id,
        user: { email: session.user.email }
      }
    });

    if (!resume) {
      return new NextResponse('Resume not found', { status: 404 });
    }

    console.log('✅ Resume found:', resume.title);

    // Tailored version lives on the JobApplication; the Resume row is the master
    let application: { company: string; optimizedStructured: unknown } | null = null;
    if (options.applicationId) {
      application = await prisma.jobApplication.findFirst({
        where: { id: options.applicationId, resumeId: resume.id, userId: user.id },
        select: { company: true, optimizedStructured: true }
      });
      if (!application?.optimizedStructured) {
        return new NextResponse('Tailored version not found', { status: 404 });
      }
    }
    const source = (application?.optimizedStructured as Record<string, unknown> | undefined) ?? resume;

    // Determine which version to use
    interface ResumeData {
      contact?: Record<string, unknown>;
      contactInfo?: Record<string, unknown>;
      professionalSummary?: Record<string, unknown>;
      workExperience?: unknown[];
      education?: unknown[];
      skills?: unknown[];
      projects?: unknown[];
      isOptimized?: boolean;
      template?: string;
      colors?: { primary: string; accent: string };
      summary?: string;
    }
    
    let resumeData: ResumeData = {};
    const isOptimized = !!application || options.version === 'optimized' || options.version === undefined;

    console.log('🎯 Using optimized version:', isOptimized);

    if (isOptimized && (source.contactInfo || source.professionalSummary || source.workExperience)) {
      // 🔧 FIXED: Use same parsing logic as preview route
      console.log('📊 Using structured (optimized) resume data with proper parsing');
      
      resumeData = {
        // Parse contactInfo consistently and add contact alias for PDF template compatibility
        contactInfo: source.contactInfo ? (typeof source.contactInfo === 'string' ? JSON.parse(source.contactInfo) : source.contactInfo) : {},
        contact: source.contactInfo ? (typeof source.contactInfo === 'string' ? JSON.parse(source.contactInfo) : source.contactInfo) : {},
        
        // Parse professionalSummary the same way as preview  
        professionalSummary: source.professionalSummary ? (typeof source.professionalSummary === 'string' ? JSON.parse(source.professionalSummary) : source.professionalSummary) : {},
        
        // Parse workExperience the same way as preview
        workExperience: source.workExperience ? (typeof source.workExperience === 'string' ? JSON.parse(source.workExperience) : source.workExperience) : [],
        
        // Parse education the same way as preview
        education: source.education ? (typeof source.education === 'string' ? JSON.parse(source.education) : source.education) : [],
        
        // Parse skills the same way as preview
        skills: source.skills ? (typeof source.skills === 'string' ? JSON.parse(source.skills) : source.skills) : [],
        
        // Parse projects the same way as preview
        projects: source.projects ? (typeof source.projects === 'string' ? JSON.parse(source.projects) : source.projects) : [],
        
        isOptimized: true
      };

      console.log('📋 RAW DATABASE RESUME FIELDS:', {
        workExperienceType: typeof source.workExperience,
        workExperienceContent: JSON.stringify(source.workExperience),
        workExpRawLength: Array.isArray(source.workExperience) ? source.workExperience.length : 'not array'
      });

      console.log('📋 Optimized data parsed:', {
        hasContactInfo: !!resumeData.contactInfo,
        hasProfessionalSummary: !!resumeData.professionalSummary,
        professionalSummaryType: typeof resumeData.professionalSummary,
        professionalSummaryKeys: resumeData.professionalSummary && typeof resumeData.professionalSummary === 'object' ? Object.keys(resumeData.professionalSummary) : 'N/A',
        workExpCount: resumeData.workExperience?.length || 0,
        workExpContent: JSON.stringify(resumeData.workExperience),
        skillsCount: resumeData.skills?.length || 0,
        educationCount: resumeData.education?.length || 0
      });

    } else {
      // Use original content
      console.log('📄 Using original resume content');
      const content = resume.originalContent || resume.currentContent;
      if (!content) {
        return new NextResponse('No resume content', { status: 404 });
      }

      try {
        const contentString = String(content);
        resumeData = JSON.parse(contentString);
        resumeData.isOptimized = false;
      } catch {
        console.log('⚠️ JSON parse failed, using raw content');
        if (typeof content === 'object') {
          resumeData = content as ResumeData;
        } else {
          resumeData = { summary: String(content) };
        }
        resumeData.isOptimized = false;
      }
    }

    // Add template and colors information
    const template = options.template || 'professional';
    const colors = options.colors || getDefaultColors(template);

    resumeData.template = template;
    resumeData.colors = colors;

    console.log('📄 Creating PDF with template:', template);
    console.log('🎨 Using colors:', colors);
    console.log('🎯 Data keys:', Object.keys(resumeData));
    console.log('🎯 Final isOptimized flag:', resumeData.isOptimized);

    // 🔧 FIXED: Ensure we pass the exact same data structure as preview
    console.log('🎯 Contact data sample:', resumeData.contactInfo ? JSON.stringify(resumeData.contactInfo).substring(0, 100) : 'none');
    console.log('🎯 Summary data sample:', resumeData.professionalSummary ? JSON.stringify(resumeData.professionalSummary).substring(0, 100) : 'none');

    // Create React element with colors support and optimization control
    const element = React.createElement(PDFResumeDocument, {
      resumeData,
      template,
      colors,
      isOptimized,
      resumeTitle: resume.title,
      enableOnePageOptimization: options.enableOnePageOptimization ?? true // Default to true for backward compatibility
    });

    // Generate PDF
    let buffer;
    try {
      buffer = await renderToBuffer(element);
      console.log('✅ PDF generated successfully, size:', buffer.length);
      console.log('📄 PDF should now match preview exactly');
    } catch (renderError) {
      console.error('❌ renderToBuffer failed:', renderError);
      console.error('❌ Resume data keys:', Object.keys(resumeData));
      console.error('❌ Professional summary type:', typeof resumeData.professionalSummary);
      console.error('❌ Professional summary value:', resumeData.professionalSummary);
      throw renderError;
    }

    // Create descriptive filename
    // Extract first and last name from contact info
    let firstName = 'Resume';
    let lastName = '';

    if (resumeData.contactInfo) {
      const contactInfo = resumeData.contactInfo as any;
      const fullName = (contactInfo.name || contactInfo.fullName || '').toString();
      const nameParts = fullName.trim().split(/\s+/);
      if (nameParts.length > 0) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join('_');
      }
    }

    const filename = application?.company
      ? `${firstName}_${lastName}_Resume_${application.company.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      : `${firstName}_${lastName}_Resume.pdf`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      },
    });

  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'Unknown error');
    return new NextResponse(`PDF Generation Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}

// Helper function to get default colors for templates
function getDefaultColors(template: string) {
  const defaultColors = {
    professional: { primary: '#1e40af', accent: '#3b82f6' },
    modern: { primary: '#7c3aed', accent: '#8b5cf6' },
    minimal: { primary: '#059669', accent: '#10b981' },
    creative: { primary: '#ea580c', accent: '#f97316' }
  };
  
  return defaultColors[template as keyof typeof defaultColors] || defaultColors.professional;
}