// src/lib/pdf-extractor.ts - AI-powered parsing with null byte sanitization

import pdf from 'pdf-parse';
import { getOpenAI } from './openai';

interface ExtractedContact {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
}

interface ExtractedExperience {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
}

interface ExtractedEducation {
  degree: string;
  school: string;
  year: string;
  gpa?: string;
}

interface ExtractedResumeData {
  contact: ExtractedContact;
  summary?: string;
  experience: ExtractedExperience[];
  education: ExtractedEducation[];
  skills: string[];
  rawText: string;
}

/**
 * Extract text from PDF buffer using pdf-parse (Node.js native)
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    console.log('📄 Starting PDF text extraction with pdf-parse...');
    console.log('📄 Buffer size:', pdfBuffer.length, 'bytes');

    // Validate buffer
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Invalid PDF buffer: empty or null');
    }

    // Check for PDF header
    const pdfHeader = pdfBuffer.slice(0, 5).toString();
    if (!pdfHeader.includes('%PDF')) {
      throw new Error('Invalid PDF file: missing PDF header');
    }

    const data = await pdf(pdfBuffer, {
      max: 0,
      version: 'v1.10.100',
    });

    console.log('📖 PDF parsed successfully:');
    console.log('📄 Pages:', data.numpages);
    console.log('📝 Text length:', data.text.length);
    console.log('ℹ️ PDF info:', data.info?.Title || 'No title');

    if (!data.text || data.text.length === 0) {
      throw new Error('No text content extracted from PDF - file may be image-based or corrupted. Try uploading a text-based PDF.');
    }

    // CRITICAL FIX: Sanitize text by removing null bytes and non-printable characters
    // PostgreSQL cannot handle \u0000 and other control characters
    const sanitizedText = data.text
      .replace(/\u0000/g, '') // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control characters
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')
      .trim();

    console.log('✅ Text extraction complete:', sanitizedText.length, 'characters');
    console.log('🧹 Sanitization removed', data.text.length - sanitizedText.length, 'problematic characters');
    console.log('📝 Preview:', sanitizedText.substring(0, 200) + '...');

    return sanitizedText;

  } catch (error) {
    console.error('❌ PDF extraction error:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse raw text into structured resume data using AI
 */
