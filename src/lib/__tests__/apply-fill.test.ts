import { describe, expect, it } from 'vitest'
import { fieldKind, matchAnswer, splitName, valueFor, type ApplyPacket } from '@/lib/apply-fill'

const input = (text: string, type = 'text', autocomplete = '') => fieldKind({ text, tag: 'input', type, autocomplete })
const area = (text: string) => fieldKind({ text, tag: 'textarea', type: 'textarea' })

describe('fieldKind', () => {
  it('reads Greenhouse, Lever and Ashby style labels', () => {
    expect(input('First Name * first_name')).toBe('firstName')
    expect(input('Last Name * last_name')).toBe('lastName')
    expect(input('Full name name')).toBe('fullName')
    expect(input('Name *')).toBe('fullName')
    expect(input('Email * email', 'email')).toBe('email')
    expect(input('Phone', 'tel')).toBe('phone')
    expect(input('LinkedIn Profile urls[LinkedIn]')).toBe('linkedin')
    expect(input('GitHub URL')).toBe('github')
    expect(input('Portfolio URL')).toBe('website')
    expect(input('Website')).toBe('website')
    expect(input('Current location')).toBe('location')
    expect(input('', 'text', 'given-name')).toBe('firstName')
    expect(input('Resume/CV resume', 'file')).toBe('resumeFile')
    expect(input('', 'file')).toBe('resumeFile')
    expect(area('Cover Letter cover_letter_text')).toBe('coverLetter')
    expect(area('Why do you want to work at Acme?')).toBe('question')
  })
  it('leaves alone what the person must answer, and what is not text', () => {
    for (const t of ['Desired salary', 'Will you now or in the future require sponsorship?', 'Are you legally authorized to work in the US?', 'Gender', 'Veteran status', 'How did you hear about us?', 'Referred by'])
      expect(input(t), t).toBeNull()
    expect(area('What are your salary expectations?')).toBeNull()
    expect(input('Cover letter', 'file')).toBeNull()
    expect(input('I agree', 'checkbox')).toBeNull()
    expect(input('Email', 'password')).toBeNull()
    expect(input('Willing to relocate? Location')).toBeNull()
    expect(area('Notes')).toBeNull()
  })
})

describe('answers and names', () => {
  const answers = [
    { question: 'Why do you want to work here?', answer: 'Because of the mission.' },
    { question: 'Tell us about a project you are proud of.', answer: 'The checkout rebuild.' },
  ]
  it('matches a form question to a saved answer by its words', () => {
    expect(matchAnswer('Why do you want to work at Acme? (required)', answers)).toBe('Because of the mission.')
    expect(matchAnswer('Describe a project you are most proud of', answers)).toBe('The checkout rebuild.')
    expect(matchAnswer('What is your favorite color?', answers)).toBeNull()
  })
  it('splits names and picks values', () => {
    expect(splitName('Jane van der Berg')).toEqual({ firstName: 'Jane', lastName: 'van der Berg' })
    expect(splitName('Cher')).toEqual({ firstName: 'Cher', lastName: '' })
    const packet: ApplyPacket = {
      applicationId: 'a', jobTitle: 'Ops', company: 'Acme', coverLetter: 'Dear team', answers,
      contact: { firstName: 'Jane', lastName: 'Doe', fullName: 'Jane Doe', email: 'j@x.com', phone: '555', location: 'Saint Paul, MN', linkedin: '', github: 'https://github.com/j', website: '' },
    }
    expect(valueFor('website', packet, '')).toBe('https://github.com/j')
    expect(valueFor('linkedin', packet, '')).toBeNull()
    expect(valueFor('coverLetter', packet, '')).toBe('Dear team')
  })
})
