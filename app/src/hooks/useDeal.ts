"use client";

import { useEffect, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useKapora } from "./useKapora";
import { isDecodeError, toUiDeal, type UiDeal } from "@/lib/model";
import { usePolling } from "./usePolling";
import { bytesToHex, isZeroBytes } from "@/lib/format";

/**
 * Polls a deal account every 3 seconds. `null` = the account does not exist (yet);
 * "incompatible" = an account exists but can't be decoded (e.g. created by an older program version).
 */
export function useDeal(address: PublicKey | null) {
  const { readClient } = useKapora();
  const fn =
    address && readClient
      ? async (): Promise<UiDeal | null | "incompatible"> => {
          try {
            const d = await readClient.getDeal(address);
            return d ? toUiDeal(d) : null;
          } catch (e) {
            if (isDecodeError(e)) return "incompatible";
            throw e;
          }
        }
      : null;
  return usePolling<UiDeal | null | "incompatible">(fn, 3000, `deal:${address?.toBase58() ?? "none"}:${readClient ? 1 : 0}`);
}

export interface ListingInfo {
  listingId: string | null;
  platform: string | null;
  data: { title?: string | null; location?: string | null; price?: number | null; template?: string } | null;
}

/** Looks up the off-chain listing record that matches the deal's salted listing hash. */
export function useListingInfo(listingHash: number[] | undefined) {
  const [info, setInfo] = useState<ListingInfo | null>(null);
  const hex = listingHash && !isZeroBytes(listingHash) ? bytesToHex(listingHash) : null;
  useEffect(() => {
    if (!hex) return;
    let cancelled = false;
    fetch(`/api/records?listingHash=${hex}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { listing: ListingInfo | null } | null) => {
        if (!cancelled) setInfo(j?.listing ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [hex]);
  return info;
}
