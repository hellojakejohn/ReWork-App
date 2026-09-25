import type { Metadata } from "next"
import { FREE_TAILORS_PER_MONTH, PRICING } from "@/lib/plans"

export const metadata: Metadata = {
  title: "Pricing",
  description: `Free: ${FREE_TAILORS_PER_MONTH} tailored resumes a month. ${PRICING.monthly.name}: ${PRICING.monthly.display}. ${PRICING.pass.name}: ${PRICING.pass.display}.`,
  alternates: { canonical: "/pricing" },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
