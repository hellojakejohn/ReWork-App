"use client"

// Burn $REWORK for Pro (src/lib/token-burn.ts). Connect a wallet-standard Solana wallet
// (Phantom), get a quote, sign the server-built burn, then claim it. The signature is kept in
// localStorage until the claim lands, so closing the tab mid-confirmation loses nothing.
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { getWallets } from "@wallet-standard/app"
import type { Wallet, WalletAccount } from "@wallet-standard/base"
import { Flame } from "lucide-react"
import confetti from "canvas-confetti"
import { Button } from "@/components/ui/button"
import { AppHeader } from "@/components/flow/app-header"
import { ErrorNote } from "@/components/flow/ui"
import { describeAccess, type Access } from "@/lib/entitlement-rules"
import type { BurnQuote } from "@/lib/token-burn"

const PENDING_KEY = "rework.burnSignature"
const CLAIM_POLL_MS = 3000
const CLAIM_WAIT_MS = 120_000

/* eslint-disable @typescript-eslint/no-explicit-any */
const canBurn = (w: Wallet) => "standard:connect" in w.features && "solana:signAndSendTransaction" in w.features

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
function base58(bytes: Uint8Array): string {
  const digits = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8
      digits[i] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }
  let out = ""
  for (const byte of bytes) {
    if (byte !== 0) break
    out += "1"
  }
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]]
  return out
}

function readPending(): string | null {
  try {
    return window.localStorage.getItem(PENDING_KEY)
  } catch {
    return null
  }
}
function writePending(sig: string | null) {
  try {
    if (sig) window.localStorage.setItem(PENDING_KEY, sig)
    else window.localStorage.removeItem(PENDING_KEY)
  } catch {
    // private window: the paste box still recovers it
  }
}

async function post<T>(url: string, body: unknown): Promise<{ ok: true; status: number; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.error || "Something went wrong. Try again." }
    return { ok: true, status: res.status, data }
  } catch {
    return { ok: false, error: "Can't reach rework. Check your connection and try again." }
  }
}

type Step = "connect" | "quote" | "signing" | "claiming" | "done"

