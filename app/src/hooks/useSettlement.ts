"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import BN from "bn.js";
import type { UiDeal } from "@/lib/model";

export interface Settlement {
  signature: string;
  /** actual token deltas observed in the settlement transaction (base units), when derivable */
  toPayer: BN | null;
  toPayee: BN | null;
}

/**
 * Best-effort: finds the latest transaction touching a settled deal and derives the token amounts
 * paid to payer and payee from pre/post token balances. Used to show arbiter splits and a tx link.
 */
export function useSettlement(deal: UiDeal | null | undefined): Settlement | null {
  const { connection } = useConnection();
  const [result, setResult] = useState<Settlement | null>(null);
  const key = deal && deal.status === "settled" ? deal.address.toBase58() : null;

  useEffect(() => {
    if (!key || !deal) return;
    let cancelled = false;
    (async () => {
      // The settling tx may not be indexed yet (or the RPC may rate-limit): retry a few times.
      for (let attempt = 0; attempt < 6 && !cancelled; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 3000));
        if (await tryOnce()) return;
      }
    })();
    async function tryOnce(): Promise<boolean> {
      if (!deal) return false;
      try {
        const sigs = await connection.getSignaturesForAddress(deal.address, { limit: 5 }, "confirmed");
        const latest = sigs.find((s) => !s.err);
        if (!latest) return false;
        const tx = await connection.getParsedTransaction(latest.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
        if (!tx) return false;
        const mint = deal.mint.toBase58();
        const delta = (owner: string | undefined) => {
          if (!owner || !tx?.meta) return null;
          const pick = (arr: typeof tx.meta.postTokenBalances) =>
            (arr ?? []).filter((b) => b.mint === mint && b.owner === owner).reduce((acc, b) => acc.add(new BN(b.uiTokenAmount.amount)), new BN(0));
          const d = pick(tx.meta.postTokenBalances).sub(pick(tx.meta.preTokenBalances));
          return d.isNeg() ? new BN(0) : d;
        };
        if (!cancelled)
          setResult({
            signature: latest.signature,
            toPayer: delta(deal.payer?.toBase58()),
            toPayee: delta(deal.payee.toBase58()),
          });
        return true;
      } catch {
        return false; /* optional info */
      }
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, connection]);

  return result;
}
