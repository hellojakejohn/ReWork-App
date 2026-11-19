import { describe, expect, it } from 'vitest'
import { isTemplateId, TEMPLATES, TEMPLATE_STYLE } from '@/lib/resume-templates'

describe('templates', () => {
  it('every listed template has a style and passes isTemplateId', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['classic', 'modern', 'executive', 'compact'])
    for (const t of TEMPLATES) {
      expect(isTemplateId(t.id)).toBe(true)
      expect(TEMPLATE_STYLE[t.id]).toBeDefined()
    }
    expect(isTemplateId('fancy')).toBe(false)
    expect(isTemplateId(null)).toBe(false)
  })
})
