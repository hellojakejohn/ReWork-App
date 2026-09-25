import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { cleanSourceText, itemsToLines, type PositionedItem } from '@/lib/resume-source-text'
import { SourceIndex, validateParsedResume } from '@/lib/parse-validate'
import { masterToParsed, parsedToMaster } from '@/lib/master-resume'
import { PARSE_FAILED_MESSAGE, parseResume, ResumeParseError } from '@/lib/parse-resume'
import type { ParsedResume } from '@/types/parsed-resume'

const RAW = readFileSync(path.join(__dirname, '../../../scripts/fixtures/enhancv-swe.txt'), 'utf8')
const SOURCE = cleanSourceText(RAW)

// What a correct parse of the fixture looks like.
function goodParse(): ParsedResume {
  return {
    contact: {
      fullName: 'JAKOB JOHNSON',
      headline: 'Software Engineer',
      email: 'jakobmjohnson9@gmail.com',
      phone: '(651) 555-0142',
      location: 'Saint Paul, MN',
      links: [
        { label: 'LinkedIn', url: 'https://www.linkedin.com/in/jakob-johnson' },
        { label: 'GitHub', url: 'github.com/hellojakejohn' },
      ],
    },
    summary: 'Full-stack and blockchain engineer who ships production web apps end to end.',
    skills: [
      { group: 'Languages', items: ['TypeScript', 'JavaScript', 'Solidity'] },
      { group: 'Web3', items: ['Hardhat', 'Foundry'] },
    ],
    experience: [
      {
        id: 'exp_1',
        title: 'Founder & Software Engineer',
        company: 'ReWork',
        location: 'Saint Paul, MN',
        startDate: '06/2024',
        endDate: '',
        current: true,
        bullets: ['Built an AI resume tailoring app with Next.js 15, Prisma and Supabase serving 120 users'],
      },
      {
        id: 'exp_2',
        title: 'Independent Full-Stack Web Developer',
        company: 'Self-employed',
        location: 'Remote',
        startDate: '01/2022',
        endDate: '05/2024',
        current: false,
        bullets: ['Delivered 8 client sites in React and Node.js, from design handoff to deployment'],
      },
    ],
    projects: [
      {
        id: 'proj_1',
        name: 'Token Vesting Vault',
        url: 'https://github.com/hellojakejohn/vesting-vault',
        dates: '',
        bullets: ['Solidity vesting contract with cliff and linear release, 100% branch coverage in Foundry'],
        tech: ['Solidity', 'Foundry', 'OpenZeppelin'],
      },
    ],
    education: [
      { id: 'edu_1', school: 'Metana', credential: 'Solidity Bootcamp', field: '', startDate: '', endDate: '2025', details: [] },
    ],
    certifications: [],
    extraSections: [],
  }
}

describe('cleanSourceText', () => {
  it('strips zero-width spaces and icon glyphs without gluing contact fields together', () => {
    expect(SOURCE).not.toMatch(/[​-]/)
    const contactLine = SOURCE.split('\n')[2]
    expect(contactLine).toContain('(651) 555-0142 jakobmjohnson9@gmail.com linkedin.com/in/jakob-johnson')
    expect(contactLine).not.toMatch(/0142jakob|gmail\.comlinkedin/)
  })
})

describe('itemsToLines', () => {
  it('rebuilds an Enhancv-style header from positioned items, separating icon-delimited fields', () => {
    const y = 700
    const items: PositionedItem[] = [
      { str: 'JAKOB ', x: 40, y: 760, width: 60, height: 20 },
      { str: 'JOHNSON', x: 100, y: 760, width: 80, height: 20 },
      { str: 'Software Engineer', x: 40, y: 735, width: 120, height: 12 },
      { str: '', x: 40, y, width: 8, height: 9 },
      { str: '​(651) 555-0142​', x: 50, y, width: 70, height: 9 },
      { str: '', x: 122, y, width: 8, height: 9 },
      { str: 'jakobmjohnson9@gmail.com', x: 132, y, width: 110, height: 9 },
      { str: '', x: 244, y, width: 8, height: 9 },
      { str: 'linkedin.com/in/', x: 254, y, width: 60, height: 9 },
      { str: 'jakob-johnson', x: 314, y, width: 50, height: 9 },
    ]
    expect(itemsToLines(items)).toEqual([
      'JAKOB JOHNSON',
      'Software Engineer',
      '(651) 555-0142 | jakobmjohnson9@gmail.com | linkedin.com/in/jakob-johnson',
    ])
  })

  it('keeps a left date column on the same line as the role, as a separate field', () => {
    const items: PositionedItem[] = [
      { str: '06/2024 - Present', x: 40, y: 500, width: 80, height: 10 },
      { str: 'Founder & Software Engineer', x: 180, y: 500.5, width: 150, height: 10 },
    ]
    expect(itemsToLines(items)).toEqual(['06/2024 - Present | Founder & Software Engineer'])
  })
})

