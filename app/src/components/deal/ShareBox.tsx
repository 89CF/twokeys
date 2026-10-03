"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link2, MessageCircle, Send, Zap } from "lucide-react";
import { CopyButton } from "@/components/ui";

/** "Share this link with the buyer" box with copy + WhatsApp. */
export function ShareBox({ deal, highlight, amountLabel, payerName = "buyer" }: { deal: string; highlight?: boolean; amountLabel: string; payerName?: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/d/${deal}`;
  // Solana Action (Blink): any Blink-aware client (dial.to, wallets, X) renders a one-click "Lock deposit" card.
  const actionUrl = `${origin}/api/actions/reserve/${deal}`;
  const blinkUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}&cluster=devnet`;
  const isLocal = /localhost|127\.0\.0\.1/.test(origin);
  const text = `Hi! Here is our deal on TwoKeys. You lock ${amountLabel} in a Solana program, not with me, and the agreed rules pay out automatically, even if one of us disappears: ${url}`;

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-2xl border p-5",
        highlight ? "border-brand-mint/40 bg-gradient-to-br from-brand-mint/[0.12] via-brand-violet/[0.08] to-transparent shadow-glow" : "border-white/[0.08] bg-white/[0.03]",
      )}
    >
      <div className="flex items-center gap-2 text-white">
        <Send className="h-4 w-4 text-brand-mint" />
        <h3 className={clsx("font-semibold", highlight && "text-lg")}>Share this link with the {payerName}</h3>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        The {payerName} opens it, connects an account and locks the amount. This page updates the moment they do.
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-ink-900 p-1.5 pl-3">
        <Link2 className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-slate-200">{url}</span>
        <CopyButton value={url} label="Copy" className="shrink-0 bg-white/[0.06] !px-3 !py-1.5 text-slate-200" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-[#06301a] transition hover:brightness-110"
        >
          <MessageCircle className="h-4 w-4" /> Share on WhatsApp
        </a>
        <a
          href={`sms:?&body=${encodeURIComponent(text)}`}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.08]"
        >
          SMS
        </a>
        <a
          href={blinkUrl}
          target="_blank"
          rel="noreferrer"
          title={isLocal ? "Blinks need a public HTTPS URL. Deploy the app to try this." : "Open as a Solana Blink"}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-brand-violet/40 bg-brand-violet/10 px-4 text-sm font-semibold text-violet-100 hover:bg-brand-violet/20"
        >
          <Zap className="h-4 w-4" /> Share as Blink
        </a>
        <CopyButton value={actionUrl} label="Action URL" className="h-9 border border-white/10 !px-3" />
      </div>
      {isLocal && <p className="mt-2 text-[11px] text-slate-500">Blinks need a public HTTPS deployment; on localhost the link won&apos;t resolve.</p>}
    </div>
  );
}
