import { describe, expect, it } from 'vitest'
import { buildTailorPrompt } from '@/lib/tailor'
import type { TailorInput } from '@/types/tailor'

const input = { summary: '', roles: [], education: [], projects: [], skills: [] } as unknown as TailorInput
const job = { title: 'Designer', company: 'Acme', description: 'Figma and prototyping.' }

describe('tailor prompt and fit-check keywords', () => {
  it('names the fit check keywords when given', () => {
    const prompt = buildTailorPrompt(input, job, { targetKeywords: ['Figma', 'prototyping'] })
    expect(prompt).toContain('TARGET KEYWORDS')
    expect(prompt).toContain('Figma, prototyping')
  })
  it('leaves the prompt alone without them', () => {
    expect(buildTailorPrompt(input, job)).not.toContain('TARGET KEYWORDS')
  })
})
