// Light / Dark / System theme. The choice lives in localStorage; "system" (or nothing
// stored) follows prefers-color-scheme. THEME_SCRIPT runs inline in <head> before first
// paint so the page never flashes the wrong theme, and keeps following the system setting
// while the choice is "system".

export const THEME_STORAGE_KEY = 'rework-theme'
export const THEME_CHANGE_EVENT = 'rework-theme-change'

export type ThemeChoice = 'light' | 'dark' | 'system'
export const THEME_CHOICES: ThemeChoice[] = ['light', 'dark', 'system']

export function parseThemeChoice(value: unknown): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): 'light' | 'dark' {
  if (choice === 'system') return systemDark ? 'dark' : 'light'
  return choice
}

/** Puts the resolved theme on <html>: the .dark class (Tailwind) plus color-scheme. */
export function applyTheme(root: HTMLElement, theme: 'light' | 'dark') {
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

function systemDark() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function readThemeChoice(): ThemeChoice {
  try {
    return parseThemeChoice(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // Storage blocked (private mode): the choice still applies until the page reloads.
  }
  applyTheme(document.documentElement, resolveTheme(choice, systemDark()))
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: choice }))
}

// Same logic as resolveTheme/applyTheme, inlined because it runs before any bundle loads.
export const THEME_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)},d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');function c(){var v=null;try{v=localStorage.getItem(k)}catch(e){}return v==='light'||v==='dark'?v:'system'}function a(){var v=c(),t=v==='system'?(m.matches?'dark':'light'):v;d.classList.toggle('dark',t==='dark');d.style.colorScheme=t}a();m.addEventListener('change',function(){if(c()==='system')a()})}catch(e){}})()`
