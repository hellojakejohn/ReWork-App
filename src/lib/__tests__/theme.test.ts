import { describe, expect, it } from 'vitest'
import { THEME_SCRIPT, THEME_STORAGE_KEY, applyTheme, parseThemeChoice, resolveTheme } from '@/lib/theme'

function fakeRoot() {
  const classes = new Set<string>()
  return {
    classes,
    classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) },
    style: { colorScheme: '' },
  }
}

/** Runs the inline <head> script against fake browser globals. */
function runScript(stored: string | null, systemDark: boolean, { storageThrows = false } = {}) {
  const root = fakeRoot()
  const listeners: (() => void)[] = []
  const media = {
    matches: systemDark,
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
  }
  const store = new Map<string, string>(stored === null ? [] : [[THEME_STORAGE_KEY, stored]])
  const localStorage = {
    getItem: (k: string) => {
      if (storageThrows) throw new Error('blocked')
      return store.get(k) ?? null
    },
  }
  const window = { matchMedia: () => media }
  new Function('window', 'document', 'localStorage', THEME_SCRIPT)(window, { documentElement: root }, localStorage)
  return {
    root,
    store,
    setSystem(dark: boolean) {
      media.matches = dark
      listeners.forEach((fn) => fn())
    },
  }
}

describe('theme choice', () => {
  it('parses stored values, defaulting to system', () => {
    expect(parseThemeChoice('light')).toBe('light')
    expect(parseThemeChoice('dark')).toBe('dark')
    expect(parseThemeChoice('system')).toBe('system')
    expect(parseThemeChoice(null)).toBe('system')
    expect(parseThemeChoice('purple')).toBe('system')
  })

  it('resolves system from the OS setting and keeps explicit choices', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('applyTheme sets the dark class and color-scheme', () => {
    const root = fakeRoot()
    applyTheme(root as unknown as HTMLElement, 'dark')
    expect(root.classes.has('dark')).toBe(true)
    expect(root.style.colorScheme).toBe('dark')
    applyTheme(root as unknown as HTMLElement, 'light')
    expect(root.classes.has('dark')).toBe(false)
    expect(root.style.colorScheme).toBe('light')
  })
})

describe('inline theme script (runs before paint)', () => {
  it('follows the system when nothing is stored', () => {
    expect(runScript(null, true).root.classes.has('dark')).toBe(true)
    expect(runScript(null, false).root.classes.has('dark')).toBe(false)
  })

  it('a stored choice beats the system setting', () => {
    expect(runScript('light', true).root.classes.has('dark')).toBe(false)
    expect(runScript('dark', false).root.classes.has('dark')).toBe(true)
  })

  it('keeps following the system while the choice is system', () => {
    const page = runScript(null, false)
    page.setSystem(true)
    expect(page.root.classes.has('dark')).toBe(true)
    page.setSystem(false)
    expect(page.root.classes.has('dark')).toBe(false)
  })

  it('ignores system changes once a choice is stored', () => {
    const page = runScript('light', false)
    page.setSystem(true)
    expect(page.root.classes.has('dark')).toBe(false)
  })

  it('falls back to the system when storage is blocked', () => {
    expect(runScript(null, true, { storageThrows: true }).root.classes.has('dark')).toBe(true)
  })
})
