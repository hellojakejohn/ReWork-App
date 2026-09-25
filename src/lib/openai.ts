// src/lib/openai.ts
import OpenAI from 'openai'

let client: OpenAI | null = null

/** Created on first use so importing this module (and `next build`) works without env. */
export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

export interface ResumeAnalysis {
  matchScore: number
  matchedKeywords: string[]
  missingKeywords: string[]
  suggestions: AnalysisSuggestion[]
  atsScore: number
  readabilityScore: number
  completenessScore: number
  optimizedContent?: Record<string, unknown>
}

export interface AnalysisSuggestion {
  section: 'Professional Summary' | 'Experience' | 'Skills' | 'Education' | 'Contact'
  type: 'improve' | 'add'
  current: string
  suggested: string
  impact: 'high' | 'medium' | 'low'
  reason: string
}

export interface JobDetails {
  title: string
  company: string
  description: string
  url?: string
}

/**
 * Analyzes a resume against a job description using OpenAI
 */
export async function analyzeResumeForJob(
  resumeText: string,
  jobDetails: JobDetails
): Promise<ResumeAnalysis> {
  
  const prompt = createAnalysisPrompt(resumeText, jobDetails)
  
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert resume optimization specialist and ATS consultant. 
                   You help job seekers improve their resumes for specific positions.
                   Always respond with valid JSON only, no additional text.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2, // Low temperature for consistent results
      max_tokens: 2500,
    })

    const response = completion.choices[0]?.message?.content
    if (!response) {
      throw new Error('Empty response from OpenAI')
    }

    // Clean the response (remove any non-JSON content)
    const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim()
    const analysis = JSON.parse(cleanedResponse) as ResumeAnalysis

    // Validate and sanitize the analysis
    return validateAnalysis(analysis)

  } catch (error) {
    console.error('OpenAI API error:', error)
    throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generates optimized content for specific resume sections
 */
export async function optimizeResumeSection(
  sectionName: string,
  currentContent: string,
  jobDescription: string,
  targetRole: string
): Promise<string> {
  
  const prompt = `
Optimize this ${sectionName} section of a resume for a ${targetRole} position.

Current ${sectionName}:
${currentContent}

Job Description:
${jobDescription}

ONE-PAGE OPTIMIZATION INSTRUCTIONS:
- Keep the same factual information but optimize for conciseness
- Improve keyword alignment with the job description
- Enhance impact and clarity while maintaining brevity
- Maintain professional tone
- Use action verbs and quantified achievements where appropriate
- Ensure ATS-friendly formatting
- CRITICAL: Optimize for maximum impact in minimum space (one-page format)
- For Work Experience: Limit each job description to 150-180 characters
- For Professional Summary: Keep under 200 characters total
- For Skills: Focus on the most relevant 8-12 skills only
- Prioritize recent and job-relevant content over older experience

Return only the optimized ${sectionName} content, no additional text.
`

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional resume writer. Return only the optimized content, no explanations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
    })

    return completion.choices[0]?.message?.content?.trim() || currentContent

  } catch (error) {
    console.error('Section optimization error:', error)
    return currentContent // Return original if optimization fails
  }
}

/**
 * Extracts keywords from a job description
 */
export async function extractJobKeywords(jobDescription: string): Promise<string[]> {
  
  const prompt = `
Extract the most important keywords and skills from this job description.
Focus on technical skills, tools, frameworks, methodologies, and key qualifications.

Job Description:
${jobDescription}

Return a JSON array of 15-20 most important keywords. Example: ["JavaScript", "React", "Node.js", "AWS", "Agile"]
`

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Extract keywords and return valid JSON array only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 300,
    })

    const response = completion.choices[0]?.message?.content?.trim()
    if (!response) return []

    const keywords = JSON.parse(response) as string[]
    return Array.isArray(keywords) ? keywords.slice(0, 20) : []

  } catch (error) {
    console.error('Keyword extraction error:', error)
    return []
  }
}

// Helper Functions

