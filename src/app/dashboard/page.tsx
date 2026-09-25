"use client"

import { useState, useEffect, Suspense } from "react"
import { useSession } from "next-auth/react"
import { redirect, useSearchParams } from "next/navigation"
import Link from "next/link"
import ResumeUploader from "@/components/resume-uploader"
import ResumeLoader from "@/components/resume-loader"
import Navigation from "@/components/navigation"
import ComparisonModal from "@/components/comparison-modal"
import { ChatBubble } from "@/components/ui/chat-bubble"
import { Badge } from "@/components/ui/badge"
import { FREE_TAILORS_PER_MONTH, PRICING } from "@/lib/plans"
import {
  FileText,
  Plus,
  Trash2,
  Edit,
  Download,
  Briefcase,
  Zap,
  Upload,
  Sparkles
} from "lucide-react"

interface Resume {
  id: string
  title: string
  originalFileName?: string
  fileSize?: number
  createdAt: string
  updatedAt: string
}

interface JobApplication {
  id: string
  jobTitle: string
  company: string
  matchScore?: number
  createdAt: string
  resumeId: string
  resume?: {
    id: string
    title: string
    originalFileName?: string
  }
}

function DashboardContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()

  // Set browser title
  useEffect(() => {
    document.title = "ReWork — Your Resumes"
  }, [])

  // Loading state management
  const [shouldShowLoader, setShouldShowLoader] = useState(false)
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [resumes, setResumes] = useState<Resume[]>([])
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([])
  const [deletingResumeId, setDeletingResumeId] = useState<string | null>(null)

  // Comparison modal state
  const [showComparisonModal, setShowComparisonModal] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null)

  // Only show loader if data takes more than 500ms to load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isDataLoaded) {
        setShouldShowLoader(true)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [isDataLoaded])

  // Main data loading effect
  useEffect(() => {
    if (status === 'loading') return
    if (status !== 'authenticated') return

    // Start data fetching immediately
    const fetchData = async () => {
      try {
        // Fetch resumes (source files) - includes job applications data
        const resumesResponse = await fetch('/api/resumes')
        const resumesData = await resumesResponse.json()

        if (resumesData.success) {
          setResumes(resumesData.resumes || [])

          // Use job applications from resumes endpoint (faster and more reliable)
          const applications = resumesData.jobApplications || []
          setJobApplications(applications)

          // Check for showResult query param after applications load
          const showResultId = searchParams.get('showResult')
          if (showResultId && applications.length > 0) {
            const app = applications.find((a: JobApplication) => a.id === showResultId)
            if (app) {
              setSelectedApplication(app)
              setShowComparisonModal(true)
              // Remove query param from URL without refresh
              window.history.replaceState({}, '', '/dashboard')
            }
          }
        } else {
          setResumes([])
          setJobApplications([])
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
        setResumes([])
        setJobApplications([])
      } finally {
        setIsDataLoaded(true)
      }
    }

    fetchData()
  }, [status, session, searchParams])

  // Redirect if not authenticated
  if (status === "unauthenticated") {
    redirect("/auth/signin")
  }

  // Show loader only if it's taking a while
  if (shouldShowLoader && !isDataLoaded) {
    return <ResumeLoader />
  }

  // Don't render content until data is loaded (but without loader for first 500ms)
  if (!isDataLoaded) {
    return null
  }

  const handleUploadComplete = (resumes: any[]) => {
    setIsUploadOpen(false)
    fetchResumes()
  }

  const fetchResumes = async () => {
    try {
      const response = await fetch('/api/resumes')
      const data = await response.json()

      if (data.success) {
        setResumes(data.resumes || [])
      }
    } catch (error) {
      console.error('Failed to refresh resumes:', error)
    }
  }

  const handleDeleteResume = async (resumeId: string) => {
    if (!confirm('Are you sure you want to delete this resume?')) return

    try {
      setDeletingResumeId(resumeId)

      const response = await fetch(`/api/resumes/${resumeId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setResumes(prev => prev.filter(resume => resume.id !== resumeId))
      } else {
        alert('Failed to delete resume. Please try again.')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete resume. Please try again.')
    } finally {
      setDeletingResumeId(null)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return 'just now'
    if (diffInHours === 1) return '1 hour ago'
    if (diffInHours < 24) return `${diffInHours} hours ago`
    if (diffInHours < 48) return 'yesterday'
    return `${Math.floor(diffInHours / 24)} days ago`
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const kb = bytes / 1024
    if (kb < 1024) return `${Math.round(kb)} KB`
    const mb = kb / 1024
    return `${Math.round(mb * 10) / 10} MB`
  }

  const isPremium = !!session?.user?.access?.isPro
  const tailorLimit = isPremium ? "unlimited" : String(FREE_TAILORS_PER_MONTH)
  const tailorsUsed = session?.user?.monthlyTailors ?? 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-black bg-dots-sm">
      {/* Enhanced Navigation with Plan Info */}
      <Navigation>
        <div className="flex items-center space-x-4 ml-auto">
          {/* Plan Badge */}
          <Badge variant={isPremium ? "default" : "secondary"} className="text-xs">
            {isPremium ? "Pro Plan" : "Free Plan"} • {tailorsUsed}/{tailorLimit} tailors this month
          </Badge>

          {/* Upgrade Button - Opens Settings Modal */}
          {!isPremium && (
            <button
              onClick={() => {
                const settingsButton = document.querySelector('[title="Account Settings"]') as HTMLButtonElement
                if (settingsButton) {
                  settingsButton.click()
                  setTimeout(() => {
                    const billingTab = document.querySelector('[data-tab="billing"]') as HTMLButtonElement
                    if (billingTab) billingTab.click()
                  }, 100)
                }
              }}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Upgrade to Pro
            </button>
          )}
        </div>
      </Navigation>

      {/* Main Split Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-6 lg:gap-8">

          {/* LEFT COLUMN - Source Resumes */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-slate-200">
                  Uploaded Resumes
                </h2>
                <Badge variant="secondary" className="text-xs bg-slate-500/20 text-slate-400 border-slate-500/30">
                  {resumes.length}
                </Badge>
              </div>
            </div>

            {/* Resume List */}
            <div className="space-y-3">
              {resumes.length === 0 ? (
                /* Empty State for Uploaded Resumes */
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/10 rounded-lg p-6 text-center">
                  <div className="w-12 h-12 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-base font-medium text-slate-200 mb-2">
                    No resumes yet
                  </h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Upload your first resume to get started with AI optimization
                  </p>
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 mx-auto"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Resume
                  </button>
                </div>
              ) : (
                resumes.map((resume) => (
                <Link
                  key={resume.id}
                  href={`/dashboard/resume/${resume.id}`}
                  className="block"
                >
                  <div className="bg-slate-800/40 backdrop-blur-sm border border-white/10 hover:border-white/20 hover:border-l-4 hover:border-l-purple-500/50 rounded-lg p-4 transition-all duration-200 group cursor-pointer hover:bg-slate-800/60 relative">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-md bg-slate-700/50 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-600/50 transition-colors">
                        <FileText className="w-4 h-4 text-slate-400 group-hover:text-slate-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                            {resume.originalFileName || resume.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{formatTimeAgo(resume.updatedAt)}</span>
                          {resume.fileSize && (
                            <>
                              <span>•</span>
                              <span>{formatFileSize(resume.fileSize)}</span>
                            </>
                          )}
                        </div>
                        {/* Show tailoring count if tailored */}
                        {(() => {
                          const tailoringCount = jobApplications.filter(app => app.resume?.id === resume.id).length;
                          return tailoringCount > 0 && (
                            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              {tailoringCount} tailored version{tailoringCount > 1 ? 's' : ''}
                            </div>
                          );
                        })()}
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDeleteResume(resume.id)
                        }}
                        disabled={deletingResumeId === resume.id}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 transition-all rounded-md hover:bg-red-500/10"
                      >
                        {deletingResumeId === resume.id ? (
                          <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </Link>
              )))}

              {resumes.length > 0 && (
                /* Upload Button */
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="w-full border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-lg p-6 text-center transition-colors group"
                >
                  <Upload className="w-6 h-6 text-slate-500 group-hover:text-slate-400 mx-auto mb-2" />
                  <div className="text-sm font-medium text-slate-400 group-hover:text-slate-300">
                    Upload Another Resume
                  </div>
                  <div className="text-xs text-slate-500">
                    PDF, DOC, DOCX up to 10MB
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - Tailored Resumes */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-slate-200">
                  Tailored Resumes
                </h2>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                  {jobApplications.length}
                </Badge>
              </div>
            </div>

            {jobApplications.length === 0 ? (
              /* Enhanced Empty State */
              <div className="bg-slate-800/30 backdrop-blur-sm border border-white/10 rounded-lg p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-600/20 to-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                  <Zap className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">
                  Create Your First Tailored Resume
                </h3>
                <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
                  Transform your resume for each job application. Our AI analyzes job descriptions and optimizes your content for maximum impact and ATS compatibility.
                </p>

                {resumes.length > 0 ? (
                  <div className="space-y-3">
                    <Link href={`/dashboard/resume/${resumes[resumes.length - 1].id}?tab=job`}>
                      <button className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 mx-auto">
                        <Zap className="w-4 h-4" />
                        Start Tailoring
                      </button>
                    </Link>
                    <div className="text-xs text-slate-500">
                      Uses: {resumes[resumes.length - 1]?.originalFileName || resumes[resumes.length - 1]?.title || 'your most recent resume'}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-slate-500 bg-slate-700/30 border border-slate-600 rounded-lg p-3 mb-4">
                      <strong className="text-slate-400">💡 Tip:</strong> Upload a resume first to start tailoring
                    </div>
                    <button
                      onClick={() => setIsUploadOpen(true)}
                      className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 mx-auto"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Resume First
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Tailored Resume Cards - Horizontal Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                  {jobApplications.map((app) => (
                    <div
                      key={app.id}
                      className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] hover:border-emerald-500/25 rounded-lg transition-all duration-200 group cursor-pointer"
                      onClick={() => {
                        setSelectedApplication(app)
                        setShowComparisonModal(true)
                      }}
                    >
                      {/* Horizontal Layout */}
                      <div className="flex items-stretch">
                        {/* Left side - Document icon */}
                        <div className="w-20 flex-shrink-0 bg-gradient-to-br from-slate-700/40 to-slate-800/40 flex items-center justify-center border-r border-white/[0.05]">
                          <div className="w-12 h-14 bg-white/10 rounded border border-white/20 flex items-center justify-center group-hover:bg-white/15 transition-colors">
                            <FileText className="w-5 h-5 text-slate-400 group-hover:text-slate-300" />
                          </div>
                        </div>

                        {/* Right side - Content and Actions */}
                        <div className="flex-1 p-4 flex flex-col">
                          {/* Top section - Job info and badge */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0 mr-2">
                              <h3 className="text-[15px] font-semibold text-white leading-tight truncate">
                                {app.jobTitle}
                              </h3>
                              <p className="text-[13px] text-slate-400 truncate">
                                {app.company}
                              </p>
                            </div>
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs flex-shrink-0">
                              {app.matchScore ? `${Math.round(app.matchScore)}% match` : '✓ Optimized'}
                            </Badge>
                          </div>

                          {/* Middle section - Source info */}
                          <div className="text-[11px] text-slate-500 mb-3">
                            <p className="truncate">From: {app.resume?.originalFileName || app.resume?.title || 'Unknown Resume'}</p>
                            <p>{formatTimeAgo(app.createdAt)}</p>
                          </div>

                          {/* Bottom section - Actions */}
                          <div className="flex gap-2 mt-auto">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedApplication(app)
                                setShowComparisonModal(true)
                              }}
                              className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-white/10 hover:border-white/20 rounded-md text-xs font-medium text-white transition-all flex items-center justify-center gap-1.5"
                            >
                              <Edit className="w-3 h-3" />
                              Compare
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                // Tailored version for this application, not the master
                                window.location.href = `/api/resumes/${app.resumeId}/download?applicationId=${app.id}`
                              }}
                              className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
                              <Download className="w-3 h-3" />
                              Download
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tailor Another Job Prompt */}
                {resumes.length > 0 && (
                  <div className="border-2 border-dashed border-slate-600/50 hover:border-slate-500/70 rounded-lg p-6 text-center transition-colors group cursor-pointer"
                    onClick={() => {
                      const mostRecentResume = resumes[resumes.length - 1]
                      window.location.href = `/dashboard/resume/${mostRecentResume.id}?tab=job`
                    }}
                  >
                    <Zap className="w-6 h-6 text-slate-500 group-hover:text-slate-400 mx-auto mb-2 transition-colors" />
                    <div className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                      ⚡ Tailor for another job
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Click to optimize your resume for a new position
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-sm border-t border-white/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-sm text-slate-400">
            {isPremium ? "Pro Plan" : "Free Plan"} • {tailorsUsed}/{tailorLimit} tailors used this month
          </div>
          {!isPremium && (
            <Link href="/#pricing" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
              Upgrade to Pro ({PRICING.monthly.display}) for unlimited tailoring
            </Link>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setIsUploadOpen(false)}
          />

          <div className="relative bg-background border border-white/8 rounded-lg max-w-4xl w-full max-h-[85vh] overflow-y-auto animate-slide-up shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[18px] font-semibold text-white">
                  Upload Resume
                </h2>
                <button
                  onClick={() => setIsUploadOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-foreground hover:bg-white/5 transition-all"
                >
                  ✕
                </button>
              </div>

              <ResumeUploader
                onUploadComplete={handleUploadComplete}
                maxFiles={3}
              />
            </div>
          </div>
        </div>
      )}

      {/* Support Chat Bubble */}
      <ChatBubble />

      {/* Comparison Modal */}
      {selectedApplication && (
        <ComparisonModal
          isOpen={showComparisonModal}
          onClose={() => {
            setShowComparisonModal(false)
            setSelectedApplication(null)
          }}
          applicationId={selectedApplication.id}
          jobTitle={selectedApplication.jobTitle}
          company={selectedApplication.company}
        />
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<ResumeLoader />}>
      <DashboardContent />
    </Suspense>
  )
}