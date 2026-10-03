"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { USDC_MINT } from "@/lib/config";
import { usePolling } from "./usePolling";

/** Test-USDC and SOL balance of a wallet (UI units). Polls every 8s. */
export function useBalances(owner: PublicKey | null) {
  const { connection } = useConnection();
  const fn = owner
    ? async () => {
        const ata = getAssociatedTokenAddressSync(USDC_MINT, owner, true);
        const [lamports, token] = await Promise.all([
          connection.getBalance(owner).catch(() => 0),
          connection
            .getTokenAccountBalance(ata)
            .then((r) => r.value.uiAmount ?? 0)
            .catch(() => 0),
        ]);
        return { sol: lamports / 1e9, usdc: token };
      }
    : null;
  return usePolling(fn, 8000, `bal:${owner?.toBase58() ?? "none"}`);
}
