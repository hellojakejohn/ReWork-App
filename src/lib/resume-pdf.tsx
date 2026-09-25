// PDF for a master or tailored resume, Classic or Modern, and the matching cover letter.
// Built-in PDF fonts only (Times/Helvetica), single column, real selectable text: what
// ATS parsers read best.
import React from 'react'
import { Document, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { TEMPLATE_STYLE, toLayout, type TemplateId } from '@/lib/resume-templates'
import { letterBlocks } from '@/lib/resume-docx'
import type { ParsedResume } from '@/types/parsed-resume'

function styles(template: TemplateId) {
  const t = TEMPLATE_STYLE[template]
  const font = t.serif ? 'Times-Roman' : 'Helvetica'
  const bold = t.serif ? 'Times-Bold' : 'Helvetica-Bold'
  const italic = t.serif ? 'Times-Italic' : 'Helvetica-Oblique'
  return StyleSheet.create({
    page: { paddingVertical: 40, paddingHorizontal: 46, fontFamily: font, fontSize: 10, lineHeight: 1.35, color: '#111827' },
    header: { marginBottom: 10, alignItems: t.centered ? 'center' : 'flex-start' },
    name: { fontFamily: bold, fontSize: t.serif ? 20 : 19, letterSpacing: t.serif ? 1 : 0, color: t.serif ? '#111827' : '#0F172A' },
    headline: { fontSize: 11, marginTop: 2, color: t.serif ? '#374151' : t.accent },
    contact: { fontSize: 9, marginTop: 4, color: '#374151', textAlign: t.centered ? 'center' : 'left' },
    section: { marginTop: 9 },
    heading: {
      fontFamily: bold,
      fontSize: 10.5,
      color: t.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      borderBottomWidth: t.serif ? 0.8 : 0.6,
      borderBottomColor: t.rule,
      paddingBottom: 2,
      marginBottom: 5,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    entry: { marginBottom: 6 },
    strong: { fontFamily: bold },
    muted: { color: '#4B5563' },
    italic: { fontFamily: italic, color: '#374151' },
    bullet: { flexDirection: 'row', marginTop: 1.5 },
    bulletDot: { width: 10 },
    bulletText: { flex: 1 },
    small: { fontSize: 9 },
  })
}

function Bullets({ items, s }: { items: string[]; s: ReturnType<typeof styles> }) {
  return (
    <>
      {items.map((text, i) => (
        <View key={i} style={s.bullet} wrap={false}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{text}</Text>
        </View>
      ))}
    </>
  )
}

function Header({ l, s }: { l: ReturnType<typeof toLayout>; s: ReturnType<typeof styles> }) {
  return (
    <View style={s.header}>
      {l.name ? <Text style={s.name}>{l.name}</Text> : null}
      {l.headline ? <Text style={s.headline}>{l.headline}</Text> : null}
      {l.contactItems.length ? <Text style={s.contact}>{l.contactItems.join('  |  ')}</Text> : null}
    </View>
  )
}

/** Cover letter with the resume's header. `text`: blocks separated by blank lines. */
export function CoverLetterPdf({ resume, template, text, date = new Date() }: { resume: ParsedResume; template: TemplateId; text: string; date?: Date }) {
  const s = styles(template)
  const l = toLayout(resume)
  const blocks = letterBlocks(text)
  return (
    <Document title={l.name ? `${l.name} Cover Letter` : 'Cover Letter'} author={l.name || undefined}>
      <Page size="LETTER" style={[s.page, { fontSize: 10.5, lineHeight: 1.45 }]}>
        <Header l={l} s={s} />
        <Text style={{ marginTop: 18, marginBottom: 14 }}>{date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
        {blocks.map((block, i) => (
          <Text key={i} style={{ marginBottom: 10 }}>
            {block}
          </Text>
        ))}
      </Page>
    </Document>
  )
}

export function ResumePdf({ resume, template }: { resume: ParsedResume; template: TemplateId }) {
  const s = styles(template)
  const l = toLayout(resume)
  return (
    <Document title={l.name ? `${l.name} Resume` : 'Resume'} author={l.name || undefined}>
      <Page size="LETTER" style={s.page}>
        <Header l={l} s={s} />

        {l.summary ? (
          <View style={s.section}>
            <Text style={s.heading}>Summary</Text>
            <Text>{l.summary}</Text>
          </View>
        ) : null}

        {l.experience.length ? (
          <View style={s.section}>
            <Text style={s.heading}>Experience</Text>
            {l.experience.map((e) => (
              <View key={e.key} style={s.entry}>
                <View style={s.row} wrap={false}>
                  <Text style={s.strong}>{[e.title, e.company].filter(Boolean).join(', ')}</Text>
                  <Text style={s.muted}>{e.dates}</Text>
                </View>
                {e.location ? <Text style={[s.italic, s.small]}>{e.location}</Text> : null}
                <Bullets items={e.bullets} s={s} />
              </View>
            ))}
          </View>
        ) : null}

        {l.projects.length ? (
          <View style={s.section}>
            <Text style={s.heading}>Projects</Text>
            {l.projects.map((p) => (
              <View key={p.key} style={s.entry}>
                <View style={s.row} wrap={false}>
                  <Text>
                    <Text style={s.strong}>{p.name}</Text>
                    {p.url ? <Link src={p.url.includes('://') ? p.url : `https://${p.url}`}>{`  ${p.url}`}</Link> : null}
                  </Text>
                  <Text style={s.muted}>{p.dates}</Text>
                </View>
                <Bullets items={p.bullets} s={s} />
                {p.tech ? <Text style={[s.italic, s.small]}>{p.tech}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {l.education.length ? (
          <View style={s.section}>
            <Text style={s.heading}>Education</Text>
            {l.education.map((e) => (
              <View key={e.key} style={s.entry} wrap={false}>
                <View style={s.row}>
                  <Text style={s.strong}>{e.school}</Text>
                  <Text style={s.muted}>{e.dates}</Text>
                </View>
                {e.credential ? <Text>{e.credential}</Text> : null}
                <Bullets items={e.details} s={s} />
              </View>
            ))}
          </View>
        ) : null}

        {l.skills.length ? (
          <View style={s.section}>
            <Text style={s.heading}>Skills</Text>
            {l.skills.map((g, i) => (
              <Text key={i} style={{ marginBottom: 1.5 }}>
                {g.group ? <Text style={s.strong}>{`${g.group}: `}</Text> : null}
                {g.items}
              </Text>
            ))}
          </View>
        ) : null}

        {l.certifications.length ? (
          <View style={s.section}>
            <Text style={s.heading}>Certifications</Text>
            <Bullets items={l.certifications} s={s} />
          </View>
        ) : null}

        {l.extraSections.map((section, i) => (
          <View key={i} style={s.section}>
            <Text style={s.heading}>{section.heading}</Text>
            <Bullets items={section.items} s={s} />
          </View>
        ))}
      </Page>
    </Document>
  )
}
