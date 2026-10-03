"use client";

import BN from "bn.js";
import type { PlatformStats } from "@kapora/sdk";
import { useKapora } from "@/hooks/useKapora";
import { usePolling } from "@/hooks/usePolling";
import { PLATFORMS } from "@/lib/config";
import { fmtNumber, toUi } from "@/lib/format";

/** Live totals across the demo platforms, read straight from on-chain PlatformStats accounts. */
export function LiveStats() {
  const { readClient } = useKapora();
  const q = usePolling<(PlatformStats | null)[]>(
    readClient ? () => Promise.all(PLATFORMS.map((p) => readClient.getPlatformStats(p.pubkey).catch(() => null))) : null,
    15000,
    `landing-stats:${readClient ? 1 : 0}`,
  );
  const sum = (k: keyof PlatformStats) =>
    (q.data ?? []).reduce((acc, s) => {
      const v = s?.[k];
      return v instanceof BN ? acc.add(v) : acc;
    }, new BN(0));

  const items = [
    { label: "Offers created", value: fmtNumber(Number(sum("offers").toString())) },
    { label: "Deals completed", value: fmtNumber(Number(sum("completed").toString())) },
    { label: "Volume completed", value: `${fmtNumber(toUi(sum("volumeCompleted")), 0)} USDC` },
    { label: "Personal data on-chain", value: "0 bytes" },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] md:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="bg-ink-800 p-5">
          <div className="text-2xl font-semibold tabular-nums tracking-tight text-white sm:text-3xl">
            {q.loading && !q.data && i.label !== "Personal data on-chain" ? <span className="skeleton inline-block h-8 w-20" /> : i.value}
          </div>
          <div className="mt-1 text-xs text-slate-500">{i.label}</div>
        </div>
      ))}
    </div>
  );
}
