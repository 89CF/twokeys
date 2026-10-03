"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";

// Offset (seconds) between the cluster clock and the local clock, measured once per session.
let offsetSecs = 0;
let measured: Promise<void> | null = null;

function measure(connection: ReturnType<typeof useConnection>["connection"]) {
  if (measured) return measured;
  measured = (async () => {
    try {
      const slot = await connection.getSlot("confirmed");
      const blockTime = await connection.getBlockTime(slot);
      if (blockTime) {
        const diff = blockTime - Date.now() / 1000;
        // Ignore absurd values (e.g. stale RPC); clamp to +/- 10 minutes.
        if (Math.abs(diff) < 600) offsetSecs = diff;
      }
    } catch {
      /* local clock is good enough */
    }
  })();
  return measured;
}

/** Current unix time in seconds, aligned with the Solana cluster clock, ticking every second. */
export function useChainNow(): number {
  const { connection } = useConnection();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000 + offsetSecs));

  useEffect(() => {
    void measure(connection);
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000 + offsetSecs)), 1000);
    return () => clearInterval(id);
  }, [connection]);

  return now;
}
