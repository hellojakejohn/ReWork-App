# Questions for Jake (morning of Nov 18)

Short answers are fine ("1 yes, 2 b, ..."). Nothing below is merged or changed without you.

## What happened overnight

- **Stripe checkout fixed.** Managed Payments stays on (your call: Stripe handles sales tax
  everywhere for 3.5% a sale). Both products now carry the tax code "SaaS, personal use".
  Stripe says "Ready to use", and the $29 button opens Stripe's payment page again. I stopped
  there: no card entered, no money moved.
- **PR 55**: match cards say "Posted about N months ago" for ads 90+ days old, and the list
  hides matches that share nothing with the resume (Stevie: 25 -> 20).
- **Docs**: todo bin, STATE and this file, in the docs PR.
- The daily job pull runs fine (about 7:20am CT, ~25.6k open jobs).

## Questions

1. **The $29 test.** Ready whenever you are (todo bin #1). It's the last launch gate. OK to
   launch the moment it passes?

2. **Sales tax on top or included?** Stripe's checkout now shows "Tax: enter address to
   calculate", so in states that tax software a buyer may pay $29 plus tax. Options:
   a. Keep it on top, and I add "plus tax where it applies" next to the prices (honest, common).
   b. Make prices tax-included in Stripe, so everyone pays exactly $29 / $15 and you keep a bit
      less in taxed states.
   My pick: b, because "$29, nothing else" matches the "no surprises" brand. It's a Stripe
   setting on each price; I can walk you through it or do it in Chrome.

3. **Subscriptions under Managed Payments.** Stripe says those customers manage purchases
   through Link. Our "Manage billing" button opens Stripe's billing portal. I'd like to
   confirm cancel works end to end: OK to do the optional $15 subscribe-then-cancel test right
   after the $29 one?

4. **Merge PRs 54 and 55?**
   - 54: the Upgrade popup no longer says "You've used all 3 free tailors" when you haven't.
   - 55: old-posting note and no empty 0% matches.

5. **Support email.** Set up `support@rework.careers` forwarding to your Gmail this week
   (free, 10 minutes, todo #4)? Receipts currently show no support email.

6. **Launch post.** You said marketing waits until the test passes. Want me to draft the
   launch posts (X, LinkedIn, a short Product Hunt blurb) so they're ready the moment it does?

7. **Stevie's test account.** Keep it for future checks (my pick), or delete it after the
   refund?

## Next on my list (unless you say otherwise)

- After the $29 test: check the database shows Pro on, then off after the refund.
- First week: watch `/admin` daily for errors, sign-ups and AI spend.
- Post-launch: a public job page per role and city (good for Google), the Chrome extension.
