import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Car,
  Briefcase,
  Camera,
  KeyRound,
  ShoppingBag,
  Droplet,
  EyeOff,
  Fingerprint,
  Handshake,
  Lock,
  MessageCircle,
  Scale,
  ShieldCheck,
  Timer,
  Undo2,
} from "lucide-react";
import { LinkButton } from "@/components/ui";
import { LiveStats } from "@/components/LiveStats";
import { CodeSnippet } from "@/components/CodeSnippet";
import { PLATFORM_AUTO } from "@/lib/config";
import { TEMPLATES, TEMPLATE_KEYS } from "@/lib/templates";

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pt-24">
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-mint" /> Finance without intermediaries · Solana devnet
          </div>
          <h1 className="mt-6 text-[44px] font-semibold leading-[1.04] tracking-tight text-white sm:text-6xl">
            You can disappear,
            <br />
            <span className="text-gradient">but not with my money.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
            TwoKeys is a trust component for marketplaces. Money between strangers waits in a program on Solana, not with a
            person, and the agreed rule executes itself. For deposits that&apos;s the Polish <i className="text-slate-200">zadatek</i> (art. 394):
            back out and you pay; disappear and the other side is made whole, automatically.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/demo/auto" size="lg">
              <Car className="h-4 w-4" /> Try DemoAuto
            </LinkButton>
            <LinkButton href="/demo/rent" size="lg" variant="secondary">
              <Camera className="h-4 w-4" /> Try DemoRent
            </LinkButton>
            <LinkButton href="/dev/faucet" size="lg" variant="ghost">
              <Droplet className="h-4 w-4" /> Get test USDC
            </LinkButton>
          </div>
        </div>

        <HeroVisual />
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <LiveStats />
        <div className="mt-2 text-right">
          <Link href="/stats" className="text-xs text-slate-500 hover:text-white">
            Live from on-chain PlatformStats accounts · see all stats →
          </Link>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto mt-28 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="label mb-3 text-brand-mint/80">The problem</div>
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">A bank transfer to a stranger is a leap of faith.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { t: "Fake listings", d: "Scammers post a great car or flat, collect deposits by bank transfer, and vanish." },
              { t: "The law exists…", d: "Zadatek says a seller who backs out pays back double. On paper." },
              { t: "…but nobody sues", d: "For a few thousand złoty, court is slower and costlier than the loss." },
            ].map((c) => (
              <div key={c.t} className="panel p-5">
                <div className="font-semibold text-white">{c.t}</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto mt-28 max-w-6xl px-4 sm:px-6">
        <div className="label mb-3 text-brand-mint/80">How it works</div>
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Mutual collateral. Two signatures. Zero middlemen.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            { i: <Lock className="h-5 w-5" />, t: "Seller locks a stake", d: "Equal to the deposit. A scammer has to put their own money on the line, so they don't." },
            { i: <MessageCircle className="h-5 w-5" />, t: "Buyer reserves", d: "Opens the link, locks the deposit. The seller sees “Payment secured” instantly." },
            { i: <Handshake className="h-5 w-5" />, t: "Meet & confirm", d: "At the handover both press Confirm. Funds release to the seller as part of the price." },
            { i: <Timer className="h-5 w-5" />, t: "Or the rules decide", d: "Someone disappeared? After the deadline anyone, even a stranger, can apply the payout the rule prescribes. No intermediary." },
          ].map((s, idx) => (
            <div key={s.t} className="panel relative p-6">
              <div className="absolute right-5 top-5 font-mono text-xs text-slate-600">0{idx + 1}</div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">{s.i}</span>
              <div className="mt-5 font-semibold text-white">{s.t}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Payout table */}
      <section className="mx-auto mt-28 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          <div>
            <div className="label mb-3 text-brand-mint/80">Legal templates</div>
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">The law, as code.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
              Two templates cover most deposits. <b className="text-slate-200">Zadatek</b> punishes whoever backs out.{" "}
              <b className="text-slate-200">Zaliczka</b> is a refundable advance. Country and sector templates are parameterised versions of these two.
            </p>
            <p className="mt-4 text-sm text-slate-500">Example: 1,000 USDC deposit, 1,000 USDC seller stake.</p>
          </div>
          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="p-4 font-semibold">What happens</th>
                  <th className="p-4 font-semibold">Zadatek: buyer / seller</th>
                  <th className="p-4 font-semibold">Zaliczka: buyer / seller</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[
                  ["Both confirm", "0 / 2,000", "0 / 2,000", "good"],
                  ["Buyer backs out", "0 / 2,000", "1,000 / 1,000", ""],
                  ["Seller backs out", "2,000 / 0", "1,000 / 1,000", "hl"],
                  ["Buyer no-show", "0 / 2,000", "1,000 / 1,000", ""],
                  ["Seller no-show", "2,000 / 0", "1,000 / 1,000", "hl"],
                  ["Nobody confirms", "1,000 / 1,000", "1,000 / 1,000", ""],
                  ["Arbiter decides", "split by bps", "split by bps", ""],
                ].map(([w, z, l, tone]) => (
                  <tr key={w} className="border-b border-white/[0.04] last:border-0">
                    <td className="p-4 text-slate-300">{w}</td>
                    <td className={`p-4 font-mono ${tone === "hl" ? "font-semibold text-brand-mint" : "text-slate-200"}`}>
                      {z}
                      {tone === "hl" && <span className="ml-2 rounded bg-brand-mint/15 px-1.5 py-0.5 font-sans text-[10px] font-bold text-brand-mint">2×</span>}
                    </td>
                    <td className="p-4 font-mono text-slate-400">{l}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>


      {/* Templates */}
      <section className="mx-auto mt-28 max-w-6xl px-4 sm:px-6">
        <div className="label mb-3 text-brand-mint/80">Same program, four templates</div>
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">One component, every sector.</h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-400">
          A template only fills in the parameters: who locks what, what happens to whoever backs out, and where the money goes
          when both confirm. The on-chain rules are identical for everybody.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TEMPLATE_KEYS.map((k) => {
            const t = TEMPLATES[k];
            const Icon = k === "deposit" ? KeyRound : k === "rental" ? Camera : k === "freelance" ? Briefcase : ShoppingBag;
            return (
              <Link key={k} href={`/offer/new?template=${k}`} className="panel panel-hover group flex flex-col p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-brand-mint">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="mt-5 font-semibold text-white">{t.label}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {t.roles.payer} locks the {t.amountLabel} · {t.roles.payee} makes the offer
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">{t.tagline}</p>
                <div className="mt-4 text-xs text-slate-500">
                  Both confirm: {t.onComplete === "toPayer" ? `${t.amountLabel} back to the ${t.roles.payer.toLowerCase()}` : `paid to the ${t.roles.payee.toLowerCase()}`}
                  <br />
                  Arbiter: {t.arbiterRecommended ? "recommended, optional" : "optional"}
                </div>
                <div className="mt-4 inline-flex items-center gap-1 text-sm text-violet-300 group-hover:text-white">
                  Create offer <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Privacy + reputation */}
      <section className="mx-auto mt-28 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { i: <Fingerprint className="h-5 w-5" />, t: "Behaviour, not identity", d: "Accounts build a public track record of completed deals, back-outs and no-shows. No names, ever.", href: "/stats", cta: "Privacy model" },
            { i: <EyeOff className="h-5 w-5" />, t: "Salted hashes only", d: "Listings and evidence stay off-chain. Delete the salt and the on-chain hash points to nothing.", href: "/stats", cta: "On-chain vs off-chain" },
            { i: <Scale className="h-5 w-5" />, t: "Optional arbiter", d: "Only if both sides agree on one. It can split funds in a dispute, never take them, and must decide in time.", href: "/arbiter", cta: "Arbiter desk" },
          ].map((c) => (
            <Link key={c.t} href={c.href} className="panel panel-hover group p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-brand-mint">{c.i}</span>
              <div className="mt-5 font-semibold text-white">{c.t}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{c.d}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm text-violet-300 group-hover:text-white">
                {c.cta} <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Integration */}
      <section id="demos" className="mx-auto mt-28 max-w-6xl scroll-mt-24 px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="label mb-3 text-brand-mint/80">For marketplaces</div>
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">One script tag. Every listing protected.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
              Car portals, rental platforms, classifieds: drop in the widget and your users get enforceable deposits with
              no escrow licence, no custody, no payment processor in the middle.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href="/demo" variant="secondary">
                See the demo marketplaces <ArrowRight className="h-4 w-4" />
              </LinkButton>
              <LinkButton href="/offer/new" variant="ghost">
                Create an offer directly
              </LinkButton>
            </div>
          </div>
          <CodeSnippet
            code={`<script src="https://your-twokeys-host/widget.js"
        data-platform="${PLATFORM_AUTO.toBase58().slice(0, 12)}…"
        data-listing-id="abc123"
        data-amount="2000"
        data-template="deposit"></script>`}
          />
        </div>
      </section>

      {/* Closing */}
      <section className="mx-auto mt-28 max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-brand-violet/25 via-brand-indigo/10 to-brand-mint/10 px-8 py-14 text-center">
          <div aria-hidden className="grid-bg absolute inset-0 opacity-60" />
          <div className="relative">
            <BadgeCheck className="mx-auto h-10 w-10 text-brand-mint" />
            <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              One component. Every marketplace, every sector, every country.
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <LinkButton href="/demo/auto" size="lg">
                Start the demo <ArrowRight className="h-4 w-4" />
              </LinkButton>
              <LinkButton href="/dev/faucet" size="lg" variant="secondary">
                <Droplet className="h-4 w-4" /> Faucet
              </LinkButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Stylised deal card showing both sides' locked funds. */
function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md animate-fade-up [animation-delay:120ms]">
      <div aria-hidden className="absolute -inset-6 rounded-[36px] bg-brand-gradient opacity-20 blur-3xl" />
      <div className="panel relative overflow-hidden p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="label">Deal · Zadatek</div>
            <div className="mt-1 font-semibold text-white">Toyota Corolla 1.8 Hybrid</div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" /> Payment secured
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            { who: "Buyer locked", amt: "1,000", c: "from-sky-400/20" },
            { who: "Seller locked", amt: "1,000", c: "from-violet-400/20" },
          ].map((x) => (
            <div key={x.who} className={`rounded-2xl border border-white/[0.08] bg-gradient-to-br ${x.c} to-transparent p-4`}>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Lock className="h-3.5 w-3.5" /> {x.who}
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-white">
                {x.amt} <span className="text-sm font-normal text-slate-400">USDC</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-ink-900/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Handover deadline</span>
            <span className="font-mono text-base font-semibold text-white">00:47</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-[62%] rounded-full bg-brand-gradient" />
          </div>
          <div className="mt-3 flex gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">
              <BadgeCheck className="h-3 w-3" /> Buyer confirmed
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-slate-400">Seller pending</span>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <Undo2 className="h-4 w-4 text-brand-mint" /> Seller backs out → buyer gets <b className="text-white">2,000</b>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Handshake className="h-4 w-4 text-brand-mint" /> Both confirm → seller gets <b className="text-white">2,000</b>
          </div>
        </div>
      </div>
    </div>
  );
}
