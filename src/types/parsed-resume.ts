// What the resume parser returns (enforced by the JSON schema in src/lib/parse-resume.ts),
// and what the validation layer flags. No runtime imports.

export interface ParsedLink {
  label: string
  url: string
}

export interface ParsedContact {
  fullName: string
  headline: string
  email: string
  phone: string
  location: string
  links: ParsedLink[]
}

export interface ParsedSkillGroup {
  group: string // "" when the resume lists skills without headings
  items: string[]
}

export interface ParsedExperience {
  id: string
  title: string
  company: string
  location: string
  startDate: string
  endDate: string
  current: boolean
  bullets: string[]
}

export interface ParsedProject {
  id: string
  name: string
  url: string
  dates: string
  bullets: string[]
  tech: string[]
}

export interface ParsedEducation {
  id: string
  school: string
  credential: string
  field: string
  startDate: string
  endDate: string
  details: string[]
}

export interface ParsedCertification {
  name: string
  issuer: string
  date: string
}

export interface ParsedExtraSection {
  heading: string
  items: string[]
}

export interface ParsedResume {
  contact: ParsedContact
  summary: string
  skills: ParsedSkillGroup[]
  experience: ParsedExperience[]
  projects: ParsedProject[]
  education: ParsedEducation[]
  certifications: ParsedCertification[]
  extraSections: ParsedExtraSection[]
}

// A value the validator dropped because it isn't in the source file. The UI shows these
// as "things to check" with a yellow dot on the field.
export interface NeedsReviewItem {
  field: string // e.g. "contact.email", "contact.links", "experience.company", "education.school"
  entryId?: string
  value: string
  reason: string
}

export interface ParseResult {
  resume: ParsedResume
  needsReview: NeedsReviewItem[]
  sourceText: string
  model: string
}
