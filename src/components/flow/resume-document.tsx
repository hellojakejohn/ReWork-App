"use client"

// HTML preview of a resume in the Classic or Modern template. Laid out at US Letter width
// (816px) and scaled to fit its container, so it matches the PDF's proportions.
import { useEffect, useRef, useState } from "react"
import { TEMPLATE_STYLE, toLayout, type TemplateId } from "@/lib/resume-templates"
import type { ParsedResume } from "@/types/parsed-resume"

const PAGE_WIDTH = 816

export function ResumeDocument({
  resume,
  template,
  highlight,
}: {
  resume: ParsedResume
  template: TemplateId
  /** Bullet texts to mark as changed. */
  highlight?: Set<string>
}) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.6)
  const [height, setHeight] = useState(1056)

  useEffect(() => {
    const el = outer.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setScale(Math.min(1, el.clientWidth / PAGE_WIDTH))
      if (inner.current) setHeight(inner.current.offsetHeight)
    })
    observer.observe(el)
    if (inner.current) observer.observe(inner.current)
    return () => observer.disconnect()
  }, [])

  const t = TEMPLATE_STYLE[template]
  const l = toLayout(resume)
  const font = t.serif ? "'Times New Roman', Times, serif" : "Helvetica, Arial, sans-serif"
  const Heading = ({ children }: { children: React.ReactNode }) => (
    <h3
      className="mt-4 mb-1.5 pb-0.5 text-[13px] font-bold uppercase tracking-[0.08em]"
      style={{ color: t.accent, borderBottom: `${t.serif ? 1 : 0.75}px solid ${t.rule}` }}
    >
      {children}
    </h3>
  )
  const Bullets = ({ items }: { items: string[] }) => (
    <ul className="mt-0.5 space-y-0.5">
      {items.map((text, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden>•</span>
          <span className={highlight?.has(text) ? "bg-emerald-100 rounded-sm" : undefined}>{text}</span>
        </li>
      ))}
    </ul>
  )

  return (
    <div ref={outer} className="w-full overflow-hidden" style={{ height: height * scale }}>
      <div
        ref={inner}
        className="origin-top-left bg-white text-[13px] leading-[1.4] text-gray-900 shadow-lg"
        style={{ width: PAGE_WIDTH, minHeight: 1056, padding: "52px 60px", fontFamily: font, transform: `scale(${scale})` }}
      >
        <header className={t.centered ? "text-center" : ""}>
          {l.name && <h1 className="text-[26px] font-bold" style={{ letterSpacing: t.serif ? "0.04em" : 0 }}>{l.name}</h1>}
          {l.headline && <p className="text-[14px]" style={{ color: t.serif ? "#374151" : t.accent }}>{l.headline}</p>}
          {l.contactItems.length > 0 && <p className="mt-1 text-[12px] text-gray-600">{l.contactItems.join("  |  ")}</p>}
        </header>

        {l.summary && (
          <section>
            <Heading>Summary</Heading>
            <p className={highlight?.has(l.summary) ? "bg-emerald-100 rounded-sm" : undefined}>{l.summary}</p>
          </section>
        )}

        {l.experience.length > 0 && (
          <section>
            <Heading>Experience</Heading>
            {l.experience.map((e) => (
              <div key={e.key} className="mb-2">
                <div className="flex justify-between gap-4">
                  <span className="font-bold">{[e.title, e.company].filter(Boolean).join(", ")}</span>
                  <span className="shrink-0 text-gray-600">{e.dates}</span>
                </div>
                {e.location && <p className="text-[12px] italic text-gray-600">{e.location}</p>}
                <Bullets items={e.bullets} />
              </div>
            ))}
          </section>
        )}

        {l.projects.length > 0 && (
          <section>
            <Heading>Projects</Heading>
            {l.projects.map((p) => (
              <div key={p.key} className="mb-2">
                <div className="flex justify-between gap-4">
                  <span>
                    <span className="font-bold">{p.name}</span>
                    {p.url && <span className="ml-2 text-gray-600">{p.url}</span>}
                  </span>
                  <span className="shrink-0 text-gray-600">{p.dates}</span>
                </div>
                <Bullets items={p.bullets} />
                {p.tech && <p className="text-[12px] italic text-gray-600">{p.tech}</p>}
              </div>
            ))}
          </section>
        )}

        {l.education.length > 0 && (
          <section>
            <Heading>Education</Heading>
            {l.education.map((e) => (
              <div key={e.key} className="mb-2">
                <div className="flex justify-between gap-4">
                  <span className="font-bold">{e.school}</span>
                  <span className="shrink-0 text-gray-600">{e.dates}</span>
                </div>
                {e.credential && <p>{e.credential}</p>}
                <Bullets items={e.details} />
              </div>
            ))}
          </section>
        )}

        {l.skills.length > 0 && (
          <section>
            <Heading>Skills</Heading>
            {l.skills.map((g, i) => (
              <p key={i}>
                {g.group && <span className="font-bold">{g.group}: </span>}
                {g.items}
              </p>
            ))}
          </section>
        )}

        {l.certifications.length > 0 && (
          <section>
            <Heading>Certifications</Heading>
            <Bullets items={l.certifications} />
          </section>
        )}

        {l.extraSections.map((s, i) => (
          <section key={i}>
            <Heading>{s.heading}</Heading>
            <Bullets items={s.items} />
          </section>
        ))}
      </div>
    </div>
  )
}
