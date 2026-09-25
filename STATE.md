# ReWork Project State

## Project Overview
**Project:** ReWork (rework.hellojakejohn.com) - AI-powered resume optimization platform

## Tech Stack
- Next.js 15.3.2 (Turbopack)
- TypeScript
- PostgreSQL via Supabase (us-west-2, project ref: oxedndnmssyuffkfkcug)
- Prisma ORM v6.8.2
- NextAuth v4 with Google OAuth
- Supabase Storage (replaced AWS S3)
- OpenAI API (GPT-4o)
- Tailwind CSS + Radix UI
- @react-pdf/renderer for PDF generation

## Environment Variables Required
- DATABASE_URL (Supabase PostgreSQL session pooler, us-west-2)
- NEXTAUTH_URL
- NEXTAUTH_SECRET
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- OPENAI_API_KEY
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_PARSE_MODEL (optional, default gpt-4o): resume parsing
- OPENAI_TAILOR_MODEL (optional, default gpt-4o): tailoring
- OPENAI_JOB_MODEL (optional, default gpt-4o-mini): job page extraction fallback

## One-page flow (9/26)
The app is one page at `/dashboard`: upload or paste a resume -> paste a job URL -> tailor ->
result (preview, per-bullet accept/revert, keywords, fact-guard warnings, Classic/Modern PDF).
The old editor, job-description page, tutorial and chat bubble are gone. `/api/health`
(admins) checks keys, DB and one OpenAI call.

## What's Working ✅
- Database connected and all 8 tables created ✅
- Google OAuth authentication ✅
- App boots and all pages load ✅
- Storage switched from AWS S3 to Supabase Storage ✅
- Upload UX fixed (removed fake progress bar) ✅
- Auto-fill from PDF with accurate AI parsing (no placeholders) ✅
- Null byte sanitization for PostgreSQL compatibility ✅
- Save button feedback added ✅
- "Resume not found" flash eliminated with proper loading states ✅
- Tutorial persistence for returning users (localStorage flags) ✅
- Live preview with empty state and real-time updates ✅
- Duplicate toast notifications fixed (removed from providers.tsx) ✅
- Professional badge positioning fixed in preview ✅
- Job URL auto-fill feature (paste URL → extract job details) ✅
- Smooth upload redirect with transition message ✅
- **AI Resume Tailoring**: Complete flow from job description to tailored resume ✅
- **Undo Tailoring**: Restore original resume with one click ✅
- **Blocked Site Detection**: Graceful handling of Indeed/LinkedIn/Glassdoor ✅

## What's NOT Done Yet
- Stripe integration for payments (FREE/PREMIUM plans exist in schema)
- npm audit fix (21 vulnerabilities: 3 critical, 4 high)
- Prisma upgrade (6.8.2 → 7.x available)
- End-to-end testing of full resume flow
- PDF export testing
- Production deployment
- Admin panel completion
- Feedback system completion
- Rate limiting on API routes
- Error boundaries
- Resume versioning UI
- Dark theme for auth pages (signin/signup)
- Complete migration of all remaining purple-themed components

## Latest Updates (2/19/26)

### CHUNK 9 - UI Refinement Complete ✅
- **Landing Page as Design Reference**: Used landing page color palette throughout app
- **Color Scheme Updates**:
  - Background: `from-slate-950 via-gray-900 to-black` gradient
  - Cards: `bg-slate-800/40` with `border-white/10`
  - Text: `slate-200` primary, `slate-400` secondary, `slate-500` muted
  - Accent: `emerald-400/500` for success states
  - Removed all remaining purple/violet colors
- **Navigation & Status Bar**:
  - Updated to match landing page with `bg-slate-900/30` backdrop blur
  - Proper slate color scheme for text and borders
- **Dashboard Polish**:
  - Resume cards now use landing page card styling
  - Better hover states with `hover:border-white/30`
  - Consistent spacing and padding
- **Editor Improvements**:
  - Added Auto-fill from PDF button prominently at top
  - Right panel with Preview/Job toggle tabs
  - Live resume preview on white card background
  - Job panel styled with slate colors matching landing page
  - Tailor button uses `emerald-500` accent color
- **Form Components**:
  - Inputs/textareas: `bg-slate-800/30` with proper hover/focus states
  - Consistent border colors and transitions
  - Removed emojis, using clean text labels
- **Section Behavior**:
  - Smooth expand/collapse with rotating chevron
  - Proper transitions and overflow handling
  - Emerald accent for completed sections
- **API Fix**:
  - Added PUT method to resume API route
  - Fixed field mapping for compatibility
- **Loading Screen**:
  - Updated to use slate/gray colors instead of purple
  - Matches overall app theme

## Previous Updates (2/19/26)

