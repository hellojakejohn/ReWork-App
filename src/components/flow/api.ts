// Client calls for the one-page flow. Every function resolves to { ok, ... } instead of
// throwing, so cards can show the server's own message.
import { readNdjson } from "@/lib/ndjson"
import type { MasterResumeDTO } from "@/lib/master-dto"
import type { ApplicationDetailDTO, ApplicationSummaryDTO, TrackerCardDTO } from "@/lib/application-dto"
import type { TrackerColumn } from "@/lib/tracker"
import type { ParsedResume } from "@/types/parsed-resume"
import type { BulletChange } from "@/types/tailor"
import type { CoverLetterTone, StoredCoverLetter } from "@/lib/cover-letter-shared"
import type { EvidenceAnswer, EvidenceItem, EvidenceRewrite } from "@/lib/evidence-shared"

export type { MasterResumeDTO, ApplicationDetailDTO, ApplicationSummaryDTO, TrackerCardDTO }

export interface Quota {
  isPro: boolean
  used: number
  limit: number | null // null = unlimited
  remaining: number | null
}

export interface JobDraft {
  url: string
  title: string
  company: string
  location: string
  description: string
  /** A job already on the tracker: tailoring fills that application instead of adding one. */
  applicationId?: string
}

export type Failure = { ok: false; error: string; status: number; upgradeRequired?: boolean }

async function failure(res: Response, fallback: string): Promise<Failure> {
  const data = await res.json().catch(() => ({}))
  return { ok: false, status: res.status, error: data.error || data.message || fallback, upgradeRequired: !!data.upgradeRequired }
}

const NETWORK: Failure = { ok: false, status: 0, error: "Can't reach ReWork. Check your connection and try again." }

export async function loadDashboard(): Promise<
  { ok: true; masters: MasterResumeDTO[]; applications: ApplicationSummaryDTO[]; quota: Quota; coverLetterQuota: Quota } | Failure
> {
  try {
    const res = await fetch("/api/resumes", { cache: "no-store" })
    if (!res.ok) return failure(res, "Couldn't load your resumes.")
    const data = await res.json()
    return { ok: true, masters: data.masters, applications: data.applications, quota: data.quota, coverLetterQuota: data.coverLetterQuota }
  } catch {
    return NETWORK
  }
}

/** Streams real stages to onStage; resolves with the saved master or the server's error. */
async function streamed<T>(res: Response, onStage: (stage: string) => void, fallback: string): Promise<{ ok: true; result: T } | Failure> {
  if (!(res.headers.get("content-type") || "").includes("ndjson")) {
    if (res.ok) return { ok: false, status: 500, error: fallback }
    return failure(res, fallback)
  }
  let outcome: { ok: true; result: T } | Failure = { ok: false, status: 500, error: fallback }
  await readNdjson(res, (event) => {
    if (event.type === "stage") onStage(event.stage)
    else if (event.type === "done") outcome = { ok: true, result: event.result as T }
    else outcome = { ok: false, status: event.status, error: event.error }
  })
  return outcome
}

/** `replaces`: id of the master this upload replaces (it gets hidden, not deleted). */
export async function parseResumeInput(input: File | string, onStage: (stage: string) => void, replaces?: string | null) {
  try {
    const res =
      typeof input === "string"
        ? await fetch("/api/resumes/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: input, ...(replaces ? { replaces } : {}) }),
          })
        : await fetch("/api/resumes/parse", {
            method: "POST",
            body: (() => {
              const form = new FormData()
              form.append("file", input)
              if (replaces) form.append("replaces", replaces)
              return form
            })(),
          })
    return await streamed<MasterResumeDTO>(res, onStage, "We couldn't read that file, try again or paste your resume text.")
  } catch {
    return NETWORK
  }
}

export async function saveMaster(id: string, resume: ParsedResume): Promise<{ ok: true; master: MasterResumeDTO } | Failure> {
  try {
    const res = await fetch(`/api/resumes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume }),
    })
    if (!res.ok) return failure(res, "Couldn't save your changes.")
    return { ok: true, master: (await res.json()).master }
  } catch {
    return NETWORK
  }
}

export async function setMasterHidden(id: string, hidden: boolean): Promise<{ ok: true; master: MasterResumeDTO } | Failure> {
  try {
    const res = await fetch(`/api/resumes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden }),
    })
    if (!res.ok) return failure(res, "Couldn't update that resume.")
    return { ok: true, master: (await res.json()).master }
  } catch {
    return NETWORK
  }
}

export async function deleteMaster(id: string): Promise<{ ok: true } | Failure> {
  try {
    const res = await fetch(`/api/resumes/${id}`, { method: "DELETE" })
    return res.ok ? { ok: true } : failure(res, "Couldn't delete that resume.")
  } catch {
    return NETWORK
  }
}