export function BurnView() {
  const { update } = useSession()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [account, setAccount] = useState<WalletAccount | null>(null)
  const [quote, setQuote] = useState<BurnQuote | null>(null)
  const [step, setStep] = useState<Step>("connect")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [access, setAccess] = useState<Access | null>(null)
  const [paste, setPaste] = useState("")
  const [now, setNow] = useState(() => Date.now())
  const claiming = useRef(false)

  useEffect(() => {
    const { get, on } = getWallets()
    const refresh = () => setWallets(get().filter(canBurn))
    refresh()
    const offRegister = on("register", refresh)
    const offUnregister = on("unregister", refresh)
    return () => {
      offRegister()
      offUnregister()
    }
  }, [])

  useEffect(() => {
    if (!quote) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [quote])

  const claim = useCallback(
    async (signature: string) => {
      if (claiming.current) return
      claiming.current = true
      setStep("claiming")
      setError(null)
      const deadline = Date.now() + CLAIM_WAIT_MS
      try {
        while (Date.now() < deadline) {
          const result = await post<{ status: string; access?: Access }>("/api/token/burn/claim", { signature })
          if (!result.ok) {
            setError(result.error)
            writePending(null)
            setStep(account ? "quote" : "connect")
            return
          }
          if (result.data.status === "granted" && result.data.access) {
            writePending(null)
            setAccess(result.data.access)
            setStep("done")
            await update()
            confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } })
            return
          }
          await new Promise((r) => setTimeout(r, CLAIM_POLL_MS))
        }
        setError("Solana is still confirming your burn. It's saved: come back to this page in a few minutes and it'll finish.")
      } finally {
        claiming.current = false
      }
    },
    [account, update]
  )

  // A burn that was sent but never claimed (tab closed): finish it.
  useEffect(() => {
    const pending = readPending()
    if (pending) void claim(pending)
  }, [claim])

  async function connect(w: Wallet) {
    setBusy(true)
    setError(null)
    try {
      const { accounts } = await (w.features["standard:connect"] as any).connect()
      const solana = (accounts as WalletAccount[]).find((a) => a.chains.some((c) => c.startsWith("solana:"))) ?? accounts[0]
      if (!solana) throw new Error("no account")
      setWallet(w)
      setAccount(solana)
      setStep("quote")
    } catch {
      setError(`${w.name} didn't connect. Open it, unlock it, and try again.`)
    } finally {
      setBusy(false)
    }
  }

  async function getQuote() {
    if (!account) return
    setBusy(true)
    setError(null)
    const result = await post<BurnQuote>("/api/token/burn/quote", { wallet: account.address })
    setBusy(false)
    if (!result.ok) return setError(result.error)
    setQuote(result.data)
    setNow(Date.now())
  }

  async function burn() {
    if (!wallet || !account || !quote) return
    setStep("signing")
    setError(null)
    try {
      const transaction = Uint8Array.from(atob(quote.transaction), (c) => c.charCodeAt(0))
      const [output] = await (wallet.features["solana:signAndSendTransaction"] as any).signAndSendTransaction({
        account,
        chain: quote.chain,
        transaction,
      })
      const signature = base58(output.signature as Uint8Array)
      writePending(signature)
      setQuote(null)
      await claim(signature)
    } catch {
      // Declined in the wallet, or the wallet couldn't send it: nothing was burned.
      setError("The burn wasn't sent, so nothing was burned. Try again when you're ready.")
      setStep("quote")
    }
  }

  const secondsLeft = quote ? Math.max(0, Math.round((new Date(quote.expiresAt).getTime() - now) / 1000)) : 0
  const expired = quote !== null && secondsLeft === 0

  return (
    <div className="min-h-[100dvh] bg-bg">
      <AppHeader quota={null} recentCount={0} onUpgrade={() => {}} flow={null} view="tracker" />
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <h1 className="font-serif text-4xl font-medium tracking-tight text-text">Burn for Pro</h1>
        <p className="mt-3 leading-relaxed text-text-secondary">
          Burn $15 worth of $REWORK for 30 days of Pro. If you already have Pro, the days start when it ends.{" "}
          <Link href="/token" className="underline underline-offset-4 hover:text-text">
            About $REWORK
          </Link>
        </p>

        <div className="mt-8 space-y-4 rounded-card bg-surface p-6">
          {step === "connect" &&
            (wallets.length === 0 ? (
              <p className="text-sm leading-relaxed text-text-secondary">
                No Solana wallet found in this browser. Install{" "}
                <a href="https://phantom.com/download" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-text">
                  Phantom
                </a>
                , then reload this page.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {wallets.map((w) => (
                  <Button key={w.name} variant="secondary" onClick={() => connect(w)} loading={busy}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- wallet icons are data: URIs */}
                    {w.icon && <img src={w.icon} alt="" className="h-5 w-5 rounded" />}
                    Connect {w.name}
                  </Button>
                ))}
              </div>
            ))}

          {(step === "quote" || step === "signing") && account && (
            <>
              <p className="text-sm text-text-muted">
                {wallet?.name}: <span className="font-mono">{account.address.slice(0, 4)}...{account.address.slice(-4)}</span>
              </p>
              {quote && !expired ? (
                <>
                  <p className="font-serif text-3xl text-text">{quote.tokens} $REWORK</p>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    About ${quote.usd} at today&apos;s price, for {quote.days} days of Pro. The tokens are destroyed and can&apos;t be refunded.
                    Quote good for {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}.
                  </p>
                  <Button onClick={burn} loading={step === "signing"}>
                    <Flame /> Burn and get Pro
                  </Button>
                </>
              ) : (
                <Button onClick={getQuote} loading={busy}>
                  {expired ? "Get a new quote" : "Get a quote"}
                </Button>
              )}
            </>
          )}

          {step === "claiming" && <p className="text-sm text-text-secondary">Burn sent. Waiting for Solana to confirm it, usually under a minute...</p>}

          {step === "done" && access && (
            <>
              <p className="font-serif text-3xl text-text">You&apos;re Pro.</p>
              <p className="text-sm text-text-secondary">{describeAccess(access)}.</p>
              <Button asChild variant="inverse">
                <Link href="/dashboard">Start tailoring</Link>
              </Button>
            </>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}
        </div>

        {step !== "done" && step !== "claiming" && (
          <form
            className="mt-8 space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (paste.trim()) void claim(paste.trim())
            }}
          >
            <label htmlFor="burn-signature" className="text-sm text-text-muted">
              Already burned and didn&apos;t get Pro? Paste the transaction signature.
            </label>
            <div className="flex gap-2">
              <input
                id="burn-signature"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                className="h-10 min-w-0 flex-1 rounded-input border border-input bg-surface px-3 font-mono text-sm text-text"
                placeholder="Transaction signature"
                autoComplete="off"
              />
              <Button type="submit" variant="secondary">
                Check
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
