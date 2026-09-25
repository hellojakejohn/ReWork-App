"use client"

// Inline "Fix something" editor inside the Resume card. Plain fields, one list per
// section; bullets and details are one per line. Fields the validator flagged show a
// yellow dot with what we dropped and why.
import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import type { NeedsReviewItem, ParsedResume } from "@/types/parsed-resume"
import { ReviewDot, inputClass } from "./ui"

const lines = (value: string) => value.split("\n").map((s) => s.trim()).filter(Boolean)
const csv = (value: string) => value.split(",").map((s) => s.trim()).filter(Boolean)

function Field({
  label,
  value,
  onChange,
  review,
  multiline,
  placeholder,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  review?: NeedsReviewItem[]
  multiline?: boolean
  placeholder?: string
  rows?: number
}) {
  const flagged = review && review.length > 0
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
        {flagged && <ReviewDot title="Check this" />}
        {label}
      </span>
      {multiline ? (
        <textarea className={inputClass} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={inputClass} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {flagged &&
        review!.map((r, i) => (
          <span key={i} className="mt-1 block text-xs text-amber-300">
            We left out “{r.value}”: {r.reason.toLowerCase()} Add it here if it's right.
          </span>
        ))}
    </label>
  )
}

function Section({ title, onAdd, children }: { title: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-white/5 pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {onAdd && (
          <button type="button" onClick={onAdd} className="flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

function Entry({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="relative space-y-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="absolute right-2 top-2 rounded p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-300"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {children}
    </div>
  )
}

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`

export function ResumeEditor({
  value,
  needsReview,
  onChange,
}: {
  value: ParsedResume
  needsReview: NeedsReviewItem[]
  onChange: (next: ParsedResume) => void
}) {
  // Bullet/detail textareas keep their raw text while typing (blank lines included).
  const [raw, setRaw] = useState<Record<string, string>>({})
  const r = value
  const set = (patch: Partial<ParsedResume>) => onChange({ ...r, ...patch })
  const setContact = (patch: Partial<ParsedResume["contact"]>) => set({ contact: { ...r.contact, ...patch } })
  const review = (field: string, entryId?: string) => needsReview.filter((n) => n.field === field && (entryId === undefined || n.entryId === entryId))
  const rawLines = (key: string, list: string[], apply: (items: string[]) => void) => ({
    value: raw[key] ?? list.join("\n"),
    onChange: (text: string) => {
      setRaw((prev) => ({ ...prev, [key]: text }))
      apply(lines(text))
    },
  })

  return (
    <div className="space-y-5">
      <Section title="Contact">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" value={r.contact.fullName} onChange={(v) => setContact({ fullName: v })} review={review("contact.fullName")} />
          <Field label="Headline" value={r.contact.headline} onChange={(v) => setContact({ headline: v })} placeholder="Software Engineer" />
          <Field label="Email" value={r.contact.email} onChange={(v) => setContact({ email: v })} review={review("contact.email")} />
          <Field label="Phone" value={r.contact.phone} onChange={(v) => setContact({ phone: v })} review={review("contact.phone")} />
          <Field label="Location" value={r.contact.location} onChange={(v) => setContact({ location: v })} />
        </div>
        <Field
          label="Links (one per line)"
          multiline
          rows={2}
          review={review("contact.links")}
          {...rawLines(
            "links",
            r.contact.links.map((l) => l.url),
            (urls) =>
              setContact({
                links: urls.map((url) => ({ url, label: r.contact.links.find((l) => l.url === url)?.label || labelFor(url) })),
              })
          )}
        />
      </Section>

      <Section title="Summary">
        <Field label="Summary" multiline rows={4} value={r.summary} onChange={(v) => set({ summary: v })} />
      </Section>

      <Section
        title="Experience"
        onAdd={() =>
          set({
            experience: [...r.experience, { id: uid("exp"), title: "", company: "", location: "", startDate: "", endDate: "", current: false, bullets: [] }],
          })
        }
      >
        {r.experience.map((exp, i) => {
          const update = (patch: Partial<typeof exp>) => set({ experience: r.experience.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
          return (
            <Entry key={exp.id} onRemove={() => set({ experience: r.experience.filter((_, j) => j !== i) })}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Title" value={exp.title} onChange={(v) => update({ title: v })} />
                <Field label="Company" value={exp.company} onChange={(v) => update({ company: v })} review={review("experience.company", exp.id)} />
                <Field label="Start" value={exp.startDate} onChange={(v) => update({ startDate: v })} placeholder="Jan 2022" />
                <Field label="End" value={exp.current ? "" : exp.endDate} onChange={(v) => update({ endDate: v, current: false })} placeholder={exp.current ? "Present" : "Mar 2024"} />
                <Field label="Location" value={exp.location} onChange={(v) => update({ location: v })} />
                <label className="flex items-end gap-2 pb-2 text-sm text-slate-300">
                  <input type="checkbox" checked={exp.current} onChange={(e) => update({ current: e.target.checked, endDate: e.target.checked ? "" : exp.endDate })} />
                  I work here now
                </label>
              </div>
              <Field label="Bullets (one per line)" multiline rows={4} {...rawLines(`exp-${exp.id}`, exp.bullets, (bullets) => update({ bullets }))} />
            </Entry>
          )
        })}
      </Section>

      <Section
        title="Projects"
        onAdd={() => set({ projects: [...r.projects, { id: uid("proj"), name: "", url: "", dates: "", bullets: [], tech: [] }] })}
      >
        {r.projects.map((p, i) => {
          const update = (patch: Partial<typeof p>) => set({ projects: r.projects.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
          return (
            <Entry key={p.id} onRemove={() => set({ projects: r.projects.filter((_, j) => j !== i) })}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Name" value={p.name} onChange={(v) => update({ name: v })} />
                <Field label="Link" value={p.url} onChange={(v) => update({ url: v })} review={review("projects.url", p.id)} />
                <Field label="Dates" value={p.dates} onChange={(v) => update({ dates: v })} />
                <Field label="Tech (comma separated)" {...rawLines(`tech-${p.id}`, [p.tech.join(", ")], (v) => update({ tech: csv(v.join(",")) }))} />
              </div>
              <Field label="Bullets (one per line)" multiline rows={3} {...rawLines(`proj-${p.id}`, p.bullets, (bullets) => update({ bullets }))} />
            </Entry>
          )
        })}
      </Section>

      <Section
        title="Education"
        onAdd={() =>
          set({ education: [...r.education, { id: uid("edu"), school: "", credential: "", field: "", startDate: "", endDate: "", details: [] }] })
        }
      >
        {r.education.map((edu, i) => {
          const update = (patch: Partial<typeof edu>) => set({ education: r.education.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
          return (
            <Entry key={edu.id} onRemove={() => set({ education: r.education.filter((_, j) => j !== i) })}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="School" value={edu.school} onChange={(v) => update({ school: v })} review={review("education.school", edu.id)} />
                <Field label="Degree or program" value={edu.credential} onChange={(v) => update({ credential: v })} />
                <Field label="Field" value={edu.field} onChange={(v) => update({ field: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Start" value={edu.startDate} onChange={(v) => update({ startDate: v })} />
                  <Field label="End" value={edu.endDate} onChange={(v) => update({ endDate: v })} />
                </div>
              </div>
              <Field label="Details (one per line)" multiline rows={2} {...rawLines(`edu-${edu.id}`, edu.details, (details) => update({ details }))} />
            </Entry>
          )
        })}
      </Section>

      <Section title="Skills" onAdd={() => set({ skills: [...r.skills, { group: "", items: [] }] })}>
        {r.skills.map((g, i) => {
          const update = (patch: Partial<typeof g>) => set({ skills: r.skills.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
          return (
            <Entry key={i} onRemove={() => set({ skills: r.skills.filter((_, j) => j !== i) })}>
              <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                <Field label="Group" value={g.group} onChange={(v) => update({ group: v })} placeholder="Languages" />
                <Field label="Skills (comma separated)" {...rawLines(`skills-${i}`, [g.items.join(", ")], (v) => update({ items: csv(v.join(",")) }))} />
              </div>
            </Entry>
          )
        })}
      </Section>

      <Section title="Certifications">
        <Field
          label="One per line"
          multiline
          rows={2}
          {...rawLines(
            "certs",
            r.certifications.map((c) => c.name),
            (names) => set({ certifications: names.map((name) => r.certifications.find((c) => c.name === name) ?? { name, issuer: "", date: "" }) })
          )}
        />
      </Section>
    </div>
  )
}

function labelFor(url: string): string {
  if (/linkedin/i.test(url)) return "LinkedIn"
  if (/github/i.test(url)) return "GitHub"
  return "Website"
}
