"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import {
  FileText,
  Download,
  Target,
  Clock,
  ArrowRight,
  CheckCircle,
  Upload,
  Zap,
  Sparkles,
  Menu,
  X
} from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { FREE_TAILORS_PER_MONTH, PRO_PRICE_PARTS } from "@/lib/plans"

export default function HomePage() {
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 })
  const [isLoaded, setIsLoaded] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  // Client-side mount check
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Mouse tracking for interactive effects (only after mount)
  useEffect(() => {
    if (!isMounted) return

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX / window.innerWidth * 100, y: e.clientY / window.innerHeight * 100 })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [isMounted])

  // Load animation trigger (only after mount)
  useEffect(() => {
    if (!isMounted) return
    setTimeout(() => setIsLoaded(true), 100)
  }, [isMounted])

  // Magnetic button effect
  const handleCtaMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget
    const rect = button.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2

    button.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px) scale(1.05)`
  }

  const handleCtaMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget
    button.style.transform = 'translate(0, 0) scale(1)'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-black relative overflow-hidden bg-dots">
      {/* Floating Particles Background - Only render on client */}
      {isMounted && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(30)].map((_, i) => {
            const animations = ['float-up-slow', 'float-diagonal', 'float-side', 'float-wobble'];
            const sizes = ['w-1 h-1', 'w-1.5 h-1.5', 'w-2 h-2', 'w-0.5 h-0.5'];
            const animation = animations[i % animations.length];
            const size = sizes[i % sizes.length];

            return (
              <div
                key={i}
                className={`absolute ${size} bg-white/30 rounded-full`}
                style={{
                  left: `${(i * 13 + 10) % 90 + 5}%`,
                  top: `${(i * 17 + 15) % 80 + 10}%`,
                  animation: `${animation} ${8 + (i % 5) * 2}s ease-in-out infinite`,
                  animationDelay: `${(i * 0.5) % 5}s`
                }}
              />
            );
          })}
        </div>
      )}

      {/* Dynamic Gradient Mesh Background - Only render on client */}
      {isMounted && (
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)`
          }}
        />
      )}

      <div className="relative z-10">
        {/* Enhanced Header with Glassmorphism */}
        <header className="border-b border-white/10 backdrop-blur-xl bg-slate-900/30 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center space-x-2 group">
                <Logo size="xs" variant="simple" showBadge={false} className="group-hover:scale-110 transition-all duration-300" />
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 group-hover:scale-105 transition-transform duration-300">ReWork</span>
              </Link>

              {/* Navigation Links - responsive */}
              <div className="hidden md:flex items-center space-x-6">
                <a
                  href="#how-it-works"
                  className="text-gray-300 hover:text-white transition-colors duration-200 font-medium"
                >
                  How It Works
                </a>
                <a
                  href="#pricing"
                  className="text-gray-300 hover:text-white transition-colors duration-200 font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Pricing
                </a>
                <Link
                  href="/auth/signin"
                  className="px-4 py-2 text-gray-300 hover:text-white border border-gray-600 hover:border-gray-400 rounded-md transition-all duration-200 font-medium hover:bg-white/5"
                >
                  Login
                </Link>
                <Link href="/auth/signin">
                  <Button
                    className="bg-emerald-500 text-white hover:bg-emerald-400 border-0 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 font-semibold px-6"
                  >
                    Get Started
                  </Button>
                </Link>
              </div>

              {/* Mobile Navigation */}
              <div className="md:hidden flex items-center gap-2">
                <Link href="/auth/signin">
                  <Button
                    size="sm"
                    className="bg-emerald-500 text-white hover:bg-emerald-400 border-0 transition-all duration-300 font-semibold"
                  >
                    Get Started
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="text-white hover:bg-white/10"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900/95 backdrop-blur-xl border-b border-white/10">
            <div className="container mx-auto px-4 py-4 flex flex-col space-y-4">
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white transition-colors duration-200 font-medium py-2"
              >
                How It Works
              </a>
              <a
                href="#pricing"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                  setMobileMenuOpen(false);
                }}
                className="text-gray-300 hover:text-white transition-colors duration-200 font-medium py-2"
              >
                Pricing
              </a>
              <Link
                href="/auth/signin"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white transition-colors duration-200 font-medium py-2"
              >
                Login
              </Link>
            </div>
          </div>
        )}

        {/* Main Hero and Content */}
        <main className="container mx-auto px-4 py-12 md:py-24">
          {/* Revolutionary Hero Section */}
          <div ref={heroRef} className="text-center mb-20 relative">
            {/* Ultra-Premium AI Badge */}
            <div className={`mb-8 transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <Badge className="bg-gradient-to-r from-gray-700/30 to-gray-600/30 text-gray-200 border border-gray-400/40 px-6 py-3 hover:from-gray-700/40 hover:to-gray-600/40 hover:border-gray-400/60 hover:scale-105 transition-all duration-300 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-gray-400/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <span className="relative z-10 flex items-center gap-2 font-medium">
                  <span className="text-white animate-pulse">✦</span>
                  Upload • Optimize • Dominate
                  <span className="text-gray-300 animate-bounce text-xs">●</span>
                </span>
              </Badge>
            </div>

            {/* Revolutionary Animated Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-bold mb-10 leading-tight tracking-tight relative overflow-visible">
              <div
                className={`transition-all duration-1000 delay-200 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              >
                <span
                  className="hover:scale-105 transition-transform duration-300 inline-block"
                  style={isMounted ? {
                    backgroundImage: `linear-gradient(45deg,
                      hsl(0, 0%, ${75 + mousePosition.x * 0.1}%) 0%,
                      hsl(0, 0%, ${80 + mousePosition.y * 0.05}%) 25%,
                      hsl(0, 0%, ${85 + mousePosition.x * 0.05}%) 50%,
                      hsl(0, 0%, ${80 + mousePosition.y * 0.1}%) 75%,
                      hsl(0, 0%, ${75 + mousePosition.x * 0.08}%) 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  } : {
                    backgroundImage: 'linear-gradient(45deg, hsl(0, 0%, 75%) 0%, hsl(0, 0%, 85%) 50%, hsl(0, 0%, 90%) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  smart tech,
                </span>
                <br />
                <span className="text-slate-300 hover:text-slate-100 hover:scale-105 transition-all duration-300 inline-block mr-3">for</span>
                <span
                  className="hover:scale-105 transition-transform duration-300 inline-block"
                  style={isMounted ? {
                    backgroundImage: `linear-gradient(45deg,
                      hsl(0, 0%, ${70 + mousePosition.x * 0.1}%) 0%,
                      hsl(0, 0%, ${75 + mousePosition.y * 0.08}%) 50%,
                      hsl(0, 0%, ${70 + mousePosition.x * 0.05}%) 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  } : {
                    backgroundImage: 'linear-gradient(45deg, hsl(0, 0%, 70%) 0%, hsl(0, 0%, 75%) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  smarter jobs
                </span>
              </div>
            </h1>

            {/* Enhanced Description with Staggered Animation */}
            <div className="max-w-3xl mx-auto mb-14">
              <p className={`text-xl md:text-2xl text-slate-200 mb-4 font-medium hover:text-white transition-all duration-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '400ms' }}>
                Transform your resume in seconds with revolutionary optimization.
              </p>
            </div>

            {/* Magnetic CTA Button */}
            <div className={`flex flex-col sm:flex-row gap-6 justify-center items-center mb-8 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '800ms' }}>
              <Link href="/auth/signin">
                <button
                  onMouseMove={handleCtaMouseMove}
                  onMouseLeave={handleCtaMouseLeave}
                  className="relative px-8 py-4 text-lg font-semibold text-black bg-white rounded-lg overflow-hidden group transition-all duration-300 hover:shadow-xl hover:shadow-white/25 hover:scale-105"
                >
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                  <div className="relative z-10 flex items-center gap-2">
                    Get Started Free
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                  <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
                </button>
              </Link>
            </div>

            {/* Badge under CTA */}
            <div className={`transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '1000ms' }}>
              <Badge className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 text-emerald-300 border border-emerald-500/30 px-4 py-2 text-sm">
                {FREE_TAILORS_PER_MONTH} Free Tailored Resumes per Month • No Credit Card Required
              </Badge>
            </div>

            {/* Floating Particles Animation */}
            {isMounted && [...Array(3)].map((_, i) => (
              <div
                key={`hero-particle-${i}`}
                className="absolute w-64 h-64 opacity-10 rounded-full blur-3xl"
                style={{
                  background: `radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)`,
                  left: `${20 + i * 30}%`,
                  top: `${-10 + i * 20}%`,
                  animation: `floatGradient ${20 + i * 5}s ease-in-out infinite`,
                  animationDelay: `${i * 2}s`
                }}
              />
            ))}
          </div>

          {/* Why It Works - 3 Premium Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-24">
            <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800 hover:border-gray-700 hover:shadow-2xl hover:shadow-white/5 transition-all duration-500 hover:scale-[1.02] group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <CardHeader className="relative z-10">
                <Target className="w-12 h-12 text-blue-400 mb-4 group-hover:scale-110 transition-transform duration-300" />
                <CardTitle className="text-xl text-white group-hover:text-blue-300 transition-colors duration-300">AI-Powered Matching</CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <p className="text-slate-300 group-hover:text-slate-200 transition-colors duration-300">
                  Advanced AI analyzes job descriptions and optimizes your resume for maximum ATS compatibility and keyword matching.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800 hover:border-gray-700 hover:shadow-2xl hover:shadow-white/5 transition-all duration-500 hover:scale-[1.02] group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <CardHeader className="relative z-10">
                <Clock className="w-12 h-12 text-green-400 mb-4 group-hover:scale-110 transition-transform duration-300" />
                <CardTitle className="text-xl text-white group-hover:text-green-300 transition-colors duration-300">Instant Results</CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <p className="text-slate-300 group-hover:text-slate-200 transition-colors duration-300">
                  Transform your resume in seconds, not hours. Get professional results with just a few clicks.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800 hover:border-gray-700 hover:shadow-2xl hover:shadow-white/5 transition-all duration-500 hover:scale-[1.02] group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <CardHeader className="relative z-10">
                <Zap className="w-12 h-12 text-purple-400 mb-4 group-hover:scale-110 transition-transform duration-300" />
                <CardTitle className="text-xl text-white group-hover:text-purple-300 transition-colors duration-300">Stand Out</CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <p className="text-slate-300 group-hover:text-slate-200 transition-colors duration-300">
                  Professional templates and smart formatting ensure your resume looks exceptional and passes ATS filters.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* How It Works Section */}
          <div id="how-it-works" className="mb-24 scroll-mt-20">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-white">
              Three Steps to Your Perfect Resume
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {[
                { icon: Upload, title: "Upload", description: "Drop your existing resume or start from scratch" },
                { icon: Sparkles, title: "Optimize", description: "AI enhances content and matches job requirements" },
                { icon: Download, title: "Download", description: "Get your polished, ATS-ready resume instantly" }
              ].map((step, index) => (
                <div key={index} className="text-center group hover:scale-105 transition-all duration-300">
                  <div className="mx-auto w-20 h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center mb-4 border border-gray-700 group-hover:border-gray-600 group-hover:shadow-lg group-hover:shadow-white/10 transition-all duration-300">
                    <step.icon className="w-10 h-10 text-white group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-white group-hover:text-blue-300 transition-colors duration-300">{step.title}</h3>
                  <p className="text-slate-400 group-hover:text-slate-300 transition-colors duration-300">{step.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Ultra-Modern Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-24">
            <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800 hover:border-gray-700 transition-all duration-300 hover:shadow-xl hover:shadow-white/5 hover:scale-[1.02] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-transparent pointer-events-none"></div>
              <CardHeader className="relative z-10">
                <CardTitle className="text-2xl text-white mb-2">
                  Why ReWork Works
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-4 text-base text-slate-300">
                  {[
                    "AI optimization that actually improves your chances",
                    "Job-specific keyword optimization for better matching",
                    "ATS-friendly formatting that gets past screening systems",
                    "Professional results in seconds, not hours",
                    "Perfect preview-to-PDF consistency every time"
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start gap-3 hover:bg-slate-800/30 p-3 rounded-lg transition-all duration-300 hover:scale-[1.02] group/item">
                      <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0 group-hover/item:text-emerald-400 transition-colors" />
                      <span className="group-hover/item:text-slate-200 transition-colors duration-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800 hover:border-gray-700 transition-all duration-300 hover:shadow-xl hover:shadow-white/5 hover:scale-[1.02] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-transparent pointer-events-none"></div>
              <CardHeader className="relative z-10">
                <CardTitle className="text-2xl text-white mb-2">
                  Perfect For
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-6">
                  <div className="group/item hover:bg-slate-800/30 p-4 rounded-lg transition-all duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-5 h-5 text-blue-400" />
                      <span className="font-semibold text-white group-hover/item:text-blue-300 transition-colors">Job Seekers</span>
                    </div>
                    <p className="text-slate-400 text-sm group-hover/item:text-slate-300 transition-colors">Stand out from hundreds of applicants with optimized resumes</p>
                  </div>
                  <div className="group/item hover:bg-slate-800/30 p-4 rounded-lg transition-all duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <Zap className="w-5 h-5 text-purple-400" />
                      <span className="font-semibold text-white group-hover/item:text-purple-300 transition-colors">Career Changers</span>
                    </div>
                    <p className="text-slate-400 text-sm group-hover/item:text-slate-300 transition-colors">Highlight transferable skills and pivot your experience effectively</p>
                  </div>
                  <div className="group/item hover:bg-slate-800/30 p-4 rounded-lg transition-all duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <Target className="w-5 h-5 text-green-400" />
                      <span className="font-semibold text-white group-hover/item:text-green-300 transition-colors">Professionals</span>
                    </div>
                    <p className="text-slate-400 text-sm group-hover/item:text-slate-300 transition-colors">Keep your resume updated and optimized for new opportunities</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pricing Section */}
          <div id="pricing" className="mt-32 mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 text-white">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-slate-400 text-center mb-12 max-w-2xl mx-auto">
              Start free and upgrade when you're ready. No hidden fees, no surprises.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 max-w-6xl mx-auto px-4 md:px-8">
              {/* Free Tier */}
              <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800 hover:border-gray-700 transition-all duration-300 hover:shadow-xl hover:shadow-white/5 hover:scale-[1.02] relative overflow-hidden flex flex-col">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800/20 to-transparent pointer-events-none"></div>
                <CardHeader className="relative z-10">
                  <CardTitle className="text-2xl text-white mb-2">Free</CardTitle>
                  <div className="text-3xl font-bold text-white">$0<span className="text-lg font-normal text-gray-400">/month</span></div>
                </CardHeader>
                <CardContent className="relative z-10 space-y-4 flex-1 flex flex-col">
                  <div className="space-y-3 flex-1">
                    {[
                      { text: `${FREE_TAILORS_PER_MONTH} tailored resumes per month`, included: true },
                      { text: "AI-powered improvements", included: true },
                      { text: "Basic templates", included: true },
                      { text: "PDF export", included: true },
                      { text: "ATS compatibility check", included: true },
                      { text: "Cover letter generation", included: false },
                      { text: "LinkedIn optimization tips", included: false },
                      { text: "24/7 priority support", included: false }
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        {feature.included ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 text-gray-600 flex-shrink-0 flex items-center justify-center">
                            <span className="text-lg leading-none">×</span>
                          </div>
                        )}
                        <span className={feature.included ? "text-gray-300" : "text-gray-600 line-through"}>
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Link href="/auth/signin" className="block mt-auto">
                    <Button className="w-full bg-white/10 text-white hover:bg-white/20 border border-gray-700 hover:border-gray-600">
                      Get Started Free
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Pro Tier */}
              <Card className="bg-gradient-to-br from-gray-900 to-gray-800 backdrop-blur-xl border-emerald-800/50 hover:border-emerald-700/50 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10 hover:scale-[1.02] relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-4 bg-emerald-500 text-black text-xs font-bold px-3 py-1 rounded-b-lg">POPULAR</div>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 to-transparent pointer-events-none"></div>
                <CardHeader className="relative z-10">
                  <CardTitle className="text-2xl text-white mb-2">Pro</CardTitle>
                  <div className="text-3xl font-bold text-white">{PRO_PRICE_PARTS.amount}<span className="text-lg font-normal text-gray-400">{PRO_PRICE_PARTS.period}</span></div>
                </CardHeader>
                <CardContent className="relative z-10 space-y-4">
                  <div className="space-y-3">
                    {[
                      "Unlimited tailored resumes",
                      "Advanced AI analysis",
                      "All premium templates",
                      "Priority processing",
                      "ATS simulation & scoring",
                      "Cover letter generation",
                      "LinkedIn optimization tips",
                      "24/7 priority support"
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        <span className="text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-500 border-0 hover:shadow-lg hover:shadow-emerald-500/25 mt-auto">
                    Upgrade to Pro
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Before/After Comparison Section */}
          <div className="mt-32 mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 text-white">
              See the Difference AI Makes
            </h2>
            <p className="text-lg text-slate-400 text-center mb-12 max-w-2xl mx-auto">
              Real examples of how ReWork transforms generic bullets into powerful achievements
            </p>
            <div className="space-y-8 max-w-5xl mx-auto">
              {[
                {
                  before: "Handled customer complaints and resolved issues",
                  after: "Resolved 150+ customer escalations monthly, achieving 96% satisfaction rating and reducing churn by 23%"
                },
                {
                  before: "Built websites for clients using modern technologies",
                  after: "Architected and delivered 14 client web applications using React and Node.js, generating $2.1M in combined client revenue"
                },
                {
                  before: "Managed social media accounts for the company",
                  after: "Grew company social presence from 2K to 47K followers across 3 platforms, driving 340% increase in organic lead generation"
                }
              ].map((example, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
                  <Card className="bg-gray-900/50 backdrop-blur-xl border-red-900/30 hover:border-red-800/50 transition-all duration-300 p-6">
                    <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Before</div>
                    <p className="text-gray-300">{example.before}</p>
                  </Card>
                  <div className="hidden md:flex items-center justify-center">
                    <div className="bg-gradient-to-r from-red-500 to-emerald-500 p-3 rounded-full">
                      <ArrowRight className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <Card className="bg-gray-900/50 backdrop-blur-xl border-emerald-900/30 hover:border-emerald-800/50 transition-all duration-300 p-6">
                    <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">After AI Optimization</div>
                    <p className="text-white font-medium">{example.after}</p>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Ultra-Modern Footer */}
        <footer className="border-t border-white/10 backdrop-blur-xl bg-slate-900/30 mt-24 hover:border-white/20 transition-colors duration-500">
          <div className="container mx-auto px-4 py-12 text-center">
            <p className="text-slate-400 hover:text-slate-300 transition-colors duration-300 cursor-default mb-4">
              © 2026 ReWork • Professional Resume Optimization Platform
            </p>
            <div className="flex justify-center items-center gap-6 text-sm">
              <Link
                href="/terms"
                className="text-slate-400 hover:text-white transition-colors duration-300"
              >
                Terms of Service
              </Link>
              <div className="w-px h-4 bg-white/20"></div>
              <Link
                href="/privacy"
                className="text-slate-400 hover:text-white transition-colors duration-300"
              >
                Privacy Policy
              </Link>
              <div className="w-px h-4 bg-white/20"></div>
              <a
                href="mailto:support@rework.solutions"
                className="text-slate-400 hover:text-white transition-colors duration-300"
              >
                Contact
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}