describe('validateParsedResume', () => {
  it('keeps real values untouched', () => {
    const { resume, needsReview } = validateParsedResume(goodParse(), SOURCE)
    expect(needsReview).toEqual([])
    expect(resume.contact.email).toBe('jakobmjohnson9@gmail.com')
    expect(resume.contact.phone).toBe('(651) 555-0142')
    expect(resume.contact.links.map((l) => l.url)).toEqual([
      'https://www.linkedin.com/in/jakob-johnson',
      'github.com/hellojakejohn',
    ])
    expect(resume.projects[0].url).toBe('https://github.com/hellojakejohn/vesting-vault')
    expect(resume.experience.map((e) => e.company)).toEqual(['ReWork', 'Self-employed'])
  })

  it('drops invented links and flags them', () => {
    const parsed = goodParse()
    parsed.contact.links.push(
      { label: 'LinkedIn', url: 'https://linkedin.com/in/gmail' },
      { label: 'GitHub', url: 'github.com/hellojake' } // prefix of the real handle, still invented
    )
    const { resume, needsReview } = validateParsedResume(parsed, SOURCE)
    expect(resume.contact.links.map((l) => l.url)).toEqual([
      'https://www.linkedin.com/in/jakob-johnson',
      'github.com/hellojakejohn',
    ])
    expect(needsReview.filter((n) => n.field === 'contact.links').map((n) => n.value)).toEqual([
      'https://linkedin.com/in/gmail',
      'github.com/hellojake',
    ])
  })

  it('rejects the old fallback garbage: concatenated email, invented company, title as name', () => {
    const parsed = goodParse()
    parsed.contact.email = '(651) 555-0142jakobmjohnson9@gmail.comlinkedin.com/in/jakob-johnson'
    parsed.contact.fullName = 'Software Engineer'
    parsed.experience[0].company = 'Various Projects'
    parsed.education[0].school = 'Stanford University'
    parsed.contact.phone = '(612) 555-9999'

    const { resume, needsReview } = validateParsedResume(parsed, SOURCE)
    expect(resume.contact.email).toBe('')
    expect(resume.contact.fullName).toBe('')
    expect(resume.contact.phone).toBe('')
    expect(resume.experience[0].company).toBe('')
    expect(resume.experience[0].title).toBe('Founder & Software Engineer') // entry itself kept
    expect(resume.education[0].school).toBe('')
    expect(needsReview.map((n) => n.field).sort()).toEqual([
      'contact.email',
      'contact.fullName',
      'contact.phone',
      'education.school',
      'experience.company',
    ])
    expect(needsReview.find((n) => n.field === 'experience.company')?.entryId).toBe('exp_1')
  })

  it('makes entry ids unique', () => {
    const parsed = goodParse()
    parsed.experience[1].id = 'exp_1'
    const { resume } = validateParsedResume(parsed, SOURCE)
    expect(new Set(resume.experience.map((e) => e.id)).size).toBe(2)
  })
})

describe('SourceIndex', () => {
  const src = new SourceIndex('Call +1 (651) 555-0142 or see https://www.example.com/me.\nWorked at Acme\nCorp Inc.')
  it('matches phones with or without country code and formatting', () => {
    expect(src.hasPhone('651-555-0142')).toBe(true)
    expect(src.hasPhone('+1 651 555 0142')).toBe(true)
    expect(src.hasPhone('651-555-0143')).toBe(false)
  })
  it('matches names split across lines', () => {
    expect(src.hasText('Acme Corp Inc.')).toBe(true)
  })
  it('matches URLs regardless of protocol and www', () => {
    expect(src.hasUrl('example.com/me')).toBe(true)
    expect(src.hasUrl('http://example.com/me/')).toBe(true)
    expect(src.hasUrl('example.com/m')).toBe(false)
  })
})

