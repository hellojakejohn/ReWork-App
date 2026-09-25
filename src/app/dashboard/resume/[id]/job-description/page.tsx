"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
// ✅ ADDED: Import the minimum loading hook
import { useJobDescriptionLoading } from "@/hooks/useMinimumLoading"
import ResumeLoader from '@/components/resume-loader'
import { useTutorial } from "@/components/tutorial/CustomTutorial"
import {
  ArrowLeft,
  ArrowRight,
  Target,
  CheckCircle,
  TrendingUp,
  Sparkles,
  Building,
  FileText,
  Save,
  Zap,
  Clock,
  Link as LinkIcon,
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import { Logo, BetaBadge } from "@/components/ui/logo"
import { UpgradeSheet } from "@/components/billing/upgrade-sheet"

export default function JobDescriptionPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()
  const resumeId = params.id as string
  
  // ✅ ADDED: Minimum loading hook for 800ms job description loading
  const { shouldHideContent, startLoading, finishLoading } = useJobDescriptionLoading()

  const [jobTitle, setJobTitle] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [jobLocation, setJobLocation] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [jobRequirements, setJobRequirements] = useState("")
  const [jobBenefits, setJobBenefits] = useState("")
  const [hasJobDescription, setHasJobDescription] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [existingJobId, setExistingJobId] = useState<string | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 })
  const [isMounted, setIsMounted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [jobUrl, setJobUrl] = useState("")
  const [isParsingUrl, setIsParsingUrl] = useState(false)
  const [isTailoring, setIsTailoring] = useState(false)
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null)

  // Client-side mount check
  useEffect(() => {
    setIsMounted(true)
    setTimeout(() => setIsLoaded(true), 100)
  }, [])

  // Mouse tracking for premium effects
  useEffect(() => {
    if (!isMounted) return
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX / window.innerWidth * 100, y: e.clientY / window.innerHeight * 100 })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [isMounted])

  const isJobComplete = () => {
    return jobTitle.trim().length > 3 && 
           companyName.trim().length > 2 && 
           jobDescription.trim().length > 100
  }

  const getDescriptionStatus = () => {
    const length = jobDescription.length;
    if (length < 100) return { color: 'text-red-400', message: 'Need more details for better analysis', icon: '🔧' };
    if (length < 300) return { color: 'text-yellow-400', message: 'Good start! More details = better optimization', icon: '⚡' };
    if (length < 600) return { color: 'text-green-400', message: 'Great! Perfect amount of detail', icon: '✅' };
    return { color: 'text-cyan-400', message: 'Excellent! Very detailed job description', icon: '🎯' };
  };

  // Handle job URL auto-fill
  const handleUrlParse = async () => {
    if (!jobUrl.trim()) {
      toast.error('Please enter a job posting URL');
      return;
    }

    setIsParsingUrl(true);

    try {
      const response = await fetch('/api/job-url/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: jobUrl.trim() })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Auto-fill the form fields
        if (data.data.jobTitle) setJobTitle(data.data.jobTitle);
        if (data.data.company) setCompanyName(data.data.company);
        if (data.data.location) setJobLocation(data.data.location);
        if (data.data.jobDescription) setJobDescription(data.data.jobDescription);

        toast.success('Job details extracted successfully!', {
          description: 'Review and edit the information as needed'
        });

        // Clear the URL field after successful extraction
        setJobUrl('');
      } else {
        // Check if it's a blocked site error
        if (data.isBlockedSite) {
          toast.error(data.error || 'Site blocks automated access', {
            description: data.details || 'Please copy and paste the job description manually',
            duration: 5000
          });
        } else {
          throw new Error(data.error || 'Failed to parse job URL');
        }
      }
    } catch (error) {
      console.error('Error parsing job URL:', error);
      toast.error('Failed to extract job details', {
        description: 'Please check the URL or enter details manually'
      });
    } finally {
      setIsParsingUrl(false);
    }
  };

  // ✅ FIXED: Load existing job description with minimum loading time
  const loadExistingJobDescription = async () => {
    if (!resumeId) return
    
    startLoading() // Start minimum loading timer
    
    try {
      const response = await fetch(`/api/resumes/${resumeId}/job-description`)
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.jobApplication) {
          const job = data.jobApplication
          setJobTitle(job.jobTitle || '')
          setCompanyName(job.company || '')
          setJobDescription(job.jobDescription || '')
          setJobLocation('')
          setJobRequirements('')
          setJobBenefits('')
          setExistingJobId(job.id)
          setHasJobDescription(job.jobDescription?.length > 100)
          
          console.log('✅ Loaded existing job description')
        }
      }
    } catch (error) {
      console.error('Error loading job description:', error)
    } finally {
      await finishLoading() // Respects minimum duration (800ms)
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      loadExistingJobDescription()
    }
  }, [status])

  // ✅ ADDED: Early return for loading state - let loading.tsx show
  if (shouldHideContent) {
    return <ResumeLoader title="Loading job description" subtitle="Preparing AI optimization..." />
  }

  const handleSaveJobDescription = async () => {
    if (!isJobComplete()) {
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch(`/api/resumes/${resumeId}/job-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle: jobTitle.trim(),
          company: companyName.trim(),
          jobDescription: jobDescription.trim(),
          location: jobLocation.trim() || undefined,
          requirements: jobRequirements.trim() || undefined,
          benefits: jobBenefits.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save job description')
      }

      const data = await response.json()
      setExistingJobId(data.jobApplication.id)
      
      console.log('✅ Job description saved:', data)
      
      return true
    } catch (error) {
      console.error('❌ Failed to save job description:', error)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleNext = async () => {
    const saved = await handleSaveJobDescription()

    if (saved) {
      // Start tailoring process
      setIsTailoring(true)

      try {
        // Call the tailor endpoint
        const response = await fetch(`/api/resumes/${resumeId}/tailor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobTitle: jobTitle.trim(),
            companyName: companyName.trim(),
            jobDescription: jobDescription.trim(),
          }),
        })

        const data = await response.json()

        if (response.ok && data.success) {
          // Show success message
          toast.success('Resume tailored successfully!', {
            description: `Optimized for ${jobTitle} at ${companyName}`,
            duration: 3000
          })

          // Land on this job's tailored version (the master resume is unchanged)
          setTimeout(() => {
            router.push(`/dashboard?showResult=${data.applicationId}`)
          }, 500)
        } else if (response.status === 402 && data.upgradeRequired) {
          setUpgradeReason(data.error || 'Monthly tailoring limit reached.')
          setIsTailoring(false)
        } else {
          throw new Error(data.error || 'Failed to tailor resume')
        }
      } catch (error) {
        console.error('Tailoring error:', error)
        toast.error('Failed to tailor resume', {
          description: error instanceof Error && error.message ? error.message : 'Please try again or continue manually'
        })
        setIsTailoring(false)
      }
    }
  }

  const handleBack = () => {
    router.push(`/dashboard/resume/${resumeId}`)
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin")
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      <UpgradeSheet
        open={!!upgradeReason}
        onOpenChange={(open) => { if (!open) setUpgradeReason(null) }}
        reason={upgradeReason ?? undefined}
      />
      {/* Tailoring Loading Overlay */}
      {isTailoring && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center">
          <div className="text-center">
            <div className="mb-6">
              <Loader2 className="w-16 h-16 text-cyan-400 animate-spin mx-auto" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Tailoring your resume...
            </h2>
            <p className="text-slate-300 text-lg mb-1">
              for {jobTitle} at {companyName}
            </p>
            <p className="text-slate-400 text-sm">
              Using AI to optimize your experience for this specific role
            </p>
            <div className="mt-6 flex justify-center">
              <div className="bg-slate-800/50 rounded-lg px-4 py-2">
                <p className="text-xs text-slate-400">This may take 15-30 seconds</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Background Effects */}
      {isMounted && (
        <>
          {/* Floating Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-cyan-400/20 rounded-full animate-pulse"
                style={{
                  left: `${(i * 13 + 10) % 90 + 5}%`,
                  top: `${(i * 17 + 15) % 80 + 10}%`,
                  animationDelay: `${(i * 0.3) % 3}s`,
                  animationDuration: `${3 + (i % 3)}s`
                }}
              />
            ))}
          </div>

          {/* Dynamic Gradient Mesh */}
          <div 
            className="absolute inset-0 opacity-30 transition-all duration-1000"
            style={{
              backgroundImage: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(139, 92, 246, 0.3) 0%, transparent 70%)`
            }}
          />
        </>
      )}

      {/* Circuit Background */}
      <div className="circuit-bg absolute inset-0"></div>

      {/* Noise Texture Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      <div className="circuit-bg min-h-screen relative z-10">
        {/* Enhanced Header with Premium Glassmorphism */}
        <header className="border-b border-white/10 backdrop-blur-xl bg-slate-900/30 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Brand Logo */}
                <Link href="/" className="flex items-center space-x-2 group">
                  <Logo size="xs" variant="simple" showBadge={false} className="group-hover:scale-110 transition-all duration-300" />
                  <span className="text-xl font-bold gradient-text group-hover:scale-105 transition-transform duration-300">ReWork</span>
                  <BetaBadge size="xs" className="group-hover:scale-105 transition-transform duration-300" />
                </Link>

                <Button onClick={handleBack} variant="ghost" className="text-white hover:bg-white/10 hover:scale-105 transition-all duration-200">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Separator orientation="vertical" className="h-6 bg-white/20" />
                
                {/* Enhanced Step Indicator */}
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center animate-glow">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-green-400 font-medium gradient-text">edit resume</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full btn-gradient flex items-center justify-center animate-glow">
                      <span className="text-sm font-bold text-white">2</span>
                    </div>
                    <span className="text-white font-medium gradient-text">job description</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                      <span className="text-sm font-bold text-slate-400">3</span>
                    </div>
                    <span className="text-slate-400">ai analysis</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {existingJobId && (
                  <Badge className="bg-green-500/20 text-green-300 border border-green-500/30 animate-pulse">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    saved
                  </Badge>
                )}
                <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <Target className="w-3 h-3 mr-1" />
                  step 2 of 3
                </Badge>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Enhanced Page Header */}
            <div className={`text-center space-y-4 transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center mx-auto animate-float">
                <Target className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-2">
                  <span className="gradient-text">add job description</span>
                </h1>
                <p className="text-slate-400 text-lg">
                  enter the job details and description to optimize your resume for this specific role
                </p>
              </div>
            </div>

            {/* Job URL Auto-fill */}
            <Card className={`glass-card border-white/10 hover:scale-[1.01] transition-all duration-300 mb-6 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '150ms' }}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <LinkIcon className="w-4 h-4 text-cyan-400" />
                      <Label className="text-slate-300">Paste job posting URL for auto-fill (optional)</Label>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={jobUrl}
                        onChange={(e) => setJobUrl(e.target.value)}
                        placeholder="https://example.com/job-posting"
                        className="glass-input flex-1"
                        disabled={isParsingUrl}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isParsingUrl) {
                            handleUrlParse();
                          }
                        }}
                      />
                      <Button
                        onClick={handleUrlParse}
                        disabled={isParsingUrl || !jobUrl.trim()}
                        className="btn-gradient px-4"
                      >
                        {isParsingUrl ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Auto-fill
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      We'll extract the job title, company, location, and description from the URL
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Job Entry Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Enhanced Job Details */}
              <Card className={`glass-card border-white/10 hover:scale-[1.01] transition-all duration-300 job-description-form ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '200ms' }}>
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-cyan-500 rounded-lg flex items-center justify-center">
                      <Building className="w-4 h-4 text-white" />
                    </div>
                    <span className="gradient-text">job details</span>
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    basic information about the position
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300 flex items-center gap-2">
                      job title *
                      <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Senior Software Engineer"
                      className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 hover:border-cyan-400/50 focus:border-cyan-400 transition-all duration-300 focus:scale-[1.01]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-slate-300 flex items-center gap-2">
                      company *
                      <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. TechCorp Inc."
                      className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 hover:border-cyan-400/50 focus:border-cyan-400 transition-all duration-300 focus:scale-[1.01]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-slate-300">location</Label>
                    <Input
                      value={jobLocation}
                      onChange={(e) => setJobLocation(e.target.value)}
                      placeholder="e.g. San Francisco, CA (Remote)"
                      className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 hover:border-cyan-400/50 focus:border-cyan-400 transition-all duration-300 focus:scale-[1.01]"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced Progress & Tips */}
              <Card className={`glass-card border-white/10 hover:scale-[1.01] transition-all duration-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '300ms' }}>
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-white" />
                    </div>
                    <span className="gradient-text">progress & tips</span>
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    track completion and optimization tips
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {[
                      { label: 'job title', completed: jobTitle.length > 3, icon: Building },
                      { label: 'company', completed: companyName.length > 2, icon: Building },
                      { label: 'job description', completed: jobDescription.length > 100, icon: FileText }
                    ].map((item, index) => (
                      <div key={item.label} className="flex items-center justify-between group hover:bg-white/5 p-2 rounded-lg transition-all duration-300">
                        <div className="flex items-center gap-2">
                          <item.icon className="w-4 h-4 text-cyan-400" />
                          <span className="text-slate-400 text-sm group-hover:text-slate-300 transition-colors capitalize">{item.label}</span>
                        </div>
                        {item.completed ? (
                          <CheckCircle className="w-4 h-4 text-green-400 animate-pulse" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-600 group-hover:border-slate-500 transition-colors"></div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-white/10 pt-4">
                    <h4 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      💡 pro tips:
                    </h4>
                    <ul className="text-xs text-slate-400 space-y-2">
                      {[
                        "copy the complete job posting for best results",
                        "include responsibilities and requirements",
                        "add company culture and benefits info",
                        "more detail = better optimization"
                      ].map((tip, index) => (
                        <li key={index} className="flex items-start gap-2 hover:text-slate-300 transition-colors p-1 rounded">
                          <span className="text-cyan-400 mt-0.5">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {isJobComplete() && (
                    <div className="border-t border-white/10 pt-4">
                      <button 
                        onClick={handleSaveJobDescription}
                        disabled={isSaving}
                        className="w-full px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded-lg font-medium hover:bg-cyan-500/30 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-3 h-3 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin"></div>
                            saving...
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Save className="w-3 h-3" />
                            save progress
                          </div>
                        )}
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Enhanced Job Description Content */}
            <Card className={`glass-card border-white/10 hover:scale-[1.005] transition-all duration-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '400ms' }}>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <span className="gradient-text">job description</span>
                  <span className="text-red-400 text-sm">*</span>
                </CardTitle>
                <CardDescription className="text-slate-400">
                  paste the complete job description, including responsibilities, requirements, and qualifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">full job description *</Label>
                  <Textarea
                    value={jobDescription}
                    onChange={(e) => {
                      setJobDescription(e.target.value)
                      setHasJobDescription(e.target.value.length > 100)
                    }}
                    placeholder="Paste or type the complete job description here, including:&#10;&#10;• Job overview and responsibilities&#10;• Required qualifications and skills&#10;• Preferred experience&#10;• Company information&#10;• Benefits and compensation details&#10;&#10;The more complete the description, the better we can optimize your resume!"
                    className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 hover:border-cyan-400/50 focus:border-cyan-400 transition-all duration-300 focus:scale-[1.01] min-h-[300px]"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {jobDescription.length} characters
                      {jobDescription.length > 100 && (
                        <span className="text-green-400 ml-2 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          ready for analysis
                        </span>
                      )}
                    </p>
                    <p className={`text-xs ${getDescriptionStatus().color} flex items-center gap-1`}>
                      <span>{getDescriptionStatus().icon}</span>
                      {getDescriptionStatus().message}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Optional Additional Fields */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className={`glass-card border-white/10 hover:scale-[1.01] transition-all duration-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '500ms' }}>
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    requirements & qualifications
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-sm">
                    optional: separate requirements section for better analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={jobRequirements}
                    onChange={(e) => setJobRequirements(e.target.value)}
                    placeholder="• 5+ years of experience&#10;• Bachelor's degree in CS&#10;• Proficiency in React, Node.js&#10;• Experience with AWS..."
                    className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 hover:border-cyan-400/50 focus:border-cyan-400 transition-all duration-300 focus:scale-[1.01] min-h-[120px]"
                  />
                </CardContent>
              </Card>

              <Card className={`glass-card border-white/10 hover:scale-[1.01] transition-all duration-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '600ms' }}>
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    benefits & compensation
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-sm">
                    optional: helps understand company culture and values
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={jobBenefits}
                    onChange={(e) => setJobBenefits(e.target.value)}
                    placeholder="• Competitive salary&#10;• Health insurance&#10;• Remote work options&#10;• Professional development budget..."
                    className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 hover:border-cyan-400/50 focus:border-cyan-400 transition-all duration-300 focus:scale-[1.01] min-h-[120px]"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Enhanced Next Step Button */}
            <Card className={`glass-card border-white/10 hover:scale-[1.01] transition-all duration-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '700ms' }}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium mb-1 flex items-center gap-2">
                      <span className="gradient-text">ready for ai analysis?</span>
                      {isJobComplete() && <Logo size="xs" variant="simple" className="w-5 h-5 text-cyan-400 animate-pulse" />}
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {isJobComplete() 
                        ? "perfect! we have everything needed to analyze and optimize your resume."
                        : "please fill in the required fields (job title, company, and job description) to continue."
                      }
                    </p>
                  </div>
                  <button 
                    onClick={handleNext}
                    disabled={!isJobComplete() || isSaving}
                    className="px-8 py-3 btn-gradient text-white rounded-lg font-medium hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/25 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 start-ai-analysis-button"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
                    <div className="relative z-10 flex items-center gap-2">
                      {isSaving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        isJobComplete() && <Sparkles className="w-4 h-4" />
                      )}
                      Start AI Analysis
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Premium CSS Animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        @keyframes glow {
          from {
            box-shadow: 0 0 20px rgba(44, 199, 208, 0.2);
          }
          to {
            box-shadow: 0 0 30px rgba(44, 199, 208, 0.4), 0 0 40px rgba(139, 92, 246, 0.2);
          }
        }
        
        .animate-glow {
          animation: glow 2s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  )
}