function createAnalysisPrompt(resumeText: string, jobDetails: JobDetails): string {
  return `
Analyze this resume against the job posting and provide optimization recommendations.

JOB POSTING:
Position: ${jobDetails.title}
Company: ${jobDetails.company}
Description: ${jobDetails.description}

RESUME:
${resumeText}

Provide analysis as JSON with this exact structure:
{
  "matchScore": <0-100 integer>,
  "matchedKeywords": ["keyword1", "keyword2"],
  "missingKeywords": ["missing1", "missing2"],
  "suggestions": [
    {
      "section": "Professional Summary",
      "type": "improve",
      "current": "existing content excerpt",
      "suggested": "specific improvement",
      "impact": "high",
      "reason": "explanation"
    }
  ],
  "atsScore": <0-100 integer>,
  "readabilityScore": <0-100 integer>,
  "completenessScore": <0-100 integer>
}

Guidelines:
- matchScore: Overall job compatibility
- matchedKeywords: Key skills/terms found in resume (max 15)
- missingKeywords: Important job requirements missing (max 10)
- suggestions: Specific improvements (max 6, focus on highest impact)
- atsScore: ATS system compatibility
- readabilityScore: Clarity and structure
- completenessScore: Coverage of job requirements

CRITICAL ONE-PAGE OPTIMIZATION REQUIREMENTS:
- ALL suggestions MUST prioritize the most recent and relevant experience
- Professional Summary should be 150-200 characters max for optimal one-page fit
- Work Experience: Focus on top 3 most recent/relevant positions only
- Job descriptions should be 150-180 characters each with key achievements
- Education: Include only highest degree and most relevant certifications
- Skills: Prioritize the 8-12 most important skills that match the job
- Remove or de-prioritize older, less relevant experience to ensure one-page format
- Optimize for maximum impact per line while maintaining ATS compatibility

Focus on technical skills, relevant experience, ATS optimization, and ONE-PAGE FORMAT.
`
}

function validateAnalysis(analysis: {
  matchScore?: number;
  matchedKeywords?: unknown;
  missingKeywords?: unknown;
  suggestions?: unknown;
  atsScore?: number;
  readabilityScore?: number;
  completenessScore?: number;
}): ResumeAnalysis {
  return {
    matchScore: clamp(analysis.matchScore || 0, 0, 100),
    matchedKeywords: Array.isArray(analysis.matchedKeywords) 
      ? analysis.matchedKeywords.slice(0, 15)
      : [],
    missingKeywords: Array.isArray(analysis.missingKeywords)
      ? analysis.missingKeywords.slice(0, 10)
      : [],
    suggestions: Array.isArray(analysis.suggestions)
      ? analysis.suggestions.slice(0, 6).map(validateSuggestion)
      : [],
    atsScore: clamp(analysis.atsScore || 0, 0, 100),
    readabilityScore: clamp(analysis.readabilityScore || 0, 0, 100),
    completenessScore: clamp(analysis.completenessScore || 0, 0, 100),
  }
}

function validateSuggestion(suggestion: {
  section?: string;
  type?: string;
  current?: unknown;
  suggested?: unknown;
  impact?: string;
  reason?: unknown;
}): AnalysisSuggestion {
  const validSections = ['Professional Summary', 'Experience', 'Skills', 'Education', 'Contact']
  const validTypes = ['improve', 'add']
  const validImpacts = ['high', 'medium', 'low']

  return {
    section: validSections.includes(suggestion.section || '') ? suggestion.section as any : 'Professional Summary',
    type: validTypes.includes(suggestion.type || '') ? suggestion.type as any : 'improve',
    current: String(suggestion.current || ''),
    suggested: String(suggestion.suggested || ''),
    impact: validImpacts.includes(suggestion.impact || '') ? suggestion.impact as any : 'medium',
    reason: String(suggestion.reason || ''),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// Cost estimation utilities
export function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}

export function estimateCost(inputTokens: number, outputTokens: number): number {
  // GPT-4o-mini pricing (approximate)
  const inputCostPer1k = 0.00015  // $0.15 per 1K input tokens
  const outputCostPer1k = 0.0006  // $0.60 per 1K output tokens
  
  return (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k
}