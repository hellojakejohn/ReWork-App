// The public /proof page: running totals of every tailor's receipt (src/lib/receipt.ts),
// so the numbers mean exactly what the Result card means. No user counts, no revenue.
import { unstable_cache } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { toApplicationDetail } from '@/lib/application-dto'
import { buildReceipt, type ReceiptInput } from '@/lib/receipt'

export interface ProofStats {
  /** Every tailor run, re-tailors included (from the `tailored` events, so deleted accounts still count). */
  tailors: number
  /** Totals over the saved results that still exist. */
  kept: number
  keywordsAdded: number
  leftOut: number
  /** Average job match before and after, over results that recorded both. Null under MIN_MATCHED: a few results make a noisy average. */
  match: { before: number; after: number } | null
  invented: 0
}

export const MIN_MATCHED = 10

/** Pure: sums the receipts the Result card would show for each saved result. */
export function sumReceipts(inputs: ReceiptInput[], tailors: number): ProofStats {
  let kept = 0
  let keywordsAdded = 0
  let leftOut = 0
  let before = 0
  let after = 0
  let matched = 0
  for (const input of inputs) {
    const receipt = buildReceipt(input)
    kept += receipt.kept
    keywordsAdded += receipt.keywordsAdded ?? 0
    leftOut += receipt.leftOut.length
    if (receipt.match) {
      before += receipt.match.before
      after += receipt.match.after
      matched++
    }
  }
  return {
    tailors,
    kept,
    keywordsAdded,
    leftOut,
    match: matched >= MIN_MATCHED ? { before: Math.round(before / matched), after: Math.round(after / matched) } : null,
    invented: 0,
  }
}

const BATCH = 500

async function loadProofStats(): Promise<ProofStats> {
  const tailors = await prisma.event.count({ where: { name: 'tailored' } })
  const inputs: ReceiptInput[] = []
  let cursor: string | undefined
  for (;;) {
    const rows = await prisma.jobApplication.findMany({
      where: { suggestions: { not: Prisma.DbNull } },
      // Everything toApplicationDetail reads except the resume and cover letter bodies.
      select: {
        id: true, resumeId: true, jobTitle: true, company: true, jobUrl: true, createdAt: true,
        matchScore: true, categoryScores: true, keywords: true, suggestions: true,
      },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    for (const row of rows) inputs.push(toApplicationDetail(row))
    if (rows.length < BATCH) break
    cursor = rows[rows.length - 1].id
  }
  return sumReceipts(inputs, tailors)
}

/** Recounted at most once an hour; the page itself renders on request. */
export const getProofStats = unstable_cache(loadProofStats, ['proof-stats'], { revalidate: 3600 })
