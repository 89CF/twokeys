import { MessageCircle, ShieldCheck, Store, UserRound } from "lucide-react";
import type { TemplatePreset } from "@/lib/templates";

/** Explains the offer flow for the chosen template (payee creates, shares a link, payer accepts). */
export function OfferIntro({ tpl, eyebrow = "New protected deal" }: { tpl: TemplatePreset; eyebrow?: string }) {
  const payer = tpl.roles.payer.toLowerCase();
  const payee = tpl.roles.payee.toLowerCase();
  return (
    <>
      <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
        <div>
          <div className="label mb-2 text-brand-mint/80">{eyebrow}</div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Create an offer: {tpl.label}</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-400">
            As the <b className="text-slate-200">{payee}</b>, you set the terms{tpl.defaultStake === "equal" ? " and lock your own stake first" : ""}. Then you
            share a link with the {payer} (e.g. on WhatsApp). The {payer} accepts by locking the {tpl.amountLabel}. From then on, the
            program on Solana enforces the rules, and nobody in the middle can touch the money.
          </p>
        </div>
        <ol className="grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400">
          {[
            { i: <Store className="h-4 w-4" />, t: `${tpl.roles.payee} sets terms` },
            { i: <MessageCircle className="h-4 w-4" />, t: "Share link" },
            { i: <ShieldCheck className="h-4 w-4" />, t: `${tpl.roles.payer} locks ${tpl.amountLabel}` },
          ].map((s, idx) => (
            <li key={s.t} className={`rounded-xl border p-3 ${idx === 0 ? "border-brand-violet/40 bg-brand-violet/10 text-white" : "border-white/[0.06] bg-white/[0.02]"}`}>
              <div className="mb-1 flex justify-center">{s.i}</div>
              {s.t}
            </li>
          ))}
        </ol>
      </div>
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] p-4 text-sm text-sky-100/90">
        <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
        <p>
          <b className="text-white">Are you the {payer}?</b> Ask the {payee} to create the offer here and send you the link. You lock your{" "}
          {tpl.amountLabel} only after you&apos;ve seen the terms{tpl.defaultStake === "equal" ? " and the " + payee + "'s locked stake" : ""}.
        </p>
      </div>
    </>
  );
}
