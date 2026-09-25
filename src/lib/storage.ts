import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Supabase client with service role key for server-side operations. Created on first use
// so importing this module (and `next build`) works without env.
let client: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  return client
}

// Bucket name for storing resumes
const BUCKET_NAME = 'resumes'

// Ensure bucket exists (run this once on app startup)
export async function ensureBucketExists() {
  const { data: buckets, error: listError } = await getSupabase().storage.listBuckets()

  if (listError) {
    console.error('Error listing buckets:', listError)
    return
  }

  const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME)

  if (!bucketExists) {
    const { data, error } = await getSupabase().storage.createBucket(BUCKET_NAME, {
      public: false, // Keep files private
      fileSizeLimit: 10 * 1024 * 1024, // 10MB limit
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    })

    if (error) {
      console.error('Error creating bucket:', error)
    } else {
      console.log('Created resumes bucket:', data)
    }
  }
}

// Upload file to Supabase Storage
export async function uploadToStorage(
  file: Buffer,
  key: string,
  contentType: string,
  metadata?: Record<string, string>
) {
  try {
    // Ensure bucket exists
    await ensureBucketExists()

    // Convert Buffer to Blob with proper content type
    const blob = new Blob([file], { type: contentType })

    // Upload file
    const { data, error } = await getSupabase().storage
      .from(BUCKET_NAME)
      .upload(key, blob, {
        contentType,
        upsert: false, // Don't overwrite existing files
        cacheControl: '3600',
        // Note: Metadata can be stored in the database if needed
      })

    if (error) {
      throw error
    }

    // Get public URL (even though bucket is private, we'll use signed URLs)
    const { data: urlData } = getSupabase().storage
      .from(BUCKET_NAME)
      .getPublicUrl(key)

    return {
      success: true,
      key,
      etag: data.id || 'supabase-' + Date.now(),
      location: urlData.publicUrl,
    }
  } catch (error) {
    console.error('Supabase upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    }
  }
}

// Generate signed URL for secure file access
export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600) {
  try {
    const { data, error } = await getSupabase().storage
      .from(BUCKET_NAME)
      .createSignedUrl(key, expiresIn)

    if (error) {
      throw error
    }

    return {
      success: true,
      url: data.signedUrl,
    }
  } catch (error) {
    console.error('Supabase signed URL error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Delete file from Supabase Storage
export async function deleteFromStorage(key: string) {
  try {
    const { error } = await getSupabase().storage
      .from(BUCKET_NAME)
      .remove([key])

    if (error) {
      throw error
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error('Supabase delete error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown delete error',
    }
  }
}

// Generate unique storage key for a file
export function generateStorageKey(userId: string, originalFileName: string): string {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 8)
  const fileExtension = originalFileName.split('.').pop()

  return `users/${userId}/resumes/${timestamp}-${randomId}.${fileExtension}`
}

// Helper to get file content type
export function getContentType(fileName: string): string {
  const extension = fileName.toLowerCase().split('.').pop()

  switch (extension) {
    case 'pdf':
      return 'application/pdf'
    case 'doc':
      return 'application/msword'
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    default:
      return 'application/octet-stream'
  }
}

// Download file from Supabase Storage
export async function downloadFromStorage(key: string): Promise<Buffer | null> {
  try {
    const { data, error } = await getSupabase().storage
      .from(BUCKET_NAME)
      .download(key)

    if (error) {
      throw error
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return buffer
  } catch (error) {
    console.error('Supabase download error:', error)
    return null
  }
}
/**
 * Account deletion: removes every file under the user's folder plus any keys the
 * database knows about. Never throws; returns how many were removed and any error.
 */
export async function deleteUserFiles(userId: string, knownKeys: string[]): Promise<{ deleted: number; error?: string }> {
  try {
    const bucket = getSupabase().storage.from(BUCKET_NAME)
    const prefix = `users/${userId}/resumes`
    const keys = new Set(knownKeys.filter(Boolean))
    const { data: listed, error: listError } = await bucket.list(prefix, { limit: 1000 })
    for (const file of listed ?? []) keys.add(`${prefix}/${file.name}`)
    if (keys.size === 0) return { deleted: 0, ...(listError ? { error: listError.message } : {}) }
    const { data, error } = await bucket.remove([...keys])
    if (error) throw error
    return { deleted: data?.length ?? 0, ...(listError ? { error: listError.message } : {}) }
  } catch (error) {
    return { deleted: 0, error: error instanceof Error ? error.message : String(error) }
  }
}