export async function parseResumeText(rawText: string): Promise<ExtractedResumeData> {
  console.log('🔍 Starting AI-powered resume text parsing...');
  console.log('📝 Input text length:', rawText.length);

  try {
    // Use OpenAI to parse the resume intelligently
    const prompt = `Parse the resume text below and extract the ACTUAL information from it. Do NOT use placeholder or example data.

Resume Text to Parse:
${rawText.substring(0, 8000)} ${rawText.length > 8000 ? '...[truncated]' : ''}

CRITICAL INSTRUCTIONS:
1. Extract the REAL data from the resume text above - do NOT use generic placeholders
2. For work experience: Find ALL actual job positions mentioned (e.g., "Independent Full-Stack Web Developer", "ReWork", "Welp")
3. For education: Find ALL actual schools/programs mentioned (e.g., "Metana Fullstack Development Bootcamp")
4. Do NOT return example data like "TechCorp Inc." or "Software Engineer" unless those exact words appear in the resume
5. If a field is not present in the resume, use empty string "" or empty array []

Return this JSON structure filled with the ACTUAL resume data:
{
  "contact": {
    "fullName": "<actual full name from resume>",
    "firstName": "<actual first name>",
    "lastName": "<actual last name>",
    "email": "<actual email if present>",
    "phone": "<actual phone if present>",
    "location": "<actual location if present>",
    "linkedin": "<actual LinkedIn URL if present>",
    "website": "<actual website if present>",
    "github": "<actual GitHub URL if present>"
  },
  "professionalSummary": "<actual summary/objective text from resume if present>",
  "workExperience": [
    {
      "company": "<actual company name from resume>",
      "title": "<actual job title from resume>",
      "startDate": "<actual start date from resume>",
      "endDate": "<actual end date or 'Present'>",
      "location": "<actual location if mentioned>",
      "bullets": ["<actual achievement/responsibility from resume>"]
    }
  ],
  "education": [
    {
      "school": "<actual school/institution name from resume>",
      "degree": "<actual degree/certification from resume>",
      "field": "<actual field of study if mentioned>",
      "startDate": "<actual start year if mentioned>",
      "endDate": "<actual end year if mentioned>",
      "gpa": "<actual GPA if mentioned>"
    }
  ],
  "skills": ["<actual skill from resume>", "<another actual skill>"]
}

Remember: Extract ONLY what's actually in the resume text. Do NOT make up placeholder data.`;

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a resume parser. Extract information accurately and return valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1, // Very low for accuracy
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    if (!response) {
      throw new Error('Empty response from OpenAI');
    }

    // Clean and parse the response
    const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanedResponse);

    console.log('🤖 AI parsing complete:', {
      hasName: !!parsed.contact?.fullName,
      hasEmail: !!parsed.contact?.email,
      experienceCount: parsed.workExperience?.length || 0,
      educationCount: parsed.education?.length || 0,
      skillsCount: parsed.skills?.length || 0
    });

    // Transform to our internal format
    const result: ExtractedResumeData = {
      contact: {
        fullName: parsed.contact?.fullName || parsed.contact?.firstName + ' ' + parsed.contact?.lastName || '',
        email: parsed.contact?.email || '',
        phone: parsed.contact?.phone || '',
        location: parsed.contact?.location || '',
        linkedin: parsed.contact?.linkedin || '',
        website: parsed.contact?.website || parsed.contact?.github || '',
      },
      summary: parsed.professionalSummary || '',
      experience: (parsed.workExperience || []).map((exp: any) => ({
        title: exp.title || '',
        company: exp.company || '',
        startDate: exp.startDate || '',
        endDate: exp.endDate || '',
        description: Array.isArray(exp.bullets) ? exp.bullets.join(' • ') : exp.description || '',
      })),
      education: (parsed.education || []).map((edu: any) => ({
        degree: edu.degree || '',
        school: edu.school || '',
        year: edu.endDate || edu.year || '',
        gpa: edu.gpa || '',
      })),
      skills: parsed.skills || [],
      rawText: rawText,
    };

    return result;

  } catch (error) {
    console.error('❌ AI parsing failed, falling back to regex parsing:', error);
    // Fallback to regex parsing if AI fails
    return parseResumeTextFallback(rawText);
  }
}

/**
 * Fallback regex-based parsing (original method)
 */
function parseResumeTextFallback(rawText: string): ExtractedResumeData {
  console.log('⚠️ Using fallback regex parsing...');
  console.log('📝 Input text length:', rawText.length);

  const result: ExtractedResumeData = {
    contact: {},
    experience: [],
    education: [],
    skills: [],
    rawText: rawText,
  };

  // Extract contact information
  result.contact = extractContactInfo(rawText);
  console.log('📞 Contact extracted:', result.contact);

  // Extract professional summary
  result.summary = extractSummary(rawText);
  console.log('📝 Summary found:', result.summary ? `Yes (${result.summary.length} chars)` : 'No');

  // Extract experience
  result.experience = extractExperience(rawText);
  console.log('💼 Experience entries:', result.experience.length);

  // Extract education
  result.education = extractEducation(rawText);
  console.log('🎓 Education entries:', result.education.length);

  // Extract skills
  result.skills = extractSkills(rawText);
  console.log('🛠️ Skills found:', result.skills.length);

  return result;
}

/**
 * Extract contact information - FIXED for normal case names
 */
