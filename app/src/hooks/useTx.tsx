"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { explorerTx } from "@/lib/format";
import { friendlyError } from "@/lib/errors";

function ExplorerLink({ sig }: { sig: string }) {
  return (
    <a href={explorerTx(sig)} target="_blank" rel="noreferrer" className="underline underline-offset-2 opacity-90 hover:opacity-100">
      View on Solana Explorer ↗
    </a>
  );
}

/**
 * Wraps an async transaction with loading / success / error toasts (with Explorer links).
 * `pending` holds the label of the running action so buttons can show spinners.
 */
export function useTx() {
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(label: string, fn: () => Promise<T>, opts: { success?: string; signature?: (r: T) => string | undefined } = {}) => {
      setPending(label);
      const id = toast.loading(`${label}…`, { description: "Approve it in your wallet app if asked (demo accounts sign automatically)." });
      try {
        const result = await fn();
        const sig = opts.signature ? opts.signature(result) : typeof result === "string" ? result : undefined;
        toast.success(opts.success ?? `${label}: done`, {
          id,
          description: sig ? <ExplorerLink sig={sig} /> : undefined,
          duration: 7000,
        });
        return result;
      } catch (e) {
        console.error(`[twokeys] ${label} failed`, e);
        toast.error(`${label} failed`, { id, description: friendlyError(e), duration: 9000 });
        return undefined;
      } finally {
        setPending(null);
      }
    },
    [],
  );

  return { run, pending };
}
