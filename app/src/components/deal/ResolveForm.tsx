"use client";

import { useState } from "react";
import { Gavel } from "lucide-react";
import type { Fault } from "@kapora/sdk";
import { useKapora } from "@/hooks/useKapora";
import { useTx } from "@/hooks/useTx";
import { recordTx } from "@/hooks/useDealActivity";
import { Button } from "@/components/ui";
import { payout, type UiDeal } from "@/lib/model";
import { fmtUsdc } from "@/lib/format";

/** Arbiter decision: payer share (bps) + who was at fault. Enabled only for the deal's arbiter. */
export function ResolveForm({ deal, onDone }: { deal: UiDeal; onDone?: () => void }) {
  const { client, walletStr } = useKapora();
  const { run, pending } = useTx();
  const [pct, setPct] = useState(50);
  const [fault, setFault] = useState<Fault>("none");
  const { payer, payee } = deal.tpl.roles;

  const isArbiter = !!walletStr && !!deal.arbiter && deal.arbiter.toBase58() === walletStr;
  const bps = Math.round(pct * 100);
  const split = payout(deal, "resolved", bps);

  async function resolve() {
    if (!client) return;
    const sig = await run("Resolve dispute", () => client.resolve(deal.address, bps, fault), { success: "Dispute resolved, funds paid out" });
    if (sig) {
      recordTx(deal.address.toBase58(), "Arbiter decision", sig, walletStr);
      onDone?.();
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-400">{payer}&apos;s share</span>
          <span className="font-mono font-semibold tabular-nums text-white">
            {pct}% <span className="text-slate-500">· {bps} bps</span>
          </span>
        </div>
        <input type="range" min={0} max={100} step={1} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="range w-full" />
        <div className="mt-1 flex justify-between text-[11px] text-slate-500">
          <span>All to {payee.toLowerCase()}</span>
          <span>All to {payer.toLowerCase()}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">{payer} receives</div>
          <div className="mt-1 font-semibold tabular-nums text-white">{split ? fmtUsdc(split.toPayer) : "—"}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">{payee} receives</div>
          <div className="mt-1 font-semibold tabular-nums text-white">{split ? fmtUsdc(split.toPayee) : "—"}</div>
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm text-slate-400">Who was at fault? (adds &ldquo;dispute lost&rdquo; to their track record)</div>
        <div className="grid grid-cols-3 gap-2">
          {(["none", "payer", "payee"] as Fault[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFault(f)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                fault === f ? "border-brand-violet/60 bg-brand-violet/15 text-white" : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-white"
              }`}
            >
              {f === "none" ? "Nobody" : f === "payer" ? payer : payee}
            </button>
          ))}
        </div>
      </div>
      <Button className="w-full" size="lg" onClick={resolve} loading={pending !== null} disabled={!isArbiter || !client}>
        <Gavel className="h-4 w-4" /> Resolve &amp; pay out
      </Button>
      <p className="text-center text-xs text-slate-500">
        {isArbiter ? "You can only split the locked funds between the two sides." : "Only the arbiter both sides agreed on can decide."}
      </p>
    </div>
  );
}