describe('parsedToMaster / masterToParsed', () => {
  it('round-trips a parsed resume through the stored master shape', () => {
    const { resume } = validateParsedResume(goodParse(), SOURCE)
    const master = parsedToMaster(resume)
    expect(master.contactInfo.firstName).toBe('JAKOB')
    expect(master.contactInfo.linkedin).toBe('https://www.linkedin.com/in/jakob-johnson')
    expect(master.workExperience[0].jobTitle).toBe('Founder & Software Engineer')
    expect(master.workExperience[0].endDate).toBe('Present')
    expect(master.skills).toEqual(resume.skills)
    expect(master.projects[0].technologies).toEqual(['Solidity', 'Foundry', 'OpenZeppelin'])
    expect(masterToParsed(master)).toEqual(resume)
  })

  it('reads older master rows', () => {
    const parsed = masterToParsed({
      contactInfo: { firstName: 'Ana', lastName: 'Diaz', email: 'ana@x.io', linkedin: 'linkedin.com/in/ana' },
      professionalSummary: { summary: 'Ops lead.' },
      workExperience: [{ role: 'Manager', company: 'Cafe', dates: '2019 - 2023', description: 'Ran shifts\nHired staff' }],
      skills: { technical: ['Excel'], soft: ['Leadership'] },
    })
    expect(parsed.contact.fullName).toBe('Ana Diaz')
    expect(parsed.contact.links).toEqual([{ label: 'LinkedIn', url: 'linkedin.com/in/ana' }])
    expect(parsed.experience[0]).toMatchObject({ title: 'Manager', startDate: '2019', endDate: '2023', bullets: ['Ran shifts', 'Hired staff'] })
    expect(parsed.skills).toEqual([
      { group: 'Technical', items: ['Excel'] },
      { group: 'Soft', items: ['Leadership'] },
    ])
  })
})

describe('parseResume', () => {
  function fakeClient(impl: () => unknown) {
    const create = vi.fn(async () => impl())
    return { client: { chat: { completions: { create } } } as never, create }
  }

  it('parses pasted text and validates the result', async () => {
    const out = goodParse()
    out.contact.links.push({ label: 'LinkedIn', url: 'linkedin.com/in/gmail' })
    const { client, create } = fakeClient(() => ({
      model: 'gpt-4o-test',
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(out) } }],
    }))
    const stages: string[] = []
    const result = await parseResume({ kind: 'text', text: RAW }, { client, onStage: (s) => stages.push(s) })
    expect(stages).toEqual(['extracting', 'reading', 'checking'])
    expect(result.resume.contact.links).toHaveLength(2)
    expect(result.needsReview).toHaveLength(1)
    const body = (create.mock.calls[0] as unknown as [Record<string, any>])[0]
    expect(body.temperature).toBe(0)
    expect(body.response_format.json_schema.strict).toBe(true)
    // Text input only: no file part, and the cleaned text (no zero-width chars) is sent.
    const parts = body.messages[1].content
    expect(parts.map((p: { type: string }) => p.type)).toEqual(['text'])
    expect(parts[0].text).not.toMatch(/​/)
  })

  it('throws a clear error instead of inventing data when the model call fails', async () => {
    const { client } = fakeClient(() => {
      throw Object.assign(new Error('500 upstream'), { status: 500 })
    })
    const error = await parseResume({ kind: 'text', text: RAW }, { client }).catch((e) => e)
    expect(error).toBeInstanceOf(ResumeParseError)
    expect(error.userMessage).toBe(PARSE_FAILED_MESSAGE)
  })

  it('reports quota exhaustion honestly', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = fakeClient(() => {
      throw Object.assign(new Error('429 You exceeded your current quota'), { status: 429, code: 'insufficient_quota' })
    })
    const error = await parseResume({ kind: 'text', text: RAW }, { client }).catch((e) => e)
    expect(error.userMessage).toBe("Resume reading is temporarily unavailable, we're on it.")
    expect(spy.mock.calls.some((c) => String(c[0]).includes('OPENAI_QUOTA_EXHAUSTED'))).toBe(true)
    spy.mockRestore()
  })

  it('rejects text that is too short to be a resume', async () => {
    const error = await parseResume({ kind: 'text', text: 'hello' }).catch((e) => e)
    expect(error).toBeInstanceOf(ResumeParseError)
    expect(error.status).toBe(422)
  })
})
