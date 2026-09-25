import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadToStorage, generateStorageKey, getContentType } from '@/lib/storage'
import { generatePDFThumbnail } from '@/lib/pdf-thumbnail-generator'
import { incrementResumeCount } from '@/lib/resume-count'
import { FREE_MAX_MASTER_RESUMES, masterResumeLimitFor } from '@/lib/plans'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting upload process...');
    
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      console.log('❌ No session found');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    console.log('👤 User email:', session.user.email);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      console.log('❌ User not found in database');
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    console.log('👤 User found:', user.id);

    // Uploads are unlimited; FREE accounts can only keep a few master resumes at once.
    // Tailoring is what's metered (see src/lib/tailor-quota.ts).
    const masterLimit = masterResumeLimitFor(user.plan === 'PREMIUM')
    if (masterLimit !== Infinity) {
      const activeResumes = await prisma.resume.count({
        where: { userId: user.id, isActive: true }
      })
      if (activeResumes >= masterLimit) {
        return NextResponse.json({
          success: false,
          error: `Free accounts can keep up to ${FREE_MAX_MASTER_RESUMES} resumes. Delete one to upload another, or go Pro for unlimited.`,
          upgradeRequired: true
        }, { status: 403 })
      }
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      console.log('❌ No file in form data');
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    console.log('📁 File received:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Validate file
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      console.log('❌ File too large:', file.size);
      return NextResponse.json({ success: false, error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowedTypes.includes(file.type)) {
      console.log('❌ Invalid file type:', file.type);
      return NextResponse.json({ success: false, error: 'Invalid file type' }, { status: 400 })
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())
    console.log('📄 Buffer created, size:', buffer.length);
    
    // Generate storage key
    const storageKey = generateStorageKey(user.id, file.name)
    const contentType = getContentType(file.name)

    console.log('🔧 Storage Upload starting:', { storageKey, contentType, fileSize: file.size })

    // Upload to storage
    const uploadResult = await uploadToStorage(
      buffer,
      storageKey,
      contentType,
      {
        'user-id': user.id,
        'original-filename': file.name,
      }
    )

    console.log('📤 Storage Upload result:', uploadResult)

    if (!uploadResult.success) {
      console.log('❌ Storage upload failed:', uploadResult.error);
      return NextResponse.json({ success: false, error: 'Upload failed: ' + uploadResult.error }, { status: 500 })
    }

    // Generate PDF thumbnail if it's a PDF
    let thumbnailUrl: string | null = null;
    if (file.type === 'application/pdf') {
      console.log('🖼️ Generating PDF thumbnail...');
      thumbnailUrl = await generatePDFThumbnail(buffer);
      if (thumbnailUrl) {
        console.log('✅ Thumbnail generated successfully');
      } else {
        console.log('⚠️ Thumbnail generation failed, continuing without thumbnail');
      }
    }

    // Generate title from filename
    const title = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ')

    console.log('💾 Creating resume record in database...');

    // Create resume record
    const resume = await prisma.resume.create({
      data: {
        title,
        userId: user.id,

        // Storage info
        s3Key: storageKey,
        s3Bucket: 'resumes', // Storage bucket name
        originalFileName: file.name,
        fileSize: file.size,
        contentType: file.type,
        thumbnailUrl: thumbnailUrl,

        // Empty content - will be filled by auto-fill feature
        originalContent: {
          rawText: '',
          metadata: {
            originalFileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            uploadedAt: new Date().toISOString(),
            s3Key: storageKey,
            s3Bucket: 'resumes', // Storage bucket name
            extractionStatus: 'pending',
          }
        },
        currentContent: {
          contact: {
            fullName: '',
            email: '',
            phone: '',
            location: '',
          },
          summary: '',
          experience: [],
          education: [],
          skills: [],
          lastModified: new Date().toISOString(),
        },
        wordCount: 0,
      }
    })

    // Increment resume count using new logic (handles monthly reset)
    await incrementResumeCount(user.id)

    console.log('✅ Resume created successfully:', resume.id)

    return NextResponse.json({
      success: true,
      resume: {
        id: resume.id,
        title: resume.title,
        s3Key: resume.s3Key,
        thumbnailUrl: resume.thumbnailUrl,
        createdAt: resume.createdAt,
        needsAutoFill: true,
      }
    })

  } catch (error) {
    console.error('❌ Fatal error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 })
  }
}