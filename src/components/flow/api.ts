// Client calls for the one-page flow. Every function resolves to { ok, ... } instead of
// throwing, so cards can show the server's own message.
import { readNdjson } from "@/lib/ndjson"
import type { MasterResumeDTO } from "@/lib/master-dto"
import type { ApplicationDetailDTO, ApplicationSummaryDTO } from "@/lib/application-dto"
import type { ParsedResume } from "@/types/parsed-resume"
import type { BulletChange } from "@/types/tailor"

export type { MasterResumeDTO, ApplicationDetailDTO, ApplicationSummaryDTO }

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
}

export type Failure = { ok: false; error: string; status: number; upgradeRequired?: boolean }

async function failure(res: Response, fallback: string): Promise<Failure> {
  const data = await res.json().catch(() => ({}))
  return { ok: false, status: res.status, error: data.error || data.message || fallback, upgradeRequired: !!data.upgradeRequired }
}

const NETWORK: Failure = { ok: false, status: 0, error: "Can't reach ReWork. Check your connection and try again." }

export async function loadDashboard(): Promise<
  { ok: true; masters: MasterResumeDTO[]; applications: ApplicationSummaryDTO[]; quota: Quota } | Failure
> {
  try {
    const res = await fetch("/api/resumes", { cache: "no-store" })
    if (!res.ok) return failure(res, "Couldn't load your resumes.")
    const data = await res.json()
    return { ok: true, masters: data.masters, applications: data.applications, quota: data.quota }
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

export async function parseResumeInput(input: File | string, onStage: (stage: string) => void) {
  try {
    const res =
      typeof input === "string"
        ? await fetch("/api/resumes/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: input }),
          })
        : await fetch("/api/resumes/parse", {
            method: "POST",
            body: (() => {
              const form = new FormData()
              form.append("file", input)
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