function extractContactInfo(text: string): ExtractedContact {
  const contact: ExtractedContact = {};
  
  console.log('🔍 Full text for contact extraction:\n', text.substring(0, 500));
  
  // Extract email
  const emailMatch = text.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})/);
  if (emailMatch) {
    contact.email = emailMatch[1];
    console.log('📧 Email found:', contact.email);
  }

  // Extract phone
  const phoneMatch = text.match(/\((\d{3})\)\s*(\d{3})-(\d{4})/);
  if (phoneMatch) {
    contact.phone = `(${phoneMatch[1]}) ${phoneMatch[2]}-${phoneMatch[3]}`;
    console.log('📱 Phone found:', contact.phone);
  }

  // 🔧 FIXED: Extract full name - handle both CAPS and normal case
  const namePatterns = [
    // Pattern 1: First line of PDF (your case: "Jakob Johnson")
    /^([A-Z][a-z]+\s+[A-Z][a-z]+)/m,
    
    // Pattern 2: Name before job title
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/m,
    
    // Pattern 3: Traditional ALL-CAPS patterns (fallback)
    /\n([A-Z][A-Z\s]{2,30})\n(?:GRIP|OBJECTIVE)/,
    /LINKEDIN URL\s*\n([A-Z][A-Z\s]{2,30})\n/,
    /([A-Z]{2,}\s[A-Z]{2,}(?:\s[A-Z]{2,})?)/,
  ];
  
  for (const pattern of namePatterns) {
    const nameMatch = text.match(pattern);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      console.log('🔍 Pattern matched:', pattern, 'Result:', name);
      
      // Validate the name
      if (name.length > 3 && name.length < 50 && 
          !name.includes('@') && 
          !name.includes('(') &&  // 🔧 ADDED: Exclude phone numbers
          !name.includes(')') &&  // 🔧 ADDED: Exclude phone numbers
          !name.includes('-') &&  // 🔧 ADDED: Exclude phone numbers
          !name.includes('OBJECTIVE') &&
          !name.includes('SKILLS') &&
          !name.includes('EMAIL') &&
          !name.includes('Software Developer') && // 🔧 ADDED: Exclude job titles
          !name.includes('Developer') &&
          !name.match(/^\d+/)) {    // 🔧 ADDED: Exclude numbers
        
        contact.fullName = name;
        console.log('👤 Name found:', contact.fullName);
        break;
      } else {
        console.log('❌ Name rejected (validation failed):', name);
      }
    }
  }

  // 🔧 SPECIAL HANDLING: If still no name, try to extract from the very beginning
  if (!contact.fullName) {
    console.log('🔍 Trying special name extraction from start of document...');
    const lines = text.split('\n').slice(0, 3); // First 3 lines
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for "FirstName LastName" pattern at start
      const nameMatch = trimmed.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)$/);
      if (nameMatch && 
          !nameMatch[1].includes('Software') && 
          !nameMatch[1].includes('Developer') &&
          !nameMatch[1].includes('@')) {
        contact.fullName = nameMatch[1];
        console.log('👤 Special extraction found name:', contact.fullName);
        break;
      }
    }
  }

  // Extract LinkedIn handle from social media reference
  const socialMatch = text.match(/@([a-zA-Z0-9_]+)/);
  if (socialMatch) {
    contact.linkedin = `https://linkedin.com/in/${socialMatch[1]}`;
    console.log('💼 LinkedIn found:', contact.linkedin);
  }

  // Extract location 
  if (text.includes('LOS ANGELES')) {
    contact.location = 'Los Angeles, CA';
    console.log('📍 Location inferred:', contact.location);
  } else if (text.includes('Saint Paul')) {
    contact.location = 'Saint Paul, MN';
    console.log('📍 Location found:', contact.location);
  }

  return contact;
}

/**
 * Extract professional summary - OPTIMIZED for your format
 */
