# rework token plan (Nov 6, 2026 launch, January push)

Plan only: nothing here is built. Research done 2026-10-27 with web sources, cited inline.
"Unverified" means no current source confirmed it. **This is research, not legal advice;**
the items marked **Lawyer** need a real crypto lawyer before launch. This replaces the
`$WORK` design in `docs/AUDIT.md` section 7 (that one had a 50% burn and treasury, which
this plan drops: fees are Jake's revenue and stay his).

## TL;DR

- **Launchpad: Bags (bags.fm) on Solana.** 1% creator fee on all volume, claimable through
  the brand's X account, a normal place for real builders. Runner-up: pump.fun (biggest
  audience, lower and falling fee, worst bots, live RICO case). Pons no longer fits: new
  launches go through an unaudited, whitelisted v2, volume is down about 78% from peak, and
  its best-known recent story is an $18.4M rug ring that used a Pons feature.
- **Design: `$REWORK`, launchpad-standard supply, zero dev allocation.** Jake earns creator
  fees only, holds nothing to sell, and says so with a public wallet.
- **On the site for Nov 6:** a `/token` transparency page, a public "Invented: 0" stats page,
  and USDC checkout through Stripe's own stablecoin payments.
- **The one token feature: burn `$REWORK` for 30 days of Pro** (section 3b). No holder perks,
  discounts or buybacks.
- **Order on Nov 6:** product live and a real Stripe sale verified first; token at midday CT;
  token talk stays on its own page and posts, never in the product flow or on TikTok.

## 1. Launchpads compared

