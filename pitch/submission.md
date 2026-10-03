# Kapora: HackTribe submission kit

## Project title (5 words max)

**Kapora: Trustless Deposits for Marketplaces**

## Category

**Finance Without Intermediaries** (Superteam PL, Solana)

## Team

- **Repository:** https://github.com/89CF/kapora
- **Team name:** [Team name]
- **Members (1):** [Name Surname] — ahmetenes2004@hotmail.com

---

## Description (paste as-is; 483 words including the team line)

**Problem.** Buying a used car or renting a flat from a listing site usually starts with a deposit paid to a stranger. In Poland that deposit goes by bank transfer straight to the other person's account, and fake listings that collect deposits and vanish are a well-known scam. The law already says what should happen: under Civil Code art. 394 (*zadatek*), if the payer backs out, the recipient keeps the deposit; if the recipient backs out, they return double. But nobody sues an anonymous stranger over a few thousand złoty.

**Who it's for.** Our primary users are people in Poland who pay a zadatek to strangers from listing sites, and their sellers. They are not crypto users, so the app uses plain language and PLN amounts. Secondary users: marketplaces embedding our widget, our distribution channel.

**Design rationale.** We redesigned the up-front deposit paid before a deal is completed. Today the intermediary is either nobody (an IBAN transfer with zero protection) or an expensive one: a court to enforce art. 394, a notary escrow, or a platform's paid payment protection. Without it, the rule runs instantly and with no court: whoever backs out loses, and a seller who walks away pays double. The money waits in the program, not with either party. There is no fee, and nobody can block the payout.

**How it works.** Kapora is one Anchor program on Solana devnet plus an embeddable widget. The seller (payee) creates an offer and locks a stake first, so a fake seller has to risk their own money. The buyer (payer) then locks the deposit into a vault PDA owned by the program. When both parties confirm the handover, the funds are released. The intermediary disappears in `programs/kapora/src/settle.rs`: `payout` computes the split from the rule and `settle` pays out from the vault. Only `confirm_complete`, `withdraw` and `claim_after_deadline` call it. If one side vanishes, after the deadline anyone, even an uninvolved visitor, can press "Apply the outcome" (`claim_after_deadline`); the program treats the missing party as a no-show and pays out by the rule. There is no admin instruction, and the upgrade authority will be revoked after the final deploy.

The same program serves four templates that differ only in their parameters (penalty Forfeit or Refund, who receives the amount on completion, legal label): Deposit (zadatek, our main story), P2P Rental, Freelance and P2P Purchase. An optional arbiter, agreed when the offer is created, can only split the funds between the two parties; if the arbiter stays silent, everyone is refunded. Each account builds an on-chain behaviour trail without identity. No personal data goes on-chain: listing details and evidence stay off-chain, and only salted SHA-256 hashes are stored. The demo uses two fictional sites, DemoAuto (cars) and DemoRent (camera rental), test USDC (1 USDC ≈ 1 PLN) and deadlines shortened to seconds; every step links to Solana Explorer.

Team: [Team name] — [Name Surname] — ahmetenes2004@hotmail.com

---

## 3-minute video (mandatory; upload to a PUBLIC link, maximum 3:00)

**Recorded backup:** `pitch/demo-video.webm` is an automatic, captioned recording of the real app flow. It can serve as the backup and as the submission video, but it still has to be **uploaded to a public link** (YouTube unlisted/public, Loom or Drive with "anyone with the link") and the link pasted into HackTribe and onto deck slide 10. The voice-over script below is for a human-narrated version, which is recommended if you have time.

**Setup (one browser is enough):**
- Use the **"Acting as"** switcher in the header to change role: **Demo Seller**, **Demo Buyer** or **Demo Visitor**. These are in-browser demo accounts, devnet only; Phantom or Solflare are optional.
- Before recording, open **Faucet** (`/dev/faucet`) and click **Fund demo accounts**. This gives test USDC (plus a little SOL when needed) to all three accounts.
- The offer form starts in **"Demo mode: deadlines in seconds"** with these defaults:
  - buyer must accept within 600 s,
  - both confirm within **60 s**,
  - then an objection period of **30 s**,
  - the arbiter decides within 60 s.
  So "Apply the outcome" becomes available about **90 s after the buyer reserves**.
- Prepare **Deal 2** about 2 minutes before you record that scene: as Demo Seller create a DemoAuto offer; as Demo Buyer **Reserve & lock**, then **Confirm**; the seller does nothing.