export async function fetchJobFromUrl(
  url: string
): Promise<{ ok: true; job: JobDraft } | { ok: false; needsPaste: true; message: string } | Failure> {
  try {
    const res = await fetch("/api/job-url/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.needsPaste) return { ok: false, needsPaste: true, message: data.message }
    if (!res.ok || !data.success) return { ok: false, status: res.status, error: data.error || "Couldn't read that link." }
    const job = data.job
    return { ok: true, job: { url, title: job.title, company: job.company, location: job.location, description: job.description } }
  } catch {
    return NETWORK
  }
}

export async function runTailor(resumeId: string, job: JobDraft, onStage: (stage: string) => void) {
  try {
    const res = await fetch(`/api/resumes/${resumeId}/tailor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify({
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        jobUrl: job.url || undefined,
        applicationId: job.applicationId,
      }),
    })
    return await streamed<{ application: ApplicationDetailDTO; tailorsRemaining: number | null }>(res, onStage, "Tailoring failed. Please try again.")
  } catch {
    return NETWORK
  }
}

export async function loadApplication(id: string): Promise<{ ok: true; application: ApplicationDetailDTO } | Failure> {
  try {
    const res = await fetch(`/api/resumes/applications/${id}`, { cache: "no-store" })
    if (!res.ok) return failure(res, "Couldn't open that tailored resume.")
    return { ok: true, application: (await res.json()).application }
  } catch {
    return NETWORK
  }
}

export async function decideChange(
  applicationId: string,
  changeId: string,
  status: BulletChange["status"]
): Promise<{ ok: true; application: ApplicationDetailDTO } | Failure> {
  try {
    const res = await fetch(`/api/resumes/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeId, status }),
    })
    if (!res.ok) return failure(res, "Couldn't save that.")
    return { ok: true, application: (await res.json()).application }
  } catch {
    return NETWORK
  }
}

export async function writeCoverLetter(
  applicationId: string,
  tone: CoverLetterTone
): Promise<{ ok: true; application: ApplicationDetailDTO; coverLetterQuota: Quota } | Failure> {
  try {
    const res = await fetch(`/api/resumes/applications/${applicationId}/cover-letter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tone }),
    })
    if (!res.ok) return failure(res, "We couldn't write the letter. Please try again.")
    const data = await res.json()
    return { ok: true, application: data.application, coverLetterQuota: data.coverLetterQuota }
  } catch {
    return NETWORK
  }
}

export async function saveCoverLetter(
  applicationId: string,
  text: string,
  tone: CoverLetterTone
): Promise<{ ok: true; coverLetter: StoredCoverLetter; coverLetterUpdatedAt: string } | Failure> {
  try {
    const res = await fetch(`/api/resumes/applications/${applicationId}/cover-letter`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tone }),
    })
    if (!res.ok) return failure(res, "Couldn't save the letter.")
    const data = await res.json()
    return { ok: true, coverLetter: data.coverLetter, coverLetterUpdatedAt: data.coverLetterUpdatedAt }
  } catch {
    return NETWORK
  }
}

export interface EvidenceFocus {
  entryId: string
  bullet: string
}

export async function startEvidence(
  resumeId: string,
  focus?: EvidenceFocus | null
): Promise<{ ok: true; items: EvidenceItem[]; answers: EvidenceAnswer[]; message?: string } | Failure> {
  try {
    const res = await fetch(`/api/resumes/${resumeId}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(focus ? { focus } : {}),
    })
    if (!res.ok) return failure(res, "Couldn't start the interview. Please try again.")
    const data = await res.json()
    return { ok: true, items: data.items ?? [], answers: data.answers ?? [], message: data.message }
  } catch {
    return NETWORK
  }
}

export async function submitEvidence(
  resumeId: string,
  items: EvidenceItem[],
  answers: EvidenceAnswer[]
): Promise<{ ok: true; rewrites: EvidenceRewrite[] } | Failure> {
  try {
    const res = await fetch(`/api/resumes/${resumeId}/evidence/rewrite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, answers }),
    })
    if (!res.ok) return failure(res, "Couldn't rewrite your bullets. Your answers are saved.")
    return { ok: true, rewrites: (await res.json()).rewrites ?? [] }
  } catch {
    return NETWORK
  }
}

export async function applyEvidence(
  resumeId: string,
  accepted: EvidenceRewrite[]
): Promise<{ ok: true; applied: number; master: MasterResumeDTO } | Failure> {
  try {
    const res = await fetch(`/api/resumes/${resumeId}/evidence/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted }),
    })
    if (!res.ok) return failure(res, "Couldn't save to your resume.")
    const data = await res.json()
    return { ok: true, applied: data.applied, master: data.master }
  } catch {
    return NETWORK
  }
}

export interface TrackerData {
  isPro: boolean
  total: number
  limit: number | null
  applications: TrackerCardDTO[]
}

export async function loadTracker(): Promise<({ ok: true } & TrackerData) | Failure> {
  try {
    const res = await fetch("/api/tracker", { cache: "no-store" })
    if (!res.ok) return failure(res, "Couldn't load your applications.")
    const data = await res.json()
    return { ok: true, isPro: data.isPro, total: data.total, limit: data.limit, applications: data.applications }
  } catch {
    return NETWORK
  }
}

export async function addTrackedJob(job: JobDraft): Promise<{ ok: true; application: TrackerCardDTO } | Failure> {
  try {
    const res = await fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: job.url, title: job.title, company: job.company, location: job.location, description: job.description }),
    })
    if (!res.ok) return failure(res, "Couldn't add that job.")
    return { ok: true, application: (await res.json()).application }
  } catch {
    return NETWORK
  }
}

export async function updateTracked(
  id: string,
  patch: { column?: TrackerColumn; notes?: string; followUpAt?: string | null }
): Promise<{ ok: true; application: TrackerCardDTO } | Failure> {
  try {
    const res = await fetch(`/api/tracker/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    if (!res.ok) return failure(res, "Couldn't save that.")
    return { ok: true, application: (await res.json()).application }
  } catch {
    return NETWORK
  }
}

export async function deleteTracked(id: string): Promise<{ ok: true } | Failure> {
  try {
    const res = await fetch(`/api/tracker/${id}`, { method: "DELETE" })
    return res.ok ? { ok: true } : failure(res, "Couldn't delete that.")
  } catch {
    return NETWORK
  }
}
