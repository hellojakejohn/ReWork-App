"use client"

import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { AlertTriangle, FileText, Plus, RefreshCw, Sparkles, Trash2, Upload } from "lucide-react"
import { summarizeResume } from "@/lib/master-resume"
import { hasContent } from "@/lib/master-dto"
import type { ParsedResume } from "@/types/parsed-resume"
import { FREE_TAILORS_PER_MONTH, INPUT_LIMITS, INPUT_LIMIT_MESSAGES } from "@/lib/plans"
import { deleteMaster, parseResumeInput, saveMaster, type EvidenceFocus, type MasterResumeDTO } from "./api"
import { ResumeEditor } from "./resume-editor"
import { EvidenceInterview } from "./evidence-interview"
import { Card, CardBody, CardFooter, CardHeader, ErrorNote, ReviewDot, StageList, inputClass } from "./ui"
import { useAdvance } from "./use-advance"

const PARSE_STAGES = [
  { id: "extracting", label: "Reading your file" },
  { id: "reading", label: "Finding your roles, projects and skills" },
  { id: "checking", label: "Checking every detail against your file" },
  { id: "saving", label: "Saving" },
]

type Mode = "summary" | "new" | "parsing" | "editing" | "evidence"

/** A request from outside the card (step rail, Start over, Replace links, "Make it stronger"). */
export interface ResumeCardRequest {
  mode: "summary" | "new" | "replace" | "evidence"
  nonce: number
  focus?: EvidenceFocus | null
}

