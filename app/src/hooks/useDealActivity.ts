"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BorshInstructionCoder } from "@coral-xyz/anchor";
import type { PartiallyDecodedInstruction, ParsedInstruction, PublicKey } from "@solana/web3.js";
import { IDL } from "@kapora/sdk";
import { useKapora } from "./useKapora";

/** Every transaction touching a deal, read from the chain, plus the user's own just-sent transactions. */
export interface ActivityItem {
  signature: string;
  label: string;
  /** fee payer / signer of the transaction */
  by: string | null;
  time: number | null;
  failed: boolean;
  /** sent from this browser but not yet visible in the RPC history */
  pending: boolean;
}

const LABELS: Record<string, string> = {
  create_offer: "Offer created",
  cancel_offer: "Offer cancelled",
  reserve: "Reserved (amount locked)",
  confirm_complete: "Confirmed",
  withdraw: "Backed out (withdraw)",
  claim_after_deadline: "Outcome applied after deadline",
  open_dispute: "Dispute opened",
  resolve: "Arbiter decision",
  expire_dispute: "Dispute expired, refunds paid",
};
const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

const cache = new Map<string, ActivityItem>();
const localKey = (deal: string) => `kapora:tx:${deal}`;

/** Remember a transaction sent from this browser so it is listed immediately (and survives reloads). */
export function recordTx(deal: string, label: string, signature: string, by: string | null) {
  try {
    const list = JSON.parse(window.localStorage.getItem(localKey(deal)) ?? "[]") as { label: string; signature: string; by: string | null; at: number }[];
    if (!list.some((x) => x.signature === signature)) list.unshift({ label, signature, by, at: Math.floor(Date.now() / 1000) });
    window.localStorage.setItem(localKey(deal), JSON.stringify(list.slice(0, 30)));
    window.dispatchEvent(new CustomEvent("kapora:tx", { detail: { deal } }));
  } catch {
    /* storage unavailable */
  }
}

function readLocal(deal: string): ActivityItem[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(localKey(deal)) ?? "[]") as { label: string; signature: string; by: string | null; at: number }[];
    return list.map((x) => ({ signature: x.signature, label: x.label, by: x.by, time: x.at, failed: false, pending: true }));
  } catch {
    return [];
  }
}

export function useDealActivity(deal: PublicKey | null) {
  const { connection, readClient } = useKapora();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const busy = useRef(false);
  const key = deal?.toBase58() ?? null;

  const refresh = useCallback(async () => {
    if (!deal || !key || !readClient || busy.current) return;
    busy.current = true;
    try {
      // raw (snake_case) IDL from the SDK; the Program object holds a converted copy
      const coder = new BorshInstructionCoder(IDL);
      const sigs = await connection.getSignaturesForAddress(deal, { limit: 30 }, "confirmed");
      for (const s of sigs.slice(0, 30)) {
        if (cache.has(s.signature)) continue;
        const tx = await connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }).catch(() => null);
        if (!tx) continue; // rate-limited or not yet indexed: retry on the next poll instead of caching a placeholder
        let label = "Transaction";
        for (const ix of tx?.transaction.message.instructions ?? []) {
          const pd = ix as PartiallyDecodedInstruction | ParsedInstruction;
          if (!("data" in pd) || !pd.programId.equals(readClient.programId)) continue;
          try {
            const decoded = coder.decode(pd.data, "base58");
            if (decoded) label = LABELS[snake(decoded.name)] ?? decoded.name;
          } catch {
            /* unknown instruction */
          }
        }
        const by = tx?.transaction.message.accountKeys.find((k) => k.signer)?.pubkey.toBase58() ?? null;
        cache.set(s.signature, { signature: s.signature, label, by, time: s.blockTime ?? null, failed: !!s.err, pending: false });
      }
      const onChain = sigs.map(
        (s) => cache.get(s.signature) ?? { signature: s.signature, label: "Transaction", by: null, time: s.blockTime ?? null, failed: !!s.err, pending: false },
      );
      const seen = new Set(onChain.map((x) => x.signature));
      setItems([...readLocal(key).filter((x) => !seen.has(x.signature)), ...onChain]);
    } catch {
      setItems((prev) => (prev.length ? prev : readLocal(key)));
    } finally {
      busy.current = false;
    }
  }, [connection, deal, key, readClient]);

  useEffect(() => {
    if (!key) return;
    setItems(readLocal(key));
    void refresh();
    const id = setInterval(() => void refresh(), 6000);
    const onTx = (e: Event) => {
      if ((e as CustomEvent).detail?.deal === key) {
        setItems((prev) => {
          const local = readLocal(key).filter((x) => !prev.some((p) => p.signature === x.signature));
          return [...local, ...prev];
        });
        setTimeout(() => void refresh(), 2500);
      }
    };
    window.addEventListener("kapora:tx", onTx);
    return () => {
      clearInterval(id);
      window.removeEventListener("kapora:tx", onTx);
    };
  }, [key, refresh]);

  return { items, refresh };
}
