// Server wrapper so the "Powered by" line can check the server-side AI routing.
import { PricingView } from "@/components/billing/pricing-view"
import { showPoweredBy } from "@/lib/ai/routing"

export default function PricingPage() {
  return <PricingView poweredBy={showPoweredBy()} />
}