Sources: [launchpad research](#sources). Fee numbers are as published by each platform or
quoted from DefiLlama; several official pages blocked automated reads, so some figures come
from articles quoting them.

| Platform | Chain | Creator fee | How fees are claimed | Curve / graduation | Audience now | Bots / snipers | Reputation | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Bags** | Solana (also Robinhood Chain) | 1% of volume, described as forever ([Bags docs](https://docs.bags.fm/how-to-guides/launch-token.md), [TradeTheDay](https://tradetheday.com/launchpads/bags-fm)) | **By X, GitHub or Kick account**, up to 100 fee earners ([Bags docs](https://docs.bags.fm/how-to-guides/launch-token.md)) | Curve; Solana graduation threshold and DEX unverified | Small: about $49k fees/7d on an undated snapshot ([DefiLlama](https://defillama.com/protocols/launchpad)); spiked in Jan 2026 on dev coins ([The Block](https://www.theblock.co/post/386376/solana-activity-jumps-claude-code-virality-token-launch-frenzy), older than 6 months) | No documented anti-sniper; atomic first buy supported | Real company; the GAS episode (a dev disowned a coin someone else launched for him) | Tx fees plus optional first buy |
| **pump.fun** | Solana | 0.30% on the curve; after graduation 0.30% under 420 SOL mcap, then 0.95% stepping down to 0.05% as mcap grows ([Smithii](https://smithii.io/en/pump-fun-creator-fees/), third-party) | Manual claim to wallet or a set recipient; up to 10 wallets; X claiming unverified | Curve to PumpSwap | 78% of new Solana tokens Nov 2025 to Oct 2026 ([Bitquery](https://bitquery.io/investigations/solana-launchpad-year)), over 92% of launchpad revenue ([Coinfomania](https://coinfomania.com/pumpfun-dominates-launchpad-market-capturing-92-of-revenue/)) | Heavy: 1 in 58 graduate, a third of September graduations took 3 or fewer trades ([Bitquery](https://bitquery.io/investigations/solana-launchpad-year)) | Aug 31, 2026 ruling let RICO claims against the operator proceed ([CryptoTimes](https://www.cryptotimes.io/2026/09/01/judge-dismisses-pump-fun-securities-claims-clears-solana-labs-and-foundation/)) | Unverified (historically free) |
| **Pons** | Robinhood Chain | v1: 70% of a 1% pool fee (0.7% of volume), perpetual; v2: set per launch ([v1 docs](https://docs.ponsfamily.com), [v2 docs](https://docs.ponsfamily.com/v2)) | UI claim (v1), escrow `claim()` (v2); no X verification | v1 none (straight to Uniswap V3); v2 curve to locked Uniswap v4 | About $1M fees/day early Oct, down 78% from peak ([Memeburn](https://memeburn.com/pons-made-124m-in-fees-in-30-days/)); chain volume down another 23% by Oct 26 ([crypto.news](https://crypto.news/robinhood-chain-dex-volume-falls-23-percent)) | v2 99% snipe tax decaying over 5 s, but creator-set exemptions were abused | $18.4M rug ring, mostly v2 ([The Block](https://www.theblock.co/news/defi/2026-09-27-onchain-analyst-links-18-4-million-in-robinhood-chain-memecoin-extractions-to-single-rug-pull-operation-416960)); v2 unaudited, public launches closed | v1 0.0005 ETH |
| **Jupiter Studio** (Meteora DBC) | Solana | 50% of a 1% fee, plus the anti-sniper fee ([CryptoSlate](https://cryptoslate.com/products/jupiter-studio/)) | Deployer wallet | DBC, meme preset graduates around $69k | About 10% of new Solana tokens ([Bitquery](https://bitquery.io/investigations/solana-launchpad-year)) | **Best built-in defense**: 99% fee decaying over a random 15 to 60 s ([Meteora](https://docs.meteora.ag/product-overview/meteoras-anti-sniper-suite)) | Major known team | Unverified |
| **pools.trade** (Uniswap) | Robinhood Chain | Optional 0.05% ([Uniswap](https://support.uniswap.org/hc/en-us/articles/47943121516685-Launching-and-trading-tokens-on-pools-trade)) | To your wallet | Uniswap v4 | About half of early Robinhood launchpad volume ([Decrypt](https://decrypt.co/375031)) | Unverified | Best brand safety (Uniswap Labs), beta | None |
| **bonk.fun** | Solana | Classic 0%; BONKERS higher, unverified ([CryptoNews](https://cryptonews.com/news/bonkfun-slashes-creator-fees-zero-launchpad-war/), older than 6 months) | Unverified | Unverified | Under 1% of pump.fun revenue (Sep 2026) | Unverified | 51% of fees buy BONK for a treasury | Unverified |
| **Zora** | Base | 0.5% ([DefiLlama](https://defillama.com/protocol/zora-coins)) | Unverified | Uniswap from launch | Creator payouts fell from $27M (Q2 2025) to about $46k (Q2 2026) | Unverified | Shrinking company | Unverified |
| **Clanker** | Base / Farcaster | 0.2% fee; creator share unverified ([Clanker](https://farcasterhq.notion.site/Clanker-Fee-Update-Public-29d6a6c0c101803699bec943651930c1), older than 6 months) | Contract claim | Uniswap | Current volume unverified | Unverified | Owned by Farcaster/Neynar | Unverified |
| **Believe, Flaunch, Moonshot, Virtuals** | Solana / Base | Unverified or 2025 terms | Unverified | Varies | Faded (Believe revenue down 94%), unclear, or AI-agent niche (Virtuals) | Unverified | Not a fit | Varies |

### Recommendation: Bags on Solana

1. **Best fee on Solana.** 1% of volume, still paid after the curve: more than 3x pump.fun's
   0.30% on the curve, and 20x its 0.05% at higher market caps.
2. **Fees claimed by the brand's X account.** "rework's fees go to @rework (or whichever account
   Jake picks), and we hold no tokens to sell" is public and checkable. That's the strongest
   answer to "will the dev dump?"
3. **Real builders launch there**, so a named company doesn't look odd.
4. **Solana tooling is mature** (Phantom, Jupiter, DexScreener, Birdeye), and Solana is where
   memecoin buyers already are.

Weaknesses to accept: Bags' own feed is small now, so Jake's X following has to drive the
volume (as with DustSweep). Anti-sniper features and the Solana graduation threshold are
undocumented: check them on the launch screen, and read the fee split shown there (the docs
mention a separate 25% deployer share on Solana v2, which needs confirming).

**Runner-up: pump.fun**, if reach matters more than fee rate and brand risk. **Honorable
mention: Jupiter Studio**, if snipers are the main worry (no X-linked claiming). **Pons** only
if Jake confirms v1 still takes public launches; never fill its snipe-tax exemption list.

### Fee math (illustration, not a forecast)

DustSweep made about $1,200 in a day on Pons. At 0.7% that is roughly $170k of volume. The
same volume on Bags at 1% is about $1,700. Trading volume on a memecoin usually collapses
after the first days.

| Day-one volume | Bags (1%) | pump.fun (0.30% to 0.95%) |
| --- | --- | --- |
| $50k | $500 | $150 to $475 |
| $170k (DustSweep level) | $1,700 | $510 to $1,600 |
| $1M | $10,000 | $3,000 to $9,500 (falls as mcap rises) |

## 2. Token design

- **Name and ticker: `rework` / `$REWORK`.** It matches the brand and is searchable. `$WORK` is
  shorter but generic: other `$WORK` tokens almost certainly exist (tickers aren't unique on
  Solana; unverified which), which helps impersonators. **Decide.**
- **Supply:** the launchpad standard (fixed at creation). Nothing custom: custom tokenomics
  invites "what's the plan for the treasury" questions that lead toward a security.
- **Dev allocation: none (recommended).** Jake earns creator fees only, holds zero, and can say
  so with one link to the wallet. Nothing to dump, nothing to lock, nothing to explain.
  - If Jake wants skin in the game: a small atomic first buy (1% or less) in the launch
    transaction, moved straight into [Jupiter Lock](https://docs.jup.ag/user-docs/launch/lock)
    (free, audited, immutable schedule) with a 12-month cliff, lock link posted. Write the
    policy as a rule, not a vibe: "locked until [date]", never a bare "I'll never sell".
- **How Jake earns:** creator fees, claimed to one dedicated wallet, published on `/token`.
  Fees are ordinary income at fair value when received (Schedule C); set aside about 30% for
  taxes on every claim, and log USD value per claim ([IRS FAQ](https://www.irs.gov/individuals/international-taxpayers/frequently-asked-questions-on-virtual-currency-transactions)).
  When fees count as "received" (accrue vs claim) is a **CPA** question.
- **Never:** buybacks, burns funded by rework revenue, revenue share, fees to holders, a
  treasury, staking, roadmap promises tied to price, listings talk.
- **Perks** must cost Jake nothing but AI usage, and run on the free-tier model under a fixed
  cap (the AI cap has a reserved `TOKEN_HOLD` source; see `docs/AUDIT.md` section 7 for the
  wallet and cap mechanics, minus the burn).

## 3. How the token plays into the site

### Ideas (14)

| # | Idea | Effort | Cash cost to Jake | Risk |
| --- | --- | --- | --- | --- |
| 1 | **`/token` transparency page**: contract address, creator-fee wallet, how fees work, "no dev allocation" (or the lock link), monthly fees-claimed note, disclaimers, links to DexScreener and Solscan | 2 to 3 h | 0 | Low |
| 2 | **Public stats page** (`/proof`): tailors run, bullets kept, numbers left out, **Invented: 0**, keywords added. No users count if it's small, no revenue ever | 1 day | 0 | Low |
| 3 | **Pay in USDC through Stripe** ([Stripe stablecoins](https://docs.stripe.com/crypto/stablecoins)): settles in USD, no custody, subscriptions supported, no chargebacks; mostly a dashboard toggle | 1 to 2 h plus a test | Stripe fee (about 1.5%, unverified) | Low |
| 4 | **Launch-day site banner**: one dismissible line on `/` only, linking to `/token` | 1 h | 0 | Low |
| 5 | **Holder perk**: wallets holding N `$REWORK` get extra free tailors per month on the free-tier model (wallet connect, signed message, read-only balance check, daily re-check, one wallet per account) | 3 to 4 days | AI only (a few cents per tailor on Sonnet, estimate) | Medium: perks move the token out of "pure collectible" (**Lawyer**) |
| 6 | **Holder discount on Pro or the Pass** | Same as 5 plus Stripe coupons | Revenue | Medium (**Lawyer**) |
| 7 | **Pay in `$REWORK`** (TWAP quote, on-chain payment watch) | 1 to 2 weeks | 0 | High: thin-liquidity manipulation, "creates demand" reading (**Lawyer**) |
| 8 | **"Break the fact guard" bounty**: show a tailor that invented something, get Pro time (or USDC). Doubles as QA | 2 h plus review time | Pro time | Low if paid for any valid report, not sentiment |
| 9 | **Before/after proof wall** with consent; creators paid for content regardless of outcome, `#ad` disclosed | 1 day plus ops | USDC or Pro time | Medium: FTC rules ([16 CFR 465.4](https://www.goodwinlaw.com/en/insights/publications/2024/09/alerts-practices-cldr-ftc-finalizes-rule-on-consumer-reviews)); never conditioned on "landed the job" |
| 10 | **Remote-jobs weekly drop**: a curated thread or page of real remote roles, each with "tailor for this" | 2 h/week | 0 | Low |
| 11 | **Referral in Pro days**: invite a friend who tailors, both get 7 days of Pro | 1 to 2 days | AI only | Low |
| 12 | **Holder-run job hunt chat** (Telegram/Discord) that holders create and run themselves | 0 for Jake | 0 | Low (holder-created uses don't change the token's category per the SEC release) |
| 13 | **Monthly "fees and costs" note**: fees claimed, what they paid for (servers, AI, Jake's salary). No promises | 30 min/month | 0 | Low |
| 14 | **Job-landed bounty paid in tokens** (the seed idea) | 1 day | Tokens | **Don't**, as designed: an incentive conditioned on a positive outcome is banned by the FTC review rule, and token pay ties testimonials to price. Replace with 9. |

### Best 3 for Nov 6

1. **`/token` transparency page** (idea 1). It's where every token link points, so the
   product, the pricing page and onboarding never mention the token.
2. **Public "Invented: 0" stats page** (idea 2). Builds hype from the product's real promise
   and works for job seekers who will never touch crypto.
3. **USDC checkout through Stripe** (idea 3). A crypto-native way to pay that stays inside
   Stripe's rules, with no custody and no token-price exposure.

Total: about 1.5 days of build, all doable on `launch-audit`'s successor branch before Nov 6.

### Best 3 for January

No lawyer means no holder perks (section 7), so all three are token-free:

1. **Before/after proof wall plus a paid creator program** (idea 9), the engine of the
   TikTok push, FTC-compliant.
2. **Referral in Pro days** (idea 11), so January's traffic compounds.
3. **"Break the fact guard" bounty** (idea 8): Pro time for anyone who shows a tailor that
   invented something. Proves the promise in public.

## 3b. Burn for Pro (decided 2026-10-27)

A user burns `$REWORK` worth $15 and gets 30 days of Pro, exactly as if they had bought it.
Jake never holds the tokens, so there is no payment, no custody and nothing in Stripe.
It lives on `/token` only, never on the pricing page or in checkout.

**Flow**

1. `/token` shows "Burn for 30 days of Pro". The user signs in and connects Phantom.
2. The server quotes the amount: $15 at the *lower* of the Jupiter price and a 30-minute
   average, refusing to quote if liquidity is under a floor or the two prices disagree by more
   than 10%. This stops someone pumping a thin pool for a few seconds to burn less. The quote
   is valid 5 minutes.
3. Phantom signs one transaction: `burnChecked` on the `$REWORK` mint plus a memo with the
   quote id. The memo ties the burn to this account, so nobody can claim someone else's burn.
4. The server reads the transaction at `finalized` and checks: it succeeded, it burned the
   right mint, the amount is at least the quote, the memo matches, and the signature hasn't
   been used. Then it grants Pro.
5. Burns are final. No refunds; the button says so.

**Entitlement and the AI cap**

- A new `TOKEN_BURN` entitlement source, 30 days, stacking like passes, with the transaction
  signature as `externalId`. The existing `@@unique([source, externalId])` blocks replays.
  This is one enum value, so it **needs a DB migration (Jake's OK first)**.
- The cap counts it as a Pro month: 0.70 x $14.27 net, about $10 of AI.

**The catch: burn Pro costs real cash.** Stripe Pro pays for its own AI. A burn pays Jake $0:
the only money he sees is the 1% creator fee on the tokens the user bought (about $0.15 on
$15). So every burn-Pro user is AI Jake pays for out of pocket, up to about $10 a month if
they max out. Typical use is far lower (a busy month of tailoring is $1 to $3, estimate), but
it's the free-tier problem again. So burn Pro gets its own daily ceiling, like free accounts:
`AI_BURN_DAILY_USD`, default $15. When it's hit, burn users see "back at midnight UTC" and
Stripe users are never affected. Creator fees and Pass sales cover it; `/admin` shows the
split.

**Build**

About 3 to 4 days including a devnet test with a test mint: `@solana/web3.js`,
`@solana/spl-token` and Phantom's wallet-standard connect; two routes (quote, verify); an
RPC key (Helius free tier, unverified limits) added to CSP `connect-src`. Everything sits
behind a `REWORK_MINT` env var, so it ships dark and turns on after the token is live.

**Phrasing:** "Burn `$REWORK` for Pro." Not "burns shrink supply", not "deflationary", nothing
that connects burns to price.

## 4. Risks (blunt)

### Securities

- The good news: the SEC/CFTC joint interpretation of March 17, 2026 (Release 33-11412)
  treats meme coins as digital collectibles, not securities, and says a creator royalty on
  trades doesn't change that, since holders get no share of it
  ([Release 33-11412](https://www.sec.gov/files/rules/interp/2026/33-11412.pdf), pp. 16-17 and
  fn. 60). It's an interpretation, not a statute: the CLARITY Act stalled in the Senate on
  Sep 15, 2026 ([CNBC](https://www.cnbc.com/2026/09/15/senate-cloture-vote-on-clarity-act-fails-dealing-regulatory-setback-to-crypto-industry.html)),
  and a future SEC can change course.
- The bad news: **a coin named after a real operating business, promoted by its founder on
  its official channels, is closer to the line.** The same release says an investment
  contract forms through the issuer's representations about its efforts, and counts the
  website and official social accounts as places those are made (pp. 24-26). Whether a
  branded company coin is still a "collectible" is the first **Lawyer** question.
- Anti-fraud law applies whatever the category (SEC, CFTC, states, class actions: HAWK,
  LIBRA and pump.fun suits are still running).

Phrasing rules (website, X, replies, Spaces):

| Say | Never say |
| --- | --- |
| "`$REWORK` is a community memecoin for fans of rework. It's a collectible, not an investment." | "Invest in rework's future." "Get in early." |
| "It has no intrinsic value and can go to zero." | "Undervalued", "100x", "moon", "floor", price targets |
| "Holding it gives you no stake in rework or its revenue." | "As rework grows, so does `$REWORK`." "Revenue backs the token." |
| "I earn a creator fee on trades. That's how I'm paid, and I keep it. Wallet: [address]." | "Fees go to the community / treasury / holders." |
| "I hold no `$REWORK`." (or "N tokens, locked until [date]: [link]") | "I'll never sell" with nothing on-chain behind it |
| Product roadmap on product channels only | "Phase 2: listings, buybacks, staking" |
| Footer and pinned post: "Not financial advice. Not an offer of securities. rework doesn't require the token." | Burying the disclaimer, or contradicting it in replies |

### Stripe, platforms and ads

- **Stripe**: "Initial coin offerings" are on the prohibited list
  ([Stripe restricted businesses](https://stripe.com/legal/restricted-businesses), updated
  Sep 22, 2026). A brand token isn't listed, but review is discretionary. Never sell, fund or
  mention the token in Stripe checkout; don't call it fundraising; **ask Stripe support in
  writing before launch** and keep the answer. USDC through Stripe's own stablecoin payments
  is allowed and clean.
- **TikTok**: paid crypto promotion is banned in branded content and ICOs are banned in ads
  ([TikTok ads policy](https://ads.tiktok.com/help/article/tiktok-ads-policy-financial-services)).
  **The January TikTok push must be token-free**, with a no-token clause in creator contracts.
- **X**: organic posts are fine; anyone paid to post needs the Paid Partnership label
  ([Cointelegraph](https://cointelegraph.com/news/x-lifts-crypto-promo-ban-for-paid-partnerships)).
- **Vercel, Supabase, Google Cloud** acceptable-use policies ban fraud and mining, not tokens.
- **FinCEN**: accepting crypto for your own product is generally not money transmission
  ([FIN-2019-G001](https://www.fincen.gov/sites/default/files/2019-05/FinCEN%20Guidance%20CVC%20FINAL%20508.pdf)).
  Holding, swapping or redeeming tokens for other people would be.

### Brand and Jake's name

- The pattern to avoid: HAWK, LIBRA, YZY (insider supply, fast dumps, lawsuits) and GAS (holders
  expected the founder to keep pumping, and stepping back read as betrayal)
  ([Cointelegraph](https://cointelegraph.com/news/kanye-west-yzy-token-crash-51000-traders-losses),
  [HTX on GAS](https://www.htx.com/news/behind-gass-80-plunge-why-focusing-on-work-became-a-reason-t-mz4g7PrQ/)).
- rework's brand is trust ("Invented: 0"), and many job seekers associate crypto with scams.
  A dump with Jake's name on it reads as "the honest-resume guy rugged us".
- What limits it: zero dev allocation; fees claimed by a public account; a separate token
  page (and ideally a separate X handle) so product followers never see price talk; no promises,
  so there's nothing to break; and a product that keeps shipping whatever the chart does.
- Cost exposure: a token pump means a signup spike. The new AI guards (global daily ceiling,
  in-flight limit, FREE fail-closed) bound the AI bill: free accounts can cost at most
  `AI_FREE_DAILY_USD` (default $25) a day, and paying users are always covered by what they
  paid. Set the Anthropic Console limit before the token goes live.

### Needs a real lawyer (scoped consult, likely 4 to 10 hours; vendor rates suggest roughly $1.5k to $5k, unverified, get 2 or 3 quotes)

1. Does a founder-launched coin named after the company still fit "digital collectible"?
2. Red-line the `/token` page, the launch thread and the phrasing table above.
3. Holder perks (live at launch vs later, capped, revocable): collectible, tool, or risk?
4. LLC first? Should the token side be a separate entity from rework?
5. Minnesota: Howey or a risk-capital test; any issue paying bounties?
6. The launchpad's terms: who is the "issuer", what does Jake take on?
7. Giveaway rules, geo-restrictions (EU/UK), and what rework's Terms should say about the token.

## 5. Launch-day playbook

### Before Nov 6

- [ ] Launch-audit go/no-go items done (`docs/launch-audit.md`), including a real $29 sale and
      refund on prod.
- [ ] Stripe support asked in writing about the token (keep the answer).
- [ ] Fresh Phantom wallet for the launch, funded with a little SOL; fee claimer decided
      (brand X account); 2FA on that X account.
- [ ] `/token` page built with a placeholder for the CA, unlinked; `/proof` stats page live;
      USDC on in Stripe and tested.
- [ ] Threads drafted (product thread, token thread), demo video (upload to tailored PDF in
      under a minute), receipt screenshot, OG image checked on X's card validator.
- [ ] Anthropic limit set (`AI_FREE_DAILY_USD` defaults to $25); uptime monitor on `/api/health/live`.
- [ ] Don't pre-announce the token's minute or CA (bots line up on announced times).

### Friday Nov 6 (times Central)

| Time | Step |
| --- | --- |
| 7:30 | Final deploy of `main`. `/api/health` ok as admin; one live test purchase and refund. |
| 9:00 | **Product launch thread** (product only, no token): the hook "AI is taking jobs. rework helps you take one back.", the 45-second demo, the receipt card ("Invented: 0"), $15 / $29 / 3 free tailors. Remote jobs as the lead example, not the only one. Post to X, LinkedIn, relevant subreddits (follow each sub's self-promo rules), Indie Hackers. |
| 9:00 to 12:00 | Answer every reply. Watch `/admin` (signups, errors, AI spend) and the global ceiling. |
| 12:00 | **Token launch on Bags** from the fresh wallet, fee claimer set to the brand X account, no dev buy. |
| 12:01 | **Token thread** from the official account, CA in the first post, pinned, CA in bio. Says: what it is (a collectible for fans), how Jake is paid (creator fees, wallet link), no dev allocation, the disclaimer. Fill the CA on `/token`, turn on the banner on `/`. |
| 12:15 | Pay for DexScreener Enhanced Token Info (from $299, [DexScreener](https://marketplace.dexscreener.com/product/token-info)) **only if** volume justifies it; submit Jupiter verification (free standard review, [Jupiter](https://docs.jup.ag/user-docs/launch/vrfd/faq)); Birdeye info form (free). |
| Afternoon | Product posts keep going (a user's before/after with consent, a stat from `/proof`). No price talk anywhere. |
| Evening | Claim fees, log the USD value, move 30% to a tax account. |
| Sat to Sun | The DustSweep formula: ship one visible improvement over the weekend and post it. |

### If it pumps

- Say nothing about price. Post product numbers (tailors run, Invented: 0) and keep shipping.
- Expect a signup spike: watch AI spend; the global ceiling pauses AI gracefully if needed.
- Don't add promises, perks or roadmap items in the excitement; those are what turn a
  collectible into a security and a pump into a betrayal later.
- Claim fees on a fixed schedule (daily or weekly), publish the monthly note, set aside tax.
- Impersonators will launch copycats: pin "the only CA is on rework.hellojakejohn.com/token".

### If it flops

- No rescue: no buybacks, no new perks to pump it, no deleting posts.
- One honest line if asked ("the token was a fun side thing; rework is the product") and move
  on. The product launch stands on its own; that's why it went first.
- Keep `/token` up with the facts; remove the banner after a few days.

## 6. January push (job-search peak, first week)

- **Start Monday Jan 5**, the first full work week of the year; have content queued from Jan 1.
- **TikTok before/afters**, token-free: screen recordings of a real resume (with consent, or
  Jake's own) going from master to tailored, with the receipt showing what was left out and
  "Invented: 0". Three formats: "I tailored my resume for a remote job in 60 seconds", "the
  AI wanted to make up a number, here's what it did instead", "same resume, three jobs".
- **Remote-jobs angle as the lead story**: a `/remote` landing variant with remote examples,
  plus the weekly remote-jobs drop (idea 10) as the recurring content.
- **Creator program** (idea 9): pay small creators for honest videos, whatever they say,
  `#ad` disclosed, no token mentions (TikTok policy).
- **Referrals in Pro days** (idea 11) live before the push so the spike compounds.
- Retarget the Nov 6 signups who used 3 free tailors with the Pass ($29 for 90 days covers a
  January search).

## 7. Five questions Jake must answer before Nov 6

Decided 2026-10-27:

1. **Dev allocation: zero.** Jake holds no `$REWORK`.
2. **X account: a new rework account** posts the token and claims the Bags fees, quoted from
   @hellojakejohn (DustSweep's account was a day or two old at launch and that worked).
3. **Ticker: `$REWORK`.**
4. **No lawyer.** The line that matters is using the token vs promising its price, not
   "any utility at all" (an earlier draft of this answer was too strict). Decided:
   **burn `$REWORK` for Pro days** (section 3b) is the one token feature. Still off the table:
   holder discounts and perks (5, 6), paying Jake in `$REWORK` (7), token bounties (14), and
   any buyback or burn paid for with Jake's revenue or fees. The phrasing rules in section 4
   apply to every post and reply.
5. **AI limits: $25/day for free accounts** (`AI_FREE_DAILY_USD`, the default). Paid users
   aren't limited by it. Still set a monthly limit in the Anthropic Console.

Original questions, for the record:

1. **Dev allocation**
2. **Which X account**
3. **Ticker**: `$REWORK` (recommended) or `$WORK`?
4. **Lawyer**: will the consult happen before Nov 6? If not, do you launch the plain memecoin
   with no perks and the phrasing rules above, or move the token to after the consult?
5. **Money limits for launch week**: the daily AI loss you'll accept (`AI_FREE_DAILY_USD`)
   and the Anthropic monthly limit?

## Sources

Launchpads: [Bags docs](https://docs.bags.fm/how-to-guides/launch-token.md),
[Bags Robinhood docs](https://docs.bags.fm/robinhood/launch-token),
[TradeTheDay on Bags](https://tradetheday.com/launchpads/bags-fm),
[Pons v1 docs](https://docs.ponsfamily.com), [Pons v2 docs](https://docs.ponsfamily.com/v2),
[CoinDesk on Pons](https://www.coindesk.com/tech/2026/09/03/a-memecoin-making-app-becomes-crypto-s-top-fee-generators-as-robinhood-chain-activity-explodes),
[Memeburn on Pons fees](https://memeburn.com/pons-made-124m-in-fees-in-30-days/),
[The Block on the rug ring](https://www.theblock.co/news/defi/2026-09-27-onchain-analyst-links-18-4-million-in-robinhood-chain-memecoin-extractions-to-single-rug-pull-operation-416960),
[Smithii on pump.fun fees](https://smithii.io/en/pump-fun-creator-fees/),
[Bitquery launchpad year](https://bitquery.io/investigations/solana-launchpad-year),
[DefiLlama launchpads](https://defillama.com/protocols/launchpad),
[Jupiter Lock](https://docs.jup.ag/user-docs/launch/lock),
[Meteora anti-sniper suite](https://docs.meteora.ag/product-overview/meteoras-anti-sniper-suite).
Risk: [SEC Release 33-11412](https://www.sec.gov/files/rules/interp/2026/33-11412.pdf),
[Atkins remarks](https://www.sec.gov/newsroom/speeches-statements/atkins-remarks-regulation-crypto-assets-031726),
[Stripe restricted businesses](https://stripe.com/legal/restricted-businesses),
[Stripe stablecoin payments](https://docs.stripe.com/crypto/stablecoins),
[TikTok financial services ads policy](https://ads.tiktok.com/help/article/tiktok-ads-policy-financial-services),
[FTC endorsement guides FAQ](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking),
[FinCEN 2019 CVC guidance](https://www.fincen.gov/sites/default/files/2019-05/FinCEN%20Guidance%20CVC%20FINAL%20508.pdf).

Could not verify: whether Pons v1 still takes public launches; Bags' Solana graduation
threshold, anti-sniper features and exact deployer split; pump.fun's launch cost and X-handle
claiming; Stripe's view of a brand token; Minnesota's securities test; lawyer pricing.
