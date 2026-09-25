"use client"

// Result card -> Cover letter tab. Write one per job, pick a tone, edit inline (autosaves
// to the JobApplication), copy, or download as PDF/Word.
import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, ChevronDown, Copy, Loader2, PenLine, ShieldCheck, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { COVER_LETTER_TONES, type CoverLetterTone } from "@/lib/cover-letter-shared"
import { FREE_COVER_LETTERS_PER_MONTH } from "@/lib/plans"
import { saveCoverLetter, writeCoverLetter, type ApplicationDetailDTO, type Quota } from "./api"
import { ErrorNote, PrimaryButton, SecondaryButton, inputClass } from "./ui"

const AUTOSAVE_MS = 800

export function CoverLetterPanel({
  application,
  quota,
  onChange,
  onQuota,
  onUpgrade,
}: {
  application: ApplicationDetailDTO
  quota: Quota | null
  onChange: (application: ApplicationDetailDTO) => void
  onQuota: (quota: Quota) => void
  onUpgrade: (reason?: string) => void
}) {
  const letter = application.coverLetter
  const [tone, setTone] = useState<CoverLetterTone>(letter?.tone ?? "professional")
  const [text, setText] = useState(letter?.text ?? "")
  const [writing, setWriting] = useState(false)
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [showWarnings, setShowWarnings] = useState(false)

  // Latest values for the debounced save and the unmount flush.
  const pending = useRef<{ id: string; text: string; tone: CoverLetterTone } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const appRef = useRef(application)
  appRef.current = application

  // A different application (or a fresh letter) resets the editor.
  useEffect(() => {
    setText(application.coverLetter?.text ?? "")
    setTone(application.coverLetter?.tone ?? "professional")
    setSave("idle")
    setError("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application.id, application.coverLetter?.generatedAt])

  const flush = async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const job = pending.current
    if (!job) return
    pending.current = null
    setSave("saving")
    const result = await saveCoverLetter(job.id, job.text, job.tone)
    if (!result.ok) {
      setSave("error")
      setError(result.error)
      return
    }
    setSave("saved")
    if (appRef.current.id === job.id) {
      onChange({ ...appRef.current, coverLetter: result.coverLetter, coverLetterUpdatedAt: result.coverLetterUpdatedAt })
    }
  }

  useEffect(
    () => () => {
      void flush()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const edit = (value: string) => {
    setText(value)
    pending.current = { id: application.id, text: value, tone }
    setSave("saving")
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS)
  }

  const outOfLetters = !!quota && quota.limit !== null && quota.remaining === 0

  const write = async () => {
    if (outOfLetters) {
      onUpgrade(`You've used your ${FREE_COVER_LETTERS_PER_MONTH} free cover letter this month. Pro writes one for every job.`)
      return
    }
    if (letter?.edited && !confirm("Rewrite the letter? Your edits will be replaced.")) return
    await flush()
    setError("")
    setWriting(true)
    const result = await writeCoverLetter(application.id, tone)
    setWriting(false)
    if (!result.ok) {
      if (result.status === 402 || result.upgradeRequired) onUpgrade(result.error)
      setError(result.error)
      return
    }
    onQuota(result.coverLetterQuota)
    onChange(result.application)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError("Couldn't copy. Select the text and copy it instead.")
    }
  }

  const words = text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length
  const quotaLine = !quota
    ? ""
    : quota.limit === null
      ? "Unlimited cover letters"
      : `${quota.remaining} of ${quota.limit} free cover letter${quota.limit === 1 ? "" : "s"} left this month`

  const tones = (
    <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1 text-xs" role="radiogroup" aria-label="Tone">
      {COVER_LETTER_TONES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={tone === t.id}
          disabled={writing}
          onClick={() => setTone(t.id)}
          className={cn("flex-1 rounded-md px-3 py-1.5", tone === t.id ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200")}
        >
          {t.label}
        </button>
      ))}
    </div>
  )

  if (!letter || writing) {
    return (
      <div className="space-y-4 text-sm">
        <p className="text-slate-300">
          A short letter for {application.company}: why this role, your two or three strongest proof points, and a close. Built from your resume only, and fact-checked like it.
        </p>
        {tones}
        {error && <ErrorNote>{error}</ErrorNote>}
        {writing ? (
          <p className="flex items-center gap-2 text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> Writing and fact-checking your letter…
          </p>
        ) : outOfLetters ? (
          <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-slate-200">You&apos;ve used your free cover letter this month. Pro writes one for every job.</p>
            <PrimaryButton onClick={() => onUpgrade()}>
              <Sparkles className="h-4 w-4" /> Get unlimited cover letters
            </PrimaryButton>
          </div>
        ) : (
          <PrimaryButton onClick={() => void write()}>
            <PenLine className="h-4 w-4" /> Write cover letter
          </PrimaryButton>
        )}
        {quotaLine && <p className="text-xs text-slate-500">{quotaLine}</p>}
      </div>
    )
  }

  const warnings = letter.warnings
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[14rem] flex-1">{tones}</div>
        <SecondaryButton className="px-3 py-1.5 text-xs" onClick={() => void write()} disabled={writing}>
          <Sparkles className="h-3.5 w-3.5" /> Rewrite
        </SecondaryButton>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}

      {warnings.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Fact-checked: everything in it is from your resume.
        </p>
      ) : (
        <div className="rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2">
          <button onClick={() => setShowWarnings((v) => !v)} className="flex w-full items-center gap-1.5 text-left text-xs font-medium text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" /> {warnings.length} {warnings.length === 1 ? "fix" : "fixes"} from our fact check
            <ChevronDown className={cn("ml-auto h-3.5 w-3.5 transition-transform", showWarnings && "rotate-180")} />
          </button>
          {showWarnings && (
            <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
              {warnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <textarea
        aria-label="Cover letter"
        className={cn(inputClass, "min-h-[340px] font-serif text-[14px] leading-relaxed")}
        value={text}
        onChange={(e) => edit(e.target.value)}
        onBlur={() => void flush()}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{words} words</span>
        <span aria-live="polite">
          {save === "saving" ? "Saving…" : save === "saved" ? "Saved" : save === "error" ? "Not saved" : letter.edited ? "Edited" : ""}
        </span>
        <button onClick={() => void copy()} className="ml-auto flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-slate-300 hover:bg-white/5">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {quotaLine && <p className="text-xs text-slate-500">{quotaLine}</p>}
    </div>
  )
}
