"use client";

import clsx from "clsx";
import Link from "next/link";
import { ExternalLink, PartyPopper, Scale, ShieldCheck, Undo2 } from "lucide-react";
import { useSettlement } from "@/hooks/useSettlement";
import { payout, type UiDeal } from "@/lib/model";
import { explorerAddress, explorerTx, fmtPln, fmtUsdc, shortAddr } from "@/lib/format";
import { outcomeInfo } from "@/lib/rules";

export function OutcomeCard({ deal, walletStr }: { deal: UiDeal; walletStr: string | null }) {
  const settlement = useSettlement(deal);
  const info = outcomeInfo(deal.outcome, deal.tpl);
  const resolved = deal.outcome === "resolved";
  // The arbiter's split isn't stored on the deal account, so for "resolved" we read the real amounts from the tx.
  const preview = resolved ? null : payout(deal, deal.outcome);
  const toPayer = preview ? preview.toPayer : settlement?.toPayer ?? null;
  const toPayee = preview ? preview.toPayee : settlement?.toPayee ?? null;
  const Icon = deal.outcome === "completed" ? PartyPopper : resolved ? Scale : deal.outcome === "cancelled" || info.tone === "neutral" ? Undo2 : ShieldCheck;

  const parties = [
    { key: "payer", label: `${deal.tpl.roles.payer} received`, who: deal.payer, amount: toPayer },
    { key: "payee", label: `${deal.tpl.roles.payee} received`, who: deal.payee, amount: toPayee },
  ];

  return (
    <div
      data-testid="outcome-card"
      className={clsx(
        "relative overflow-hidden rounded-3xl border p-6 sm:p-8",
        info.tone === "good" && "border-emerald-400/30 bg-gradient-to-br from-emerald-400/[0.14] via-brand-mint/[0.05] to-transparent",
        info.tone === "warn" && "border-amber-400/30 bg-gradient-to-br from-amber-400/[0.12] via-amber-400/[0.03] to-transparent",
        (info.tone === "neutral" || info.tone === "bad") && "border-white/10 bg-gradient-to-br from-brand-violet/[0.12] via-white/[0.02] to-transparent",
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={clsx(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            info.tone === "good" ? "bg-emerald-400/20 text-emerald-200" : info.tone === "warn" ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-slate-200",
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <div className="label">Settled by the program · final</div>
          <h2 data-testid="outcome-title" data-outcome={deal.outcome} className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {info.title}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-300">{info.desc}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {parties.map((p) => {
          const you = !!walletStr && !!p.who && p.who.toBase58() === walletStr;
          return (
            <div key={p.key} className="rounded-2xl border border-white/[0.08] bg-ink/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{p.label}</span>
                {you && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-white">You</span>}
              </div>
              {p.who ? (
                <>
                  <div
                    data-testid={`outcome-${p.key}-amount`}
                    data-base-units={p.amount ? p.amount.toString() : ""}
                    className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-white"
                  >
                    {p.amount ? fmtUsdc(p.amount) : resolved ? "…" : "—"}
                  </div>
                  {p.amount && <div className="text-xs text-slate-500">≈ {fmtPln(p.amount)} (demo rate: 1 USDC ≈ 1 PLN)</div>}
                  <Link href={`/profile/${p.who.toBase58()}`} className="mt-3 inline-flex items-center gap-1 text-sm text-violet-300 hover:text-white">
                    {shortAddr(p.who)} · view track record →
                  </Link>
                </>
              ) : (
                <div className="mt-2 text-sm text-slate-500">Nobody reserved this offer.</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {settlement && (
          <a href={explorerTx(settlement.signature)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-white hover:underline">
            <ExternalLink className="h-4 w-4" /> View payout on Solana Explorer
          </a>
        )}
        <a href={explorerAddress(deal.address)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white">
          <ExternalLink className="h-4 w-4" /> Deal account on Solana Explorer
        </a>
      </div>
    </div>
  );
}
