"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import Navigation from "@/components/navigation"
import StatusBar from "@/components/status-bar"
import AutoFillButton from '@/components/auto-fill-button'
import ContactInfoSection from '@/components/resume/ContactInfoSection'
import WorkExperienceSection from '@/components/resume/WorkExperienceSection'
import SkillsSection from '@/components/resume/SkillsSection'
import EducationSection from '@/components/resume/EducationSection'
import ProfessionalSummarySection from '@/components/resume/ProfessionalSummarySection'
import { CollapsibleSectionWrapper } from '@/components/resume/CollapsibleSectionWrapper'
import { ContactInfo, StructuredResumeData, WorkExperience, SkillsStructure, Education, ProfessionalSummary } from '@/types/resume'
import ResumeLoader from '@/components/resume-loader'
import ResumePreview from '@/components/resume/templates/ResumePreview'
import TemplateSelector, { TemplateType } from '@/components/resume/templates/TemplateSelector'
import { US_CITIES } from '@/lib/cities'
import TailoringProgress from '@/components/tailoring-progress'
import {
  ArrowLeft,
  Save,
  Eye,
  Edit3,
  Download,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Sparkles,
  Link as LinkIcon,
  Loader2,
  X,
  Check,
  Briefcase,
  User,
  FileText,
  GraduationCap,
  Wrench,
  Plus
} from "lucide-react"