export function ResumeCard({
  active,
  masters,
  isActiveStep,
  onParsed,
  onSaved,
  onSelect,
  onDeleted,
  onConfirm,
  onLimit,
  request,
  isPro,
}: {
  active: MasterResumeDTO | null
  masters: MasterResumeDTO[]
  isActiveStep: boolean
  /** `replacedId`: the master this upload replaced (now hidden). */
  onParsed: (master: MasterResumeDTO, replacedId: string | null) => void
  onSaved: (master: MasterResumeDTO) => void
  onSelect: (id: string) => void
  onDeleted: (id: string) => void
  onConfirm: () => void
  onLimit: (message: string) => void
  request?: ResumeCardRequest | null
  isPro: boolean
}) {
  const { data: session } = useSession()
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] ?? ""
  const [mode, setMode] = useState<Mode>(active ? "summary" : "new")
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const [stage, setStage] = useState<string | null>(null)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [draft, setDraft] = useState<ParsedResume | null>(null)
  const [saving, setSaving] = useState(false)
  // Id of the master being replaced while the dropzone is in replace mode.
  const [replacing, setReplacing] = useState<string | null>(null)
  // Set when the interview was opened for one bullet (from the Result card's Changes tab).
  const [evidenceFocus, setEvidenceFocus] = useState<EvidenceFocus | null>(null)

  useEffect(() => {
    if (!active && mode === "summary") setMode("new")
  }, [active, mode])

  const openNew = (replace: boolean) => {
    setError("")
    setPasteOpen(false)
    setReplacing(replace && active ? active.id : null)
    setMode("new")
  }

  useEffect(() => {
    if (!request || mode === "parsing") return
    if (request.mode === "summary") {
      setReplacing(null)
      setMode(active ? "summary" : "new")
    } else if (request.mode === "evidence") {
      if (active) openEvidence(request.focus ?? null)
    } else {
      openNew(request.mode === "replace")
    }
    // Only react to a new request, not to active/mode changing underneath it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce])

  const openEvidence = (focus: EvidenceFocus | null) => {
    if (!isPro) {
      onLimit("The evidence interview is a Pro feature: it asks for your real numbers and rewrites your weakest bullets with them.")
      setMode(active ? "summary" : "new")
      return
    }
    setError("")
    setEvidenceFocus(focus)
    setMode("evidence")
  }

  const parse = async (input: File | string) => {
    setError("")
    setStage("extracting")
    setFileName(typeof input === "string" ? "Pasted text" : input.name)
    setMode("parsing")
    const result = await parseResumeInput(input, setStage, replacing)
    setStage(null)
    if (!result.ok) {
      if (result.upgradeRequired) onLimit(result.error)
      setError(result.error)
      setMode("new")
      return
    }
    setPasteText("")
    setPasteOpen(false)
    onParsed(result.result, replacing)
    setReplacing(null)
    setMode("summary")
  }

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxFiles: 1,
    maxSize: INPUT_LIMITS.resumeFileBytes,
    noClick: true,
    disabled: mode !== "new",
    onDrop: (accepted, rejected) => {
      if (accepted[0]) void parse(accepted[0])
      else if (rejected[0]) setError(rejected[0].errors[0]?.code === "file-too-large" ? INPUT_LIMIT_MESSAGES.resumeFile : "That file type won't work. Upload a PDF or DOCX, or paste your resume text.")
    },
  })

  const canConfirm = mode === "summary" && !!active && hasContent(active.resume)
  useAdvance(isActiveStep && canConfirm, onConfirm)

  const startEdit = () => {
    if (!active) return
    setDraft(structuredClone(active.resume))
    setError("")
    setMode("editing")
  }

  const saveEdit = async () => {
    if (!active || !draft) return
    setSaving(true)
    const result = await saveMaster(active.id, draft)
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSaved(result.master)
    setMode("summary")
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this resume? Tailored versions made from it stay in Recent.")) return
    const result = await deleteMaster(id)
    if (result.ok) onDeleted(id)
    else setError(result.error)
  }

  // ----- new: dropzone + paste -----
  if (mode === "new" || mode === "parsing") {
    return (
      <Card>
        <CardHeader
          title={replacing ? "Replace your resume" : "Your resume"}
          subtitle={
            replacing
              ? "The new one becomes your active resume. The old one is kept in Manage resumes until you delete it."
              : "We'll read it once and use it for every job."
          }
          onBack={active && mode !== "parsing" ? () => { setReplacing(null); setMode("summary") } : undefined}
        />
        <CardBody className="flex flex-col gap-4">
          {masters.length === 0 && mode === "new" && (
            <p className="rounded-input bg-sage px-3 py-2 text-sm text-text">
              Welcome{firstName ? `, ${firstName}` : ""}. Start with your resume, then paste a job link. {isPro ? "" : `You have ${FREE_TAILORS_PER_MONTH} free tailors this month.`}
            </p>
          )}
          {mode === "parsing" ? (
            <div className="space-y-5">
              <p className="flex items-center gap-2 text-sm text-text-secondary">
                <FileText className="h-4 w-4 text-text-muted" /> {fileName}
              </p>
              <div className="space-y-2" aria-hidden>
                {[80, 55, 90, 70, 60].map((w, i) => (
                  <div key={i} className="h-3 animate-pulse rounded bg-surface-raised" style={{ width: `${w}%` }} />
                ))}
              </div>
              <StageList stages={PARSE_STAGES} current={stage} />
            </div>
          ) : (
            <>
              {error && <ErrorNote>{error}</ErrorNote>}
              {!pasteOpen ? (
                <div
                  {...getRootProps()}
                  onClick={open}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === " " ? open() : undefined)}
                  className={`flex min-h-[220px] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-6 text-center transition-colors ${
                    isDragActive ? "border-success bg-success-tint" : "border-input hover:border-text-muted"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-8 w-8 text-text-muted" />
                  <div>
                    <p className="text-base font-medium text-text">Drop your resume here</p>
                    <p className="text-sm text-text-muted">or click to choose a file. PDF or DOCX, up to 4 MB.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col gap-2">
                  <textarea
                    className={`${inputClass} min-h-[220px] flex-1`}
                    placeholder="Paste your whole resume here"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    autoFocus
                  />
                  {pasteText.length > INPUT_LIMITS.resumeTextChars && <ErrorNote>{INPUT_LIMIT_MESSAGES.resumeText}</ErrorNote>}
                  <div className="flex justify-end">
                    <Button
                      disabled={pasteText.trim().length < 80 || pasteText.length > INPUT_LIMITS.resumeTextChars}
                      onClick={() => void parse(pasteText)}
                    >
                      Read my resume
                    </Button>
                  </div>
                </div>
              )}
              <Button type="button" variant="text" className="self-center" onClick={() => setPasteOpen((v) => !v)}>
                {pasteOpen ? "Upload a file instead" : "or paste text"}
              </Button>
            </>
          )}
        </CardBody>
      </Card>
    )
  }

  if (!active) return null

  // ----- evidence interview -----
  if (mode === "evidence") {
    return (
      <EvidenceInterview
        master={active}
        focus={evidenceFocus}
        onClose={() => setMode("summary")}
        onUpgrade={onLimit}
        onSaved={(master, applied) => {
          onSaved(master)
          setMode("summary")
          toast.success(
            evidenceFocus
              ? `Saved to your resume. Tailor again to use it for this job.`
              : `${applied} ${applied === 1 ? "bullet" : "bullets"} updated in your resume.`
          )
        }}
      />
    )
  }

  // ----- editing -----
  if (mode === "editing" && draft) {
    return (
      <Card>
        <CardHeader title="Fix something" subtitle="Changes save to this resume." onBack={() => setMode("summary")} />
        <CardBody>
          {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}
          <ResumeEditor value={draft} needsReview={active.needsReview} onChange={setDraft} />
        </CardBody>
        <CardFooter>
          <Button variant="secondary" onClick={() => setMode("summary")}>Cancel</Button>
          <Button loading={saving} onClick={() => void saveEdit()}>Save</Button>
        </CardFooter>
      </Card>
    )
  }

  // ----- summary -----
  const s = summarizeResume(active.resume)
  const toCheck = active.needsReview.length
  const empty = !hasContent(active.resume)
  const switchable = masters.filter((m) => !m.hidden || m.id === active.id)
  return (
    <Card>
      <CardHeader
        title="Your resume"
        subtitle={toCheck > 0 ? (
          <span className="flex items-center gap-1.5 text-warn">
            <ReviewDot /> {toCheck === 1 ? "1 thing to check" : `${toCheck} things to check`}
          </span>
        ) : "Here's what we read."}
        right={
          <div className="flex items-center gap-1">
            {switchable.length > 1 && (
              <select
                aria-label="Switch resume"
                value={active.id}
                onChange={(e) => onSelect(e.target.value)}
                className="max-w-[10rem] rounded-full border border-input bg-surface px-2.5 py-1 text-xs text-text-secondary"
              >
                {switchable.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            )}
            <Button variant="text" size="sm" onClick={() => openNew(true)} title="Upload a new version; this one is kept in Manage resumes">
              <RefreshCw className="h-3.5 w-3.5" /> Replace
            </Button>
            <Button variant="text" size="icon" onClick={() => openNew(false)} title="Add another resume" aria-label="Add another resume">
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="text"
              size="icon"
              onClick={() => void remove(active.id)}
              title="Delete this resume"
              aria-label="Delete this resume"
              className="hover:bg-removed hover:text-accent-strong"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />
      <CardBody className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        {active.staleParse && (
          <div className="flex items-start gap-3 rounded-input border border-warn/30 bg-warn-tint p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            <p className="flex-1 text-text">This resume was read by our old parser. Re-upload it for much better results.</p>
            <Button size="sm" variant="inverse" onClick={() => openNew(true)}>
              Re-upload
            </Button>
          </div>
        )}
        <div>
          <p className="flex items-center gap-2 font-serif text-2xl font-semibold text-text">
            {s.name || <span className="text-text-muted">No name found</span>}
            {active.needsReview.some((n) => n.field === "contact.fullName") && <ReviewDot title="Check your name" />}
          </p>
          {s.headline && <p className="text-sm text-text-secondary">{s.headline}</p>}
          <p className="mt-1 text-xs text-text-muted">{[active.resume.contact.email, active.resume.contact.location].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            [s.roles, s.roles === 1 ? "role" : "roles"],
            [s.projects, s.projects === 1 ? "project" : "projects"],
            [active.resume.education.length, "education"],
          ].map(([n, label]) => (
            <div key={String(label)} className="rounded-input border border-border bg-surface-raised py-2">
              <div className="font-serif text-2xl font-semibold text-text">{n}</div>
              <div className="text-xs text-text-muted">{label}</div>
            </div>
          ))}
        </div>
        {active.resume.experience.length > 0 && (
          <ul className="space-y-1 text-sm">
            {active.resume.experience.slice(0, 4).map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-text-secondary">
                {active.needsReview.some((n) => n.entryId === e.id) && <ReviewDot title="Check this role" />}
                <span className="truncate">
                  {e.title}
                  {e.company && <span className="text-text-muted"> · {e.company}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {s.topSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {s.topSkills.map((skill) => (
              <span key={skill} className="rounded-full bg-surface-raised px-2.5 py-0.5 text-xs text-text-secondary">
                {skill}
              </span>
            ))}
          </div>
        )}
        {toCheck > 0 && (
          <div className="rounded-input border border-warn/30 bg-warn-tint p-3 text-sm">
            <p className="mb-1 font-medium text-warn">We left these out because they aren&apos;t in your file:</p>
            <ul className="space-y-0.5 text-text">
              {active.needsReview.map((n, i) => (
                <li key={i} className="truncate">“{n.value}”</li>
              ))}
            </ul>
          </div>
        )}
        {empty && <ErrorNote>We didn&apos;t find any roles, projects or education. Use “Fix something” to add them, or upload again.</ErrorNote>}
      </CardBody>
      <CardFooter>
        <Button variant="secondary" className="mr-auto" onClick={() => openEvidence(null)} disabled={empty}>
          <Sparkles className="h-4 w-4" /> Make it stronger
          {!isPro && <span className="rounded-full bg-sage px-1.5 text-xs font-semibold text-text">Pro</span>}
        </Button>
        <Button variant="secondary" onClick={startEdit}>Fix something</Button>
        <Button disabled={!canConfirm} onClick={onConfirm}>Looks good</Button>
      </CardFooter>
    </Card>
  )
}