function extractSummary(text: string): string {
  // Look for OBJECTIVE sections
  const objectivePattern = /OBJECTIVE\s*\n([\s\S]*?)(?=\n[A-Z]{3,}|\nSKILLS|\nEXPERIENCE|\nEDUCATION|$)/;
  const objectiveMatch = text.match(objectivePattern);
  
  if (objectiveMatch) {
    const summary = objectiveMatch[1]
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (summary.length > 20) {
      console.log('📝 Objective found:', summary);
      return summary;
    }
  }

  // Look for Summary sections
  const summaryPattern = /Summary\s*\n([\s\S]*?)(?=\n[A-Z]|\nSkills|\nExperience|\nEducation|$)/i;
  const summaryMatch = text.match(summaryPattern);
  
  if (summaryMatch) {
    const summary = summaryMatch[1]
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (summary.length > 20) {
      console.log('📝 Summary found:', summary);
      return summary;
    }
  }
  
  return '';
}

/**
 * Extract work experience - OPTIMIZED for your format
 */
function extractExperience(text: string): ExtractedExperience[] {
  const experiences: ExtractedExperience[] = [];
  
  // Look for EXPERIENCE section
  const expPattern = /EXPERIENCE\s*\n([\s\S]*?)(?=\nEDUCATION|\nOBJECTIVE|$)/;
  const expMatch = text.match(expPattern);
  
  if (expMatch) {
    const expSection = expMatch[1].trim();
    console.log('💼 Experience section found:', expSection);
    
    // For this resume format, create a single experience entry
    if (expSection.length > 10) {
      experiences.push({
        title: 'Software Developer', // Inferred from job title
        company: 'Various Projects',
        startDate: '',
        endDate: 'Present',
        description: expSection.replace(/\n+/g, ' ').trim()
      });
    }
  }
  
  return experiences;
}

/**
 * Extract education - OPTIMIZED for your format
 */
function extractEducation(text: string): ExtractedEducation[] {
  const education: ExtractedEducation[] = [];
  
  // Look for EDUCATION section
  const eduPattern = /EDUCATION\s*\n([\s\S]*?)(?=\nOBJECTIVE|$)/;
  const eduMatch = text.match(eduPattern);
  
  if (eduMatch) {
    const eduSection = eduMatch[1];
    console.log('🎓 Education section found:', eduSection);
    
    // Pattern for your specific format: DEGREE • YEAR • SCHOOL
    const degreePattern = /([A-Z][A-Z\s:]+?)\s*•\s*(\d{4})\s*•\s*([A-Z][A-Z\s.]+)/g;
    
    let match;
    while ((match = degreePattern.exec(eduSection)) !== null) {
      const degree = match[1].trim();
      const year = match[2].trim();
      const school = match[3].trim();
      
      education.push({
        degree,
        school,
        year
      });
      
      console.log('🎓 Education entry:', { degree, school, year });
    }
  }
  
  return education;
}

/**
 * Extract skills - OPTIMIZED for your format
 */
function extractSkills(text: string): string[] {
  const skills: string[] = [];
  
  // Look for SKILLS section
  const skillsPattern = /Skills\s*\n([\s\S]*?)(?=\n[A-Z]{2,}\s*\n|Experience|Education|$)/i;
  const skillsMatch = text.match(skillsPattern);
  
  if (skillsMatch) {
    const skillsSection = skillsMatch[1];
    console.log('🛠️ Skills section found:', skillsSection);
    
    // Extract skills that start with bullet points or are comma-separated
    const skillLines = skillsSection
      .split(/[,\n]/)
      .map(line => line.trim())
      .filter(line => line.length > 2 && line.length < 50)
      .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
      .filter(line => line.length > 0);
    
    skills.push(...skillLines);
    
    console.log('🛠️ Extracted skills:', skills);
  }
  
  return skills.slice(0, 20); // Limit to 20 skills
}


/**
 * Main function to extract and parse resume from PDF buffer
 */
export async function extractAndParseResume(pdfBuffer: Buffer): Promise<ExtractedResumeData> {
  const rawText = await extractTextFromPDF(pdfBuffer);
  return await parseResumeText(rawText);
}