// Legacy Simple Resume Preview Component (kept for fallback)
function SimpleResumePreview({ resumeData, resumeTitle, className = "" }: { resumeData: any, resumeTitle?: string, className?: string }) {
  const extractName = (contactInfo?: string | ContactInfo) => {
    if (contactInfo && typeof contactInfo === 'object') {
      const structured = contactInfo as ContactInfo
      return `${structured.firstName} ${structured.lastName}`.trim() || resumeTitle || 'Your Name'
    }
    if (!contactInfo || typeof contactInfo !== 'string') return resumeTitle || 'Your Name'
    const lines = contactInfo.split('\n').filter(line => line.trim())
    const nameLine = lines.find(line =>
      !line.includes('@') &&
      !line.match(/\d{3}[-.]?\d{3}[-.]?\d{4}/) &&
      line.length > 2
    )
    return nameLine || resumeTitle || 'Your Name'
  }

  const getContactDetails = (contactInfo?: string | ContactInfo) => {
    if (contactInfo && typeof contactInfo === 'object') {
      const structured = contactInfo as ContactInfo
      return {
        email: structured.email || '',
        phone: structured.phone || '',
        location: structured.location || ''
      }
    }
    if (contactInfo && typeof contactInfo === 'string') {
      const lines = contactInfo.split('\n').filter(line => line.trim())
      return {
        email: lines.find(line => line.includes('@')) || '',
        phone: lines.find(line => line.match(/\d{3}[-.]?\d{3}[-.]?\d{4}/)) || '',
        location: lines.find(line => !line.includes('@') && !line.match(/\d{3}[-.]?\d{3}[-.]?\d{4}/) && line.length > 5) || ''
      }
    }
    return { email: '', phone: '', location: '' }
  }

  const name = extractName(resumeData?.contactInfo || resumeData?.contact)
  const contact = getContactDetails(resumeData?.contactInfo || resumeData?.contact)
  const hasResumeData = !!(resumeData?.contactInfo || resumeData?.professionalSummary || resumeData?.workExperience?.length)

  return (
    <div className={`bg-white text-gray-900 p-8 ${className}`}>
      {!hasResumeData ? (
        <div className="flex flex-col items-center justify-center h-[600px] text-gray-400">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Edit3 className="w-10 h-10 text-gray-300" />
          </div>
          <p className="text-lg font-medium text-gray-500 mb-2">No content yet</p>
          <p className="text-sm text-gray-400">Start editing to see your resume preview</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{name}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {contact.email && <span>{contact.email}</span>}
              {contact.phone && <span>{contact.phone}</span>}
              {contact.location && <span>{contact.location}</span>}
            </div>
          </div>

          {/* Professional Summary */}
          {resumeData?.professionalSummary?.summary && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2 uppercase tracking-wider">
                Professional Summary
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                {resumeData.professionalSummary.summary}
              </p>
            </div>
          )}

          {/* Work Experience */}
          {resumeData?.workExperience?.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3 uppercase tracking-wider">
                Experience
              </h2>
              {resumeData.workExperience.map((exp: any, index: number) => (
                <div key={index} className="mb-4">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h3 className="font-semibold text-gray-900">{exp.role}</h3>
                      <p className="text-gray-600 text-sm">{exp.company}</p>
                    </div>
                    <span className="text-sm text-gray-500">{exp.dates}</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-gray-700 mt-2 space-y-1">
                    {exp.achievements?.map((achievement: string, i: number) => (
                      <li key={i}>{achievement}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Education */}
          {resumeData?.education?.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3 uppercase tracking-wider">
                Education
              </h2>
              {resumeData.education.map((edu: any, index: number) => (
                <div key={index} className="mb-3">
                  <h3 className="font-semibold text-gray-900">{edu.degree}</h3>
                  <p className="text-gray-600 text-sm">{edu.school}</p>
                  <p className="text-gray-500 text-sm">{edu.graduationDate}</p>
                </div>
              ))}
            </div>
          )}

          {/* Skills */}
          {resumeData?.skills && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2 uppercase tracking-wider">
                Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {Object.values(resumeData.skills).flat().map((skill: any, index: number) => (
                  <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Helper function to calculate section completion
function calculateSectionCompletion(section: string, data: any): number {
  switch (section) {
    case 'contact':
      if (!data || typeof data !== 'object') return 0;
      const contactFields = ['firstName', 'lastName', 'email', 'phone', 'location'];
      const filledContact = contactFields.filter(field => data[field] && data[field].trim()).length;
      return Math.round((filledContact / contactFields.length) * 100);

    case 'summary':
      if (!data || !data.summary) return 0;
      if (data.summary.length < 50) return 50;
      if (data.summary.length < 100) return 75;
      return 100;

    case 'experience':
      if (!Array.isArray(data) || data.length === 0) return 0;
      const hasBasicInfo = data.every((exp: any) => exp.role && exp.company);
      const hasAchievements = data.every((exp: any) => exp.achievements?.length > 0);
      if (!hasBasicInfo) return 25;
      if (!hasAchievements) return 60;
      return 100;

    case 'education':
      if (!Array.isArray(data) || data.length === 0) return 0;
      const hasBasicEdu = data.every((edu: any) => edu.degree && edu.school);
      return hasBasicEdu ? 100 : 50;

    case 'skills':
      if (!data || typeof data !== 'object') return 0;
      const totalSkills = Object.values(data).flat().length;
      if (totalSkills === 0) return 0;
      if (totalSkills < 5) return 50;
      if (totalSkills < 10) return 75;
      return 100;

    default:
      return 0;
  }
}

export default function UnifiedEditorPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()
  const resumeId = params.id as string

  // Loading states
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTailoring, setIsTailoring] = useState(false)
  const [isParsingUrl, setIsParsingUrl] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saving' | 'saved' | 'error'>('saved')

  // View states
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')
  const [rightPanelMode, setRightPanelMode] = useState<'preview' | 'job' | 'results'>('preview')
  const [isJobPanelOpen, setIsJobPanelOpen] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('classic')

  // Resume data
  const [resumeTitle, setResumeTitle] = useState<string>('')
  const [resumeData, setResumeData] = useState<StructuredResumeData | null>(null)
  const [originalContent, setOriginalContent] = useState<StructuredResumeData | null>(null)
  const [showOriginalInResults, setShowOriginalInResults] = useState(false)
  const [tailoringResults, setTailoringResults] = useState<{
    jobTitle: string
    company: string
    tailoredAt: string
  } | null>(null)
  const [tailoredJobCompany, setTailoredJobCompany] = useState<string | null>(null)
  const [tailoredJobTitle, setTailoredJobTitle] = useState<string | null>(null)

  // Job description data
  const [jobUrl, setJobUrl] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [jobLocation, setJobLocation] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([])
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)

  // Auto-save timer refs
  const jobSaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Extra context states
  const [showExtraContext, setShowExtraContext] = useState(false)
  const [extraContext, setExtraContext] = useState("")
  const [contextTags, setContextTags] = useState<string[]>([])

  // Fetch resume data on mount and load saved job description
  useEffect(() => {
    const fetchResumeData = async () => {
      try {
        const response = await fetch(`/api/resumes/${resumeId}`)
        const data = await response.json()

        if (data.success && data.resume) {
          const resume = data.resume
          setResumeTitle(resume.title || 'Untitled Resume')
          setResumeData({
            contactInfo: resume.contactInfo || { firstName: '', lastName: '', email: '', phone: '', location: '' },
            professionalSummary: resume.professionalSummary || undefined,
            workExperience: resume.workExperience || [],
            education: resume.education || [],
            skills: resume.skills || { technical: [], frameworks: [], tools: [], cloud: [], databases: [], soft: [], certifications: [] },
            projects: resume.projects || [],
            additionalSections: resume.additionalSections || undefined
          })
          setOriginalContent(resume.originalContent || null)
          setTailoredJobCompany(resume.tailoredJobCompany || null)
          setTailoredJobTitle(resume.tailoredJobTitle || null)
        }
      } catch (error) {
        console.error('Failed to fetch resume:', error)
        toast.error('Failed to load resume')
      } finally {
        setIsLoading(false)
      }
    }

    if (resumeId) {
      fetchResumeData()

      // Load saved job description from localStorage
      const savedJobData = localStorage.getItem(`job_${resumeId}`)
      if (savedJobData) {
        try {
          const parsed = JSON.parse(savedJobData)
          setJobTitle(parsed.jobTitle || '')
          setCompanyName(parsed.companyName || '')
          setJobLocation(parsed.jobLocation || '')
          setJobDescription(parsed.jobDescription || '')
          setJobUrl(parsed.jobUrl || '')
        } catch (e) {
          console.error('Failed to parse saved job data:', e)
        }
      }
    }
  }, [resumeId])

  // Auto-save functionality with debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const saveResume = async (showToast = true) => {
    if (!resumeData) return

    setIsSaving(true)
    setAutoSaveStatus('saving')
    try {
      const response = await fetch(`/api/resumes/${resumeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: resumeTitle,
          contactInfo: resumeData.contactInfo,
          professionalSummary: resumeData.professionalSummary,
          workExperience: resumeData.workExperience,
          education: resumeData.education,
          skills: resumeData.skills || { technical: [], frameworks: [], tools: [], cloud: [], databases: [], soft: [], certifications: [] },
          projects: resumeData.projects,
          additionalSections: resumeData.additionalSections
        })
      })

      const data = await response.json()
      if (data.success) {
        setAutoSaveStatus('saved')
        if (showToast) toast.success('Resume saved')
      } else {
        setAutoSaveStatus('error')
        if (showToast) toast.error('Failed to save resume')
      }
    } catch (error) {
      console.error('Save error:', error)
      setAutoSaveStatus('error')
      if (showToast) toast.error('Failed to save resume')
    } finally {
      setIsSaving(false)
    }
  }

  // Auto-save on data change
  useEffect(() => {
    if (!resumeData || isLoading) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      saveResume(false)
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [resumeData])

  // Auto-save job description to localStorage
  useEffect(() => {
    if (!resumeId) return

    // Clear existing timeout
    if (jobSaveTimeoutRef.current) {
      clearTimeout(jobSaveTimeoutRef.current)
    }

    // Only save if there's actual content
    if (jobTitle || companyName || jobLocation || jobDescription || jobUrl) {
      // Set new timeout for auto-save
      jobSaveTimeoutRef.current = setTimeout(() => {
        const jobData = {
          jobTitle,
          companyName,
          jobLocation,
          jobDescription,
          jobUrl,
          savedAt: new Date().toISOString()
        }
        localStorage.setItem(`job_${resumeId}`, JSON.stringify(jobData))
        console.log('💾 Job description auto-saved to localStorage')
      }, 2000) // Save after 2 seconds of inactivity
    }

    return () => {
      if (jobSaveTimeoutRef.current) {
        clearTimeout(jobSaveTimeoutRef.current)
      }
    }
  }, [jobTitle, companyName, jobLocation, jobDescription, jobUrl, resumeId])

  // Reset tailored status when job description significantly changes
  useEffect(() => {
    if (tailoredJobCompany && tailoredJobTitle) {
      // Check if the job details have changed
      if (companyName !== tailoredJobCompany || jobTitle !== tailoredJobTitle) {
        // Different job - clear the tailored status to allow re-tailoring
        setTailoredJobCompany(null)
        setTailoredJobTitle(null)
        setTailoringResults(null)
      }
    }
  }, [jobTitle, companyName, tailoredJobCompany, tailoredJobTitle])

  // Handle job URL parsing with improved feedback
  const handleUrlParse = async () => {
    if (!jobUrl.trim()) {
      toast.error('Please enter a job posting URL')
      return
    }

    setIsParsingUrl(true)
    try {
      const response = await fetch('/api/job-url/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl })
      })

      const result = await response.json()

      if (result.success && result.data) {
        // Count how many fields were actually extracted
        const extractedFields = {
          jobTitle: !!result.data.jobTitle,
          company: !!result.data.company,
          location: !!result.data.location,
          jobDescription: !!result.data.jobDescription && result.data.jobDescription.length > 100
        }

        const fieldsExtracted = Object.values(extractedFields).filter(Boolean).length

        // Set the extracted data
        setJobTitle(result.data.jobTitle || '')
        setCompanyName(result.data.company || '')
        setJobLocation(result.data.location || '')
        setJobDescription(result.data.jobDescription || '')

        // Provide honest feedback based on extraction quality
        if (fieldsExtracted === 4) {
          toast.success('Job details extracted successfully!')
        } else if (fieldsExtracted >= 2) {
          toast.info(`Found some details (${fieldsExtracted}/4 fields). Please fill in the rest manually.`)
        } else if (result.data.company || result.data.jobTitle) {
          toast.warning('Limited information found. Please paste the full job description manually.')
        } else {
          toast.warning('Could not extract job details. Please fill in the information manually.')
        }
      } else if (result.blocked || result.isBlockedSite) {
        toast.error('This site blocks automated access. Please copy and paste the job details manually.')
      } else {
        toast.error('Unable to fetch from this URL. Please paste the job details manually.')
      }
    } catch (error) {
      console.error('URL parse error:', error)
      toast.error('Network error. Please check your connection and try again.')
    } finally {
      setIsParsingUrl(false)
    }
  }

  // Handle resume tailoring with comprehensive error handling
  const handleTailorResume = async () => {
    // Input validation
    if (!jobTitle || !companyName || !jobDescription) {
      toast.error('Please fill in job details first')
      return
    }

    // Check if already tailored for this job
    if (tailoredJobCompany === companyName && tailoredJobTitle === jobTitle) {
      const confirmed = confirm('This resume is already tailored for this job. Re-tailoring will use your monthly limit. Continue?')
      if (!confirmed) return
    }

    // Check if resume has content
    if (!resumeData || (!resumeData.workExperience?.length && !resumeData.education?.length)) {
      toast.error('Please add your experience and education before tailoring')
      return
    }

    console.log('🚀 Starting resume tailoring...');
    console.log('Job details:', { jobTitle, companyName, locationLength: jobLocation.length, descriptionLength: jobDescription.length });

    setIsTailoring(true)
    setRightPanelMode('job') // Ensure job panel is visible during tailoring

    try {
      // Log the request payload
      const requestPayload = {
        jobTitle,
        company: companyName,
        location: jobLocation,
        description: jobDescription,
        extraContext,
        contextTags
      };
      console.log('📤 Sending tailoring request:', {
        ...requestPayload,
        description: `${requestPayload.description.substring(0, 100)}...`
      });

      const response = await fetch(`/api/resumes/${resumeId}/tailor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      })

      console.log('📥 Response status:', response.status);

      const data = await response.json()
      console.log('📥 Response data:', {
        success: data.success,
        hasResume: !!data.tailoredResume,
        error: data.error,
        details: data.details
      });

      if (!response.ok) {
        // Handle specific error cases with user-friendly messages
        if (response.status === 402 && data.upgradeRequired) {
          toast.error(data.error || 'Monthly tailoring limit reached.', {
            action: { label: 'Upgrade', onClick: () => router.push('/#pricing') }
          });
        } else if (response.status === 500 && data.error?.includes('AI service')) {
          toast.error('AI service temporarily unavailable. Please try again in a moment.');
        } else if (response.status === 429) {
          toast.error(data.error || 'Service is busy. Please wait a few seconds and try again.');
        } else if (response.status === 400) {
          toast.error(data.error || 'Invalid request. Please check your inputs.');
        } else {
          toast.error(data.error || 'Failed to tailor resume. Please try again.');
        }
        return;
      }

      if (data.success && data.tailoredResume) {
        console.log('✅ Tailoring successful, updating UI...');
        console.log('📊 Tailored data structure:', {
          hasContactInfo: !!data.tailoredResume.contactInfo,
          hasProfessionalSummary: !!data.tailoredResume.professionalSummary,
          workExperienceCount: data.tailoredResume.workExperience?.length || 0,
          educationCount: data.tailoredResume.education?.length || 0,
          hasSkills: !!data.tailoredResume.skills,
          applicationId: data.applicationId
        });

        // The tailored version lives on the JobApplication. The editor keeps showing
        // the master, which tailoring never modifies.
        setTailoredJobCompany(companyName)
        setTailoredJobTitle(jobTitle)

        // Show success toast and redirect to dashboard
        toast.success('Resume tailored successfully!')

        // Wait a moment for the toast to show, then redirect with the application ID
        setTimeout(() => {
          router.push(`/dashboard?showResult=${data.applicationId}`)
        }, 1500)
      } else {
        // Fallback error handling
        const errorMsg = data.error || data.message || 'Failed to tailor resume';
        console.error('❌ Tailoring failed:', errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      // Network or unexpected errors
      console.error('❌ Tailoring error:', error)

      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Unexpected error occurred. Your data is safe. Please try again.');
      }
    } finally {
      setIsTailoring(false)
      console.log('🏁 Tailoring process completed');
    }
  }

  if (isLoading) {
    return <ResumeLoader />
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation */}
      <Navigation showUserMenu={false} />

      {/* Sub Navigation */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-[52px] z-30">
        <div className="flex items-center justify-between px-6 h-[52px]">
          {/* Left side */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-[13px] text-text-secondary hover:text-foreground transition-all group"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Back</span>
            </Link>
            <div className="h-4 w-px bg-white/6" />
            <span className="text-[15px] font-semibold text-white">
              {resumeTitle || 'Untitled Resume'}
            </span>
            {tailoredJobCompany && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-success/10 text-success border border-success/20">
                  <Briefcase className="w-3 h-3" />
                  Tailored for {tailoredJobCompany}
                </span>
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">

            <button
              onClick={() => saveResume(true)}
              disabled={isSaving}
              className="btn-secondary px-4 py-1.5 rounded-md text-[13px] font-medium inline-flex items-center gap-1.5"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save
            </button>

            <button className="btn-primary px-4 py-1.5 rounded-md text-[13px] font-semibold inline-flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex relative" style={{ paddingBottom: 'var(--status-bar-height)' }}>
        {/* Left Side - Resume Editor */}
        <div className={`overflow-y-auto transition-all duration-300 ${
          isJobPanelOpen ? 'w-[55%]' : 'flex-1'
        }`}>
          <div className="max-w-4xl mx-auto p-8 space-y-6">
            {/* Auto-fill Button */}
            {resumeData && (
              <div className="flex justify-between items-center mb-6 p-4 bg-slate-800/30 border border-white/10 rounded-lg">
                <div>
                  <h3 className="text-[14px] font-semibold text-white mb-1">Need to import your resume?</h3>
                  <p className="text-[12px] text-slate-400">Upload a PDF to auto-fill all fields</p>
                </div>
                <AutoFillButton
                  resumeId={resumeId}
                  onAutoFillComplete={(data) => {
                    if (data) {
                      try {
                        // Map API response structure to frontend structure with error handling
                        const mappedData: StructuredResumeData = {
                          contactInfo: data.contact || { firstName: '', lastName: '', email: '', phone: '', location: '' },
                          professionalSummary: typeof data.summary === 'string'
                            ? { summary: data.summary, targetRole: '', keyStrengths: [], careerLevel: 'mid' }
                            : data.summary || undefined,
                          workExperience: Array.isArray(data.experience) ? data.experience : [],
                          education: Array.isArray(data.education) ? data.education : [],
                          skills: Array.isArray(data.skills)
                            ? { technical: data.skills, frameworks: [], tools: [], cloud: [], databases: [], soft: [], certifications: [] }
                            : data.skills || { technical: [], frameworks: [], tools: [], cloud: [], databases: [], soft: [], certifications: [] },
                          projects: data.projects || [],
                          additionalSections: data.additionalSections || undefined
                        };

                        console.log('📝 Mapped data for frontend:', mappedData);
                        setResumeData(mappedData);
                      } catch (error) {
                        console.error('❌ Error mapping auto-fill data:', error);
                        toast.error('Auto-fill completed but failed to update some fields. Please check the console.');
                        return;
                      }

                      // Keep all sections collapsed - green dots show they're filled
                      // Users can expand individually to review

                      toast.success('Resume auto-filled successfully! Review each section to verify the information.');
                    }
                  }}
                />
              </div>
            )}
              {/* Contact Information */}
              <CollapsibleSectionWrapper
                title="Contact Information"
                icon={<User className="w-4 h-4" />}
                completionPercentage={calculateSectionCompletion('contact', resumeData?.contactInfo)}
              >
                <ContactInfoSection
                  contactInfo={resumeData?.contactInfo as ContactInfo || { firstName: '', lastName: '', email: '', phone: '', location: '' }}
                  onChange={(data) => setResumeData(prev => prev ? {...prev, contactInfo: data} : null)}
                />
              </CollapsibleSectionWrapper>

              {/* Professional Summary */}
              <CollapsibleSectionWrapper
                title="Professional Summary"
                icon={<FileText className="w-4 h-4" />}
                completionPercentage={calculateSectionCompletion('summary', resumeData?.professionalSummary)}
              >
                <ProfessionalSummarySection
                  professionalSummary={resumeData?.professionalSummary || { summary: '', targetRole: '', keyStrengths: [], careerLevel: 'mid' }}
                  onChange={(data) => setResumeData(prev => prev ? {...prev, professionalSummary: data} : null)}
                />
              </CollapsibleSectionWrapper>

              {/* Work Experience */}
              <CollapsibleSectionWrapper
                title="Work Experience"
                icon={<Briefcase className="w-4 h-4" />}
                completionPercentage={calculateSectionCompletion('experience', resumeData?.workExperience)}
              >
                <WorkExperienceSection
                  workExperience={resumeData?.workExperience || []}
                  onChange={(data) => setResumeData(prev => prev ? {...prev, workExperience: data} : null)}
                />
              </CollapsibleSectionWrapper>

              {/* Education */}
              <CollapsibleSectionWrapper
                title="Education"
                icon={<GraduationCap className="w-4 h-4" />}
                completionPercentage={calculateSectionCompletion('education', resumeData?.education)}
              >
                <EducationSection
                  education={resumeData?.education || []}
                  onChange={(data) => setResumeData(prev => prev ? {...prev, education: data} : null)}
                />
              </CollapsibleSectionWrapper>

              {/* Skills */}
              <CollapsibleSectionWrapper
                title="Skills"
                icon={<Wrench className="w-4 h-4" />}
                completionPercentage={calculateSectionCompletion('skills', resumeData?.skills)}
              >
                <SkillsSection
                  skills={resumeData?.skills || { technical: [], frameworks: [], tools: [], cloud: [], databases: [], soft: [], certifications: [] }}
                  onChange={(data) => setResumeData(prev => prev ? {...prev, skills: data} : null)}
                />
              </CollapsibleSectionWrapper>

              {/* Extra Context Section */}
              <div className="mb-6">
                <button
                  onClick={() => setShowExtraContext(!showExtraContext)}
                  className="w-full px-4 py-3 bg-slate-800/30 hover:bg-slate-800/40 border border-white/10 rounded-lg text-[13px] text-slate-400 hover:text-white transition-all flex items-center justify-between group"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Extra Context
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showExtraContext ? 'rotate-180' : ''}`} />
                </button>

                {showExtraContext && (
                  <div className="mt-3 p-4 bg-slate-800/20 border border-white/10 rounded-lg space-y-4">
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-2">
                        Anything else we should know?
                      </label>
                      <textarea
                        value={extraContext}
                        onChange={(e) => setExtraContext(e.target.value)}
                        placeholder="e.g., I'm switching careers, I have volunteer experience, I want to emphasize leadership skills..."
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-md text-[13px] text-white placeholder:text-slate-500 hover:border-white/20 focus:border-white/30 focus:outline-none transition-all resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-2">
                        Quick Context Tags
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "Career Changer",
                          "Recent Graduate",
                          "Employment Gaps",
                          "Volunteer Work",
                          "Military Transition"
                        ].map(tag => (
                          <button
                            key={tag}
                            onClick={() => {
                              if (contextTags.includes(tag)) {
                                setContextTags(contextTags.filter(t => t !== tag))
                              } else {
                                setContextTags([...contextTags, tag])
                              }
                            }}
                            className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all border ${
                              contextTags.includes(tag)
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-slate-800/30 text-slate-400 border-white/10 hover:bg-slate-800/50 hover:text-white'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Next Step Guidance */}
              <div className="mt-8 p-6 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[14px] font-semibold text-white mb-1">Ready for the next step?</h3>
                    <p className="text-[12px] text-slate-400">Add a target job to optimize your resume with AI</p>
                  </div>
                  <button
                    onClick={() => {
                      setRightPanelMode('job');
                      setIsJobPanelOpen(true);
                    }}
                    className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-md text-[13px] font-medium transition-all inline-flex items-center gap-2 border border-emerald-500/30"
                  >
                    <ChevronRight className="w-4 h-4" />
                    Add Target Job
                  </button>
                </div>
              </div>
          </div>
        </div>

        {/* Right Side Panel - Preview or Job */}
        <div className={`fixed right-0 top-[104px] bottom-[32px] bg-slate-900/50 backdrop-blur-sm border-l border-white/10 transition-all duration-300 shadow-2xl ${
          isJobPanelOpen ? 'w-[45%]' : 'w-0'
        }`}>
          {/* Toggle Tab */}
          <button
            onClick={() => setIsJobPanelOpen(!isJobPanelOpen)}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-10 h-24 bg-slate-900 border border-white/10 border-r-0 rounded-l-lg flex flex-col items-center justify-center hover:bg-slate-800 transition-all group"
            title={isJobPanelOpen ? "Close panel" : "Open panel"}
          >
            {isJobPanelOpen ? (
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                <span className="text-[10px] text-slate-500 mt-1 writing-mode-vertical">
                  {rightPanelMode === 'preview' ? 'Preview' : 'Job'}
                </span>
              </>
            )}
          </button>

          {/* Panel Content */}
          {isJobPanelOpen && (
            <div className="h-full flex flex-col">
              {/* Panel Mode Toggle */}
              <div className="p-4 border-b border-white/10">
                <div className="flex bg-slate-800/50 border border-white/10 rounded-md p-0.5">
                  <button
                    onClick={() => setRightPanelMode('preview')}
                    className={`flex-1 px-3 py-1.5 text-[12px] font-medium rounded transition-all ${
                      rightPanelMode === 'preview'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3 h-3 inline mr-1.5" />
                    Preview
                  </button>
                  <button
                    onClick={() => setRightPanelMode('job')}
                    className={`flex-1 px-3 py-1.5 text-[12px] font-medium rounded transition-all ${
                      rightPanelMode === 'job'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Briefcase className="w-3 h-3 inline mr-1.5" />
                    Target Job
                  </button>
                  {tailoringResults && (
                    <button
                      onClick={() => setRightPanelMode('results')}
                      className={`flex-1 px-3 py-1.5 text-[12px] font-medium rounded transition-all ${
                        rightPanelMode === 'results'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Check className="w-3 h-3 inline mr-1.5" />
                      Results
                    </button>
                  )}
                </div>
              </div>

              {/* Panel Content */}
              {rightPanelMode === 'preview' ? (
                /* Resume Preview */
                <div className="flex-1 overflow-y-auto">
                  <div className="p-4">
                    <TemplateSelector
                      selectedTemplate={selectedTemplate}
                      onTemplateChange={setSelectedTemplate}
                      className="mb-4"
                    />
                  </div>
                  <div className="px-4 pb-4">
                    <div className="bg-white rounded-lg shadow-2xl overflow-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
                      <ResumePreview
                        resumeData={resumeData}
                        template={selectedTemplate}
                        accentColor={selectedTemplate === 'classic' ? '#1e40af' : selectedTemplate === 'modern' ? '#7c3aed' : '#dc2626'}
                      />
                    </div>
                  </div>
                </div>
              ) : rightPanelMode === 'results' ? (
                /* Results View */
                <div className="flex-1 overflow-y-auto p-6">
                  {/* Success Header */}
                  <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-400 mt-0.5" />
                      <div>
                        <h3 className="text-[14px] font-semibold text-white mb-1">
                          Resume Optimized!
                        </h3>
                        <p className="text-[12px] text-slate-400">
                          Tailored for {tailoringResults?.jobTitle} at {tailoringResults?.company}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Before/After Toggle */}
                  <div className="mb-6">
                    <div className="flex bg-slate-800/50 border border-white/10 rounded-md p-0.5">
                      <button
                        onClick={() => setShowOriginalInResults(false)}
                        className={`flex-1 px-4 py-2 text-[13px] font-medium rounded transition-all ${
                          !showOriginalInResults
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 inline mr-2" />
                        Tailored Version
                      </button>
                      <button
                        onClick={() => setShowOriginalInResults(true)}
                        className={`flex-1 px-4 py-2 text-[13px] font-medium rounded transition-all ${
                          showOriginalInResults
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <FileText className="w-4 h-4 inline mr-2" />
                        Original
                      </button>
                    </div>
                  </div>

                  {/* Resume Preview */}
                  <div className="mb-6">
                    <div className="bg-white rounded-lg shadow-2xl overflow-hidden" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                      <div className="overflow-y-auto">
                        <ResumePreview
                          resumeData={showOriginalInResults && originalContent ? originalContent : resumeData}
                          template={selectedTemplate}
                          accentColor={selectedTemplate === 'classic' ? '#1e40af' : selectedTemplate === 'modern' ? '#7c3aed' : '#dc2626'}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Template Selector */}
                  <div className="mb-6">
                    <TemplateSelector
                      selectedTemplate={selectedTemplate}
                      onTemplateChange={setSelectedTemplate}
                      className=""
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={async () => {
                        // Download the tailored PDF
                        const element = document.createElement('a');
                        element.href = `/api/resumes/${resumeId}/download`;
                        element.download = `${resumeData?.contactInfo?.firstName}_${resumeData?.contactInfo?.lastName}_Resume_${tailoringResults?.company}.pdf`.replace(/\s+/g, '_');
                        document.body.appendChild(element);
                        element.click();
                        document.body.removeChild(element);
                        toast.success('Downloading tailored resume...');
                      }}
                      className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-md inline-flex items-center justify-center gap-2 text-[13px] font-semibold transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                    <button
                      onClick={() => {
                        setRightPanelMode('preview');
                        setTailoringResults(null);
                        toast.info('You can continue editing your tailored resume');
                      }}
                      className="py-2.5 bg-slate-700 hover:bg-slate-600 border border-white/10 text-white rounded-md inline-flex items-center justify-center gap-2 text-[13px] font-medium transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                      Keep Editing
                    </button>
                  </div>
                </div>
              ) : (
                /* Job Description Panel */
                <div className="flex-1 overflow-y-auto p-6">
                  {/* Show tailoring progress if active */}
                  {isTailoring ? (
                    <TailoringProgress
                      isActive={isTailoring}
                      jobTitle={jobTitle}
                      companyName={companyName}
                    />
                  ) : (
                    <>
                      {/* Header */}
                      <div className="mb-6">
                        <h2 className="text-[14px] font-semibold text-white mb-1">
                          Target Job Description
                        </h2>
                        <p className="text-[12px] text-slate-400">
                          Add job details to tailor your resume
                        </p>
                      </div>

                  {/* URL Input */}
                  <div className="mb-5">
                    <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-2">
                      Job Posting URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={jobUrl}
                        onChange={(e) => setJobUrl(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 px-3 py-2 bg-slate-800/50 border border-white/10 rounded-md text-[13px] text-white placeholder:text-slate-500 hover:border-white/20 focus:border-white/30 focus:outline-none transition-all"
                      />
                      <button
                        onClick={handleUrlParse}
                        disabled={isParsingUrl}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-white/10 hover:border-white/20 rounded-md text-[12px] font-medium text-white transition-all disabled:opacity-50"
                        title="Fetch job details"
                      >
                        {isParsingUrl ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <LinkIcon className="w-3.5 h-3.5 inline mr-1" />
                            Fetch
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Job Details */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
                        Job Title
                      </label>
                      <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="e.g. Senior Software Engineer"
                        className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-md text-[13px] text-white placeholder:text-slate-500 hover:border-white/20 focus:border-white/30 focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
                        Company
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. Google"
                        className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-md text-[13px] text-white placeholder:text-slate-500 hover:border-white/20 focus:border-white/30 focus:outline-none transition-all"
                      />
                    </div>

                    <div className="relative">
                      <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
                        Location
                      </label>
                      <input
                        type="text"
                        value={jobLocation}
                        onChange={(e) => {
                          const value = e.target.value
                          setJobLocation(value)

                          if (value.length >= 3) {
                            const filtered = US_CITIES.filter(city =>
                              city.toLowerCase().includes(value.toLowerCase())
                            ).slice(0, 8)
                            setLocationSuggestions(filtered)
                            setShowLocationSuggestions(filtered.length > 0)
                          } else {
                            setShowLocationSuggestions(false)
                          }
                        }}
                        onFocus={() => {
                          if (jobLocation.length >= 3 && locationSuggestions.length > 0) {
                            setShowLocationSuggestions(true)
                          }
                        }}
                        onBlur={() => {
                          // Delay to allow clicking on suggestions
                          setTimeout(() => setShowLocationSuggestions(false), 200)
                        }}
                        placeholder="e.g. San Francisco, CA"
                        className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-md text-[13px] text-white placeholder:text-slate-500 hover:border-white/20 focus:border-white/30 focus:outline-none transition-all"
                      />

                      {/* Location Suggestions Dropdown */}
                      {showLocationSuggestions && (
                        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-white/10 rounded-md shadow-xl overflow-hidden">
                          {locationSuggestions.map((city, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                setJobLocation(city)
                                setShowLocationSuggestions(false)
                              }}
                              className="w-full px-3 py-2 text-left text-[12px] text-white hover:bg-slate-700 transition-colors"
                            >
                              {city}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
                        Job Description
                      </label>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the job description here..."
                        rows={10}
                        className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-md text-[13px] text-white placeholder:text-slate-500 hover:border-white/20 focus:border-white/30 focus:outline-none transition-all resize-none"
                        style={{ minHeight: '160px' }}
                      />
                      {jobDescription && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          {jobDescription.length} characters
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="my-6 border-t border-white/10" />

                  {/* Tailor Button with Progress States */}
                  <button
                    onClick={handleTailorResume}
                    disabled={isTailoring || !jobTitle || !companyName || !jobDescription}
                    className={`w-full py-2.5 rounded-md inline-flex items-center justify-center gap-2 text-[13px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden ${
                      tailoredJobCompany === companyName && tailoredJobTitle === jobTitle
                        ? 'bg-emerald-500/30 hover:bg-emerald-500/40 text-emerald-400 border border-emerald-500/30'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900'
                    }`}
                  >
                    {isTailoring ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="animate-pulse">Tailoring Resume...</span>
                      </>
                    ) : tailoredJobCompany === companyName && tailoredJobTitle === jobTitle ? (
                      <>
                        <Check className="w-4 h-4" />
                        ✓ Resume Tailored
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        ⚡ Tailor Resume
                      </>
                    )}
                  </button>

                  {tailoredJobCompany && (
                    <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400 text-[12px]">
                          <Check className="w-3.5 h-3.5" />
                          <span>Tailored for this job</span>
                        </div>
                      </div>
                    </div>
                  )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar autoSaveStatus={autoSaveStatus} />
    </div>
  )
}