### CHUNK 8 - UI Polish Pass Complete ✅
- **Enhanced Dark Theme**: Added craft and visual hierarchy back while maintaining dark aesthetic
- **Global CSS Variables**: Enhanced with proper spacing, radius, and height variables
- **Shared Navigation Component**: Built reusable nav with user menu and settings integration
- **Status Bar Component**: Created bottom status bar for plan info and auto-save status
- **Dashboard Polish**:
  - Improved card styling with icons and hover states
  - Better spacing and padding throughout
  - Resume cards with proper visual hierarchy
  - Smooth transitions and subtle animations
- **Editor Split-Panel Layout**:
  - Fixed navigation with back link and resume title
  - Collapsible right panel for job description
  - Edit/Preview toggle with smooth transitions
  - Auto-save with debouncing and status indicators
- **Form Components Styling**:
  - Updated Input, Textarea, Button, Card components
  - Consistent border radius (8px cards, 6px inputs/buttons)
  - Hover states with border brightening
  - Proper padding and transitions
- **Landing Page Colors**:
  - Replaced all purple/violet gradients with dark grays
  - Kept all animations and effects
  - Changed CTAs to white buttons with dark text
  - Updated hero gradients to use subtle gray tones
- **Typography Improvements**:
  - System fonts with tight letter-spacing
  - Proper size hierarchy (11px-20px scale)
  - Font weights adjusted (600 for headings)

## Previous Updates (2/18/26)

### CHUNK 7 - UI Redesign Complete ✅
- **Complete Dark Minimal Theme**: Implemented Linear-inspired dark design system
- **New Color Palette**: Near-black background (#0A0A0B), subtle borders, clean whites
- **Simplified Dashboard**: Removed stats cards, activity feed, verbose headers - now minimal
- **Unified Editor**: Merged 3-step flow into single page with collapsible job panel
- **Component Restyling**: Updated all UI components with dark theme
- **Typography**: System fonts, tight letter-spacing, proper size hierarchy
- **Layout Changes**:
  - Clean top nav with minimal branding
  - Single-page editor with slide-out job description panel
  - Bottom status bar for plan info
  - Edit/Preview toggle in header
- **Removed**: Purple gradients, glows, animations, circuit backgrounds

## Previous Fixes (2/18/26)

### Round 1 - Core Auto-fill & UI Fixes
- **Auto-fill null byte error**: Fixed by sanitizing PDF text to remove \u0000 and control characters
- **PDF parsing accuracy**: Replaced regex parsing with OpenAI GPT-4o-mini for intelligent extraction
- **Tutorial persistence**: Fixed localStorage flag handling (tutorial_completed, tutorial_dismissed, tutorial_seen)
- **Duplicate toasts**: Removed duplicate Toaster from providers.tsx, kept only in layout.tsx
- **Resume not found flash**: Added proper loading state management (isDataLoading flag)
- **Live preview**: Added empty state, fixed data display, fixed Professional badge overlap

### Round 2 - Polish & Feature Additions
- **Work Experience parsing**: Updated OpenAI prompt to extract ACTUAL job data, not placeholders
- **Education parsing**: Fixed prompt to extract real school names and programs from resume text
- **Live preview sections**: Fixed experience/education display to show all entries with proper formatting
- **Job URL auto-fill**: Added new feature to paste job posting URL and auto-extract details using cheerio + OpenAI
- **Upload redirect UX**: Reduced delay from 1.5s to 0.5s, added "Taking you to the editor..." toast message
- **Section completion logic**: Identified issue (isComplete prop vs completionScore) - needs refactor to sync

### Round 3 - Tailored Resume Generation (Complete Flow Rebuild)
- **NEW /api/resumes/[id]/tailor endpoint**: Uses GPT-4o (not mini) with temperature 0.7 for natural language
- **High-quality AI prompt**: Maintains factual accuracy, rewrites for specific role, preserves authentic voice
- **Streamlined flow**: Job description → Tailoring loading screen → Back to editor with tailored content
- **"Tailored for" banner**: Shows job/company, includes "Undo Tailoring" button
- **Undo functionality**: Restores original pre-tailored content from originalContent field
- **Indeed/LinkedIn blocker**: Detects blocked sites, shows graceful error message
- **Loading overlay**: "Tailoring your resume for [Job] at [Company]" with 15-30 second estimate

## Known Issues to Investigate
- PDF export confirmed working with Supabase Storage ✅
- TypeScript errors fixed (companyName → company field) ✅
- 21 security vulnerabilities need addressing
- Some files are 600+ lines and need refactoring
- No tests exist

## Database Schema
8 models: Account, Session, User, Resume, ResumeVersion, JobApplication, Feedback, VerificationToken
3 enums: Plan (FREE/PREMIUM), ApplicationStatus, FeedbackType