| Time | Shot (screen) | Voice-over |
|---|---|---|
| 0:00–0:15 | Deck slide 2 (three scam steps, then the Art. 394 card) | "You find a car online. The seller wants a deposit by bank transfer, and then disappears. Polish law already has the rule: if the seller backs out, they owe you double. But nobody goes to court over a deposit." |
| 0:15–0:25 | Deck slide 3 (who it's for and the design rationale) | "Kapora is for people in Poland paying a zadatek to strangers from listing sites, and for their sellers. We remove the intermediary, whether that's nobody, a court, or a notary escrow, and put the rule into a Solana program." |
| 0:25–0:48 | Acting as **Demo Seller**: `/demo/auto` → Toyota Corolla listing → **Pay deposit safely with Kapora** → modal "Create an offer: Deposit (zadatek)" (rule **Zadatek**, demo mode on) → **Lock stake & create offer** → "Share this link with the buyer" → **Copy** | "On DemoAuto, a fictional car site, the seller clicks our widget and creates the offer. First the seller locks their own stake, the same amount as the deposit. A fake seller would have to risk real money." |
| 0:48–1:08 | Switch "Acting as" → **Demo Buyer**, open the link → **Reserve & lock 500 USDC** → banner "Your deposit is locked in the program, not with the seller" → **On-chain activity** → **View on Solana Explorer** | "The buyer reserves, and the deposit goes into a vault owned by the program, not to the seller. Every step is a confirmed devnet transaction; here it is on Solana Explorer." |
| 1:08–1:25 | Switch to **Demo Seller**: "Payment secured" banner → row "Deal completed" → **Confirm**. Switch to **Demo Buyer** → **Confirm** → outcome card "Deal completed" | "At the handover both confirm 'Deal completed'. Two signatures, and the program releases the money to the seller. Both profiles record a completed deal." |
| 1:25–1:58 | Deal 2: switch to **Demo Visitor** ("You are viewing as a visitor"). Card "Deadline passed: apply the outcome" → **Apply the outcome** → outcome "Seller didn't confirm in time": the buyer gets 1,000 USDC (2×) → **View payout on Solana Explorer** | "Now the important part. In a second deal the seller simply vanished. The deadline has passed, and anyone, even an uninvolved visitor, can press 'Apply the outcome'. The program counts the seller as a no-show and pays the buyer double. No court, no support ticket, no admin. This is the moment the intermediary is no longer needed." |
| 1:58–2:22 | **Demo Seller** (owner): `/demo/rent` → camera kit → **Pay security deposit with Kapora** → **Create offer** (Rental template, no stake). **Demo Buyer** (renter): **Rent & lock 500 USDC** → row "I returned the item" → **Confirm**. **Demo Seller**: "Item returned in good condition" → **Confirm** → "Deal completed: the security deposit went back to the renter" | "Same widget, same program, a different sector. On DemoRent, a camera rental site, the renter locks a security deposit. After the return both confirm, and the deposit goes back to the renter automatically." |
| 2:22–2:37 | Deck slide 8 (privacy), then **My profile** | "No personal data goes on-chain: just amounts, rules, salted hashes and behaviour counters. You see how an account behaved, not who it is." |
| 2:37–2:53 | Deck slide 5 (where the intermediary disappears), then slide 9 (vision) | "Every rule that moves money lives in settle dot rs, in the on-chain program. There's no admin instruction. Next: shipped purchases, milestones, swaps and event-based payouts." |
| 2:53–3:00 | Deck slide 10 (closing) | "Kapora. One component: every marketplace, every sector, every country." |

Voice-over: 318 words, about 1.8 words per second. Keep the final cut at or under 3:00.

---

## 3-minute live demo script (must run LIVE; the video is only a backup)

**Before going on stage (one browser, one laptop)**

1. Open the app and check that the header shows **DEVNET** and the **"Acting as"** switcher.
2. Go to **Faucet** → **Fund demo accounts**. Check that Demo Seller, Demo Buyer and Demo Visitor each have test USDC (≥ 1,000) and some SOL.
3. About **3 minutes before your slot**, prepare **Deal 2**:
   - As Demo Seller, on a second DemoAuto car, click **Pay deposit safely with Kapora** → **Lock stake & create offer** → **Copy**.
   - As Demo Buyer, open the link → **Reserve & lock …** → **Confirm**.
   - Leave the seller silent. About 90 s after the reserve, the card switches to "Deadline passed: apply the outcome".
4. Open tabs: the DemoAuto listing, the Deal 2 page, the DemoRent camera listing, the deck at slide 2. Solana Explorer opens from the app's links.

**0:00–0:25: Problem and target user (slides 2 → 3)**

1. Slide 2: "Car from a listing site, a deposit by bank transfer, and the seller is gone. Art. 394 says the seller owes double, but nobody sues."
2. Slide 3: "We built this for people in Poland paying a zadatek to strangers, and for their sellers. They are not crypto users. Marketplaces embed us with one widget."

**0:25–1:20: Full flow on DemoAuto (Deposit / zadatek template)**

3. Acting as **Demo Seller**, open the car listing and click **Pay deposit safely with Kapora**. The modal "Create an offer: Deposit (zadatek)" opens.
   - Show rule **Zadatek** ("Whoever backs out pays. If you back out, the buyer gets 2× back.") and **Demo mode: deadlines in seconds** (60 s to confirm, 30 s objection period).
   - Click **Lock stake & create offer**. Say: "The seller locks their own stake first."
4. In **Share this link with the buyer**, click **Copy**. Open the link (**Open in new tab ↗** if you are inside the modal).
5. Switch **Acting as → Demo Buyer**, then click **Reserve & lock 500 USDC**.
   - The banner reads "Your deposit is locked in the program, not with the seller".
   - In **On-chain activity**, click **View on Solana Explorer** to show the confirmed transaction.
6. Switch to **Demo Seller**. Point at the **Payment secured** banner: "Nobody, not even Kapora, can move it except by the rules."
7. On the row **Deal completed**, click **Confirm**. Switch to **Demo Buyer** and click **Confirm** again. The outcome card reads **Deal completed** (settled by the program, final), and the seller received 1,000 USDC.

**1:20–2:00: The moment the intermediary is no longer needed (Deal 2)**

8. Open the Deal 2 tab and switch **Acting as → Demo Visitor**. The badge reads "You are viewing as a visitor". Point out "Buyer confirmed / Seller pending" and the passed deadlines.
9. In the card **Deadline passed: apply the outcome**, click **Apply the outcome**. The outcome reads **Seller didn't confirm in time**: the buyer gets 1,000 USDC (2×), the seller 0.
10. Click **View payout on Solana Explorer**. Say: "An uninvolved visitor just enforced the rule. No court, no admin, not even us."

**2:00–2:30: Same component, another sector (DemoRent / Rental template)**

11. As **Demo Seller** (the owner), open the camera listing and click **Pay security deposit with Kapora** → **Create offer** (the Rental template has no stake). Copy and open the link.
12. As **Demo Buyer** (the renter), click **Rent & lock 500 USDC**. Then, on the row **I returned the item**, click **Confirm**.
13. As **Demo Seller**, on the row **Item returned in good condition**, click **Confirm**. The outcome reads **Deal completed**: "the security deposit went back to the renter" (`on_complete = ToPayer`).

**2:30–3:00: Privacy, code, close (slides 8 → 5 → 10)**

14. Slide 8: "Money on-chain, people off-chain. Only salted hashes and counters."
15. Slide 5: "This is the code path: settle.rs, `payout` and `settle`. There's no admin instruction, and the upgrade authority will be revoked after the final deploy." It is **not revoked yet**, so say "will be".
16. Slide 10: "**One component: every marketplace, every sector, every country.** Thank you."

**If something breaks:** say plainly what failed and why (for example, the devnet RPC timed out). Refresh `/d/<deal>`: the state is on-chain, so nothing is lost. If an account is out of USDC, use **Faucet → Fund demo accounts**. As a last resort, play `pitch/demo-video.webm`.

---

## Q&A prep (official judge questions from brief section 1.1)

**1. Where exactly in the code does the intermediary disappear?**
In `programs/kapora/src/settle.rs`. The `payout` function computes the split from the rule (penalty, on_complete, outcome, D, S), and `settle` executes it. They are called by the `confirm_complete`, `withdraw` and `claim_after_deadline` instructions. The money sits in the vault PDA (`["vault", deal]`, with the Deal PDA as authority and no private key), and it can leave only through these rules.

**2. What if one party disappears halfway through? Where is the money, and who can get it back?**
The money is in the vault PDA. After the deadline (plus the objection period), **anyone** can call `claim_after_deadline` (in the app: the **"Apply the outcome"** button, visible even to an uninvolved visitor). The program counts the missing party as a no-show and pays out by the rule. Under zadatek, if the seller vanished, the buyer receives both the deposit and the stake (2×). The remaining party doesn't need anyone's help.

**3. Who can do what? Can you, as the author, change anything after deployment?**
The program has **no admin authority or admin instruction**. Each instruction's caller is fixed: `create_offer` by the payee, `reserve` by the payer, `confirm_complete`, `withdraw` and `open_dispute` by either party, `resolve` only by the arbiter both agreed to, and `claim_after_deadline` and `expire_dispute` by anyone. `cancel_offer` can be called by the payee, or by anyone after the reserve window. After the final deploy we revoke the upgrade authority (`solana program set-upgrade-authority <PROGRAM_ID> --final`), so we can't change it either. *If it hasn't been revoked yet at the time of judging, say so honestly.*

**4. Isn't the arbiter just an intermediary?**
The arbiter is **optional** and is fixed in the offer, which the payer accepts by reserving. The main scenario (the deposit) runs without an arbiter. An arbiter can only **split the vault between the two parties** (`payer_bps`); they can never take funds for themselves. If they don't decide in time, anyone can call `expire_dispute` and everyone gets their own money back automatically.

**5. Why blockchain and not a regular database?**
With a database, whoever owns the database controls the money and the rule, so they become the new intermediary. Here the money is not under the control of either party, or under ours. The rule sits in a program that everyone can read and nobody can change alone, and payouts happen even if our website is offline.

**6. What would you do with one more week?**
Auto-confirmed shipped purchases (a shipping-data attester plus an inspection window), multi-stage freelance and service payments (a `Milestones` kind), a pilot integration with a real marketplace, and email login with an embedded wallet so non-crypto users never see a seed phrase.

**Extra questions to be ready for**

- **Why not a normal escrow service?** Escrow is a custodian with fees and discretion. Here nobody holds the money, the outcome is fixed in advance, and the seller has to stake too, which is what keeps scammers out.
- **What if both parties collude?** They can only move their own money: payouts always sum to exactly D + S. They could inflate reputation with self-dealing, but each fake deal locks real capital. Sybil-resistant reputation is future work.
- **Is an on-chain zadatek legally valid?** We encode the parties' agreement and execute it; courts remain available. Whether a stablecoin deposit counts as a *zadatek* needs legal review. That is a design assumption, and we state it.
- **Business model?** None in the MVP (no fee, payouts are exactly P). Future options, not implemented: a small protocol fee or a SaaS tier for marketplaces (dashboard, webhooks).
- **Limitations?** The real-world handover is confirmed by the parties, not observed by the chain. An arbiter is trusted once both agree to one. This is devnet with test USDC, not audited.

---

## Pre-submission checklist (Superteam rules first, then the HackYeah FAQ)

Deadline: **Sunday 4 October 2026, 23:00**. Upload an early draft to HackTribe; it can be edited until the deadline but not after voting starts.

- [ ] **HackTribe account linked to Discord** (the FAQ requires a Discord ID to upload).
- [ ] Category: **Finance Without Intermediaries**.
- [ ] **Project title**, at most 5 words: "Kapora: Trustless Deposits for Marketplaces".
- [ ] **Team name** filled in (replace "[Team name]") and the **member list** (1 member) with name, surname and email in the description.
- [ ] **Description** in English, at most 500 words, containing the **design rationale** and the **target user** (paste the section above, with placeholders replaced).
- [ ] **PDF presentation**, at most 10 slides (`pitch/deck.pdf`; also attach `deck.pptx` if allowed). Fill in the repo, video and demo links on slide 10 and re-run `python build_deck.py`.
- [ ] **Video**: at most 3:00, English, at a **public link** (mandatory for Superteam). Use `pitch/demo-video.webm` (recorded backup) or a narrated recording, then upload and paste the link.
- [ ] **Code repository**: **public** during judging, a single repo with modules in separate folders, and a README covering who it's for, design rationale, where the intermediary disappears, what is where, program ID, permissions, limitations and setup.
- [ ] **Credits / External resources** section in the README (all libraries, templates and tools, plus AI assistance), as the HackYeah rules require.
- [ ] **Gallery**: at least 1 image (use `pitch/screens/deal.png`, `pitch/screens/widget.png` or `pitch/preview/slide-01.png`).
- [ ] **Demo link** (optional): the devnet app URL. Login info: none needed; use the header "Acting as" switcher (Demo Seller / Demo Buyer / Demo Visitor, in-browser devnet accounts) and **Faucet → Fund demo accounts**. Phantom/Solflare on devnet is optional.
- [ ] Upgrade authority: **not revoked yet**. Either revoke it after the final deploy (`solana program set-upgrade-authority <PROGRAM_ID> --final`), or keep the honest wording "will be revoked after final deploy" in the README, deck and answers.
- [ ] Demo accounts funded (**Faucet → Fund demo accounts**), Deal 2 prepared about 3 minutes before the slot, and `pitch/demo-video.webm` ready as a backup.
- [ ] No real brand names or logos in the app or screenshots (DemoAuto and DemoRent are fictional).
