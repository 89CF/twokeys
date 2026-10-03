"use client";

import { useMemo } from "react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { KaporaClient } from "@kapora/sdk";
import { PROGRAM_ID } from "@/lib/config";

/**
 * Returns a read-only Kapora client (always available) and a signing client (when a wallet is connected).
 */
export function useKapora() {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const { publicKey, connected } = useWallet();

  const readClient = useMemo(() => {
    try {
      return KaporaClient.readOnly(connection, PROGRAM_ID);
    } catch (e) {
      console.error("[kapora] failed to create read-only client", e);
      return null;
    }
  }, [connection]);

  const client = useMemo(() => {
    if (!anchorWallet) return null;
    try {
      const provider = new AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
      return new KaporaClient(provider, PROGRAM_ID);
    } catch (e) {
      console.error("[kapora] failed to create signing client", e);
      return null;
    }
  }, [connection, anchorWallet]);

  return {
    connection,
    client,
    readClient: client ?? readClient,
    wallet: publicKey ?? null,
    walletStr: publicKey?.toBase58() ?? null,
    connected,
  };
}
