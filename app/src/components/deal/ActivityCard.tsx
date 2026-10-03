"use client";

import clsx from "clsx";
import { ExternalLink, History, LoaderCircle } from "lucide-react";
import type { UiDeal } from "@/lib/model";
import { useDealActivity } from "@/hooks/useDealActivity";
import { Card } from "@/components/ui";
import { explorerAddress, explorerTx, shortAddr } from "@/lib/format";

function ago(t: number | null) {
  if (!t) return "";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - t));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t * 1000).toLocaleDateString("en-GB");
}

/** Every confirmed transaction of this deal with a "View on Solana Explorer" link (persistent, not just a toast). */
export function ActivityCard({ deal, walletStr }: { deal: UiDeal; walletStr: string | null }) {
  const { items } = useDealActivity(deal.address);
  const who = (by: string | null) => {
    if (!by) return "";
    if (by === walletStr) return "you";
    if (by === deal.payee.toBase58()) return deal.tpl.roles.payee.toLowerCase();
    if (deal.payer && by === deal.payer.toBase58()) return deal.tpl.roles.payer.toLowerCase();
    if (deal.arbiter && by === deal.arbiter.toBase58()) return "arbiter";
    return `anyone (${shortAddr(by)})`;
  };

  return (
    <Card className="p-6" >
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <History className="h-4 w-4" /> On-chain activity
        </h2>
      </div>
      <p className="mb-4 text-xs text-slate-500">Every step is a confirmed Solana devnet transaction. Check them yourself.</p>
      <ul className="space-y-2" data-testid="activity-list">
        {items.length === 0 && <li className="text-sm text-slate-500">Loading transactions…</li>}
        {items.map((it) => (
          <li key={it.signature} className={clsx("rounded-xl border border-white/[0.06] bg-white/[0.02] p-3", it.failed && "opacity-60")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
                  {it.pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                  {it.label}
                  {it.failed && <span className="text-xs text-rose-300">(failed)</span>}
                </div>
                <div className="text-[11px] text-slate-500">
                  {who(it.by) && <>by {who(it.by)} · </>}
                  {it.pending ? "confirming…" : ago(it.time)}
                </div>
              </div>
            </div>
            <a
              href={explorerTx(it.signature)}
              target="_blank"
              rel="noreferrer"
              data-testid="explorer-tx-link"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-violet-300 hover:text-white"
            >
              View on Solana Explorer <ExternalLink className="h-3 w-3" />
              <span className="ml-1 font-mono text-slate-500">{it.signature.slice(0, 8)}…</span>
            </a>
          </li>
        ))}
      </ul>
      <a href={explorerAddress(deal.address)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
        <ExternalLink className="h-3 w-3" /> Deal account on Solana Explorer
      </a>
    </Card>
  );
}
