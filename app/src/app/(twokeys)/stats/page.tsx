"use client";

import { Check, Database, EyeOff, Link2, X } from "lucide-react";
import type { PlatformStats } from "@twokeys/sdk";
import { useTwoKeys } from "@/hooks/useTwoKeys";
import { usePolling } from "@/hooks/usePolling";
import { Address, Card, PageHeader, Skeleton } from "@/components/ui";
import { PLATFORMS } from "@/lib/config";
import { fmtNumber, fmtUsdc } from "@/lib/format";

const n = (b: PlatformStats[keyof PlatformStats] | undefined) => (b && typeof b === "object" && "toNumber" in b ? Number(b.toString()) : 0);

export default function StatsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Anonymous aggregates" title="Platform stats">
        Every marketplace that embeds TwoKeys gets a public, on-chain scoreboard of how deals end. Counters only: no
        wallets, no names, no listings. Like privacy-friendly web analytics, but for trust.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        {PLATFORMS.map((p) => (
          <PlatformCard key={p.key} name={p.name} vertical={p.vertical} platform={p.pubkey} />
        ))}
      </div>

      <PrivacyTable />
    </div>
  );
}

function PlatformCard({ name, vertical, platform }: { name: string; vertical: string; platform: (typeof PLATFORMS)[number]["pubkey"] }) {
  const { readClient } = useTwoKeys();
  const fn = readClient ? () => readClient.getPlatformStats(platform) : null;
  const { data, error, loading } = usePolling(fn, 10000, `stats:${platform.toBase58()}:${readClient ? 1 : 0}`);

  const offers = n(data?.offers);
  const reserved = n(data?.reserved);
  const completed = n(data?.completed);
  const settledBreakdown = [
    { label: "Completed", value: completed },
    { label: "Payer backed out", value: n(data?.payerWithdrew) },
    { label: "Payee backed out", value: n(data?.payeeWithdrew) },
    { label: "No-show", value: n(data?.noShow) },
    { label: "Expired", value: n(data?.expired) },
    { label: "Cancelled", value: n(data?.cancelled) },
    { label: "Disputed", value: n(data?.disputed) },
    { label: "Resolved by arbiter", value: n(data?.resolved) },
  ];
  const max = Math.max(1, ...settledBreakdown.map((s) => s.value));
  const completionRate = reserved ? Math.round((completed / reserved) * 100) : null;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="label">{vertical}</div>
          <h2 className="mt-1 text-xl font-semibold text-white">{name}</h2>
        </div>
        <Address value={platform} />
      </div>

      {loading && !data ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-40" />
        </div>
      ) : error && !data ? (
        <div className="mt-6 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200">Couldn&apos;t load stats: {error.message}</div>
      ) : (
        <>
          {!data && (
            <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-slate-400">
              No deals yet on this platform. The stats account is created with the first offer.
            </div>
          )}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Offers" value={fmtNumber(offers)} />
            <Tile label="Reserved" value={fmtNumber(reserved)} />
            <Tile label="Completed" value={fmtNumber(completed)} />
            <Tile label="Completion" value={completionRate === null ? "—" : `${completionRate}%`} />
          </div>
          <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Volume completed</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{fmtUsdc(data?.volumeCompleted ?? 0)}</div>
          </div>

          <div className="mt-6">
            <div className="mb-3 text-sm font-medium text-slate-300">How deals ended</div>
            <ul className="space-y-2.5" role="table" aria-label={`${name} outcomes`}>
              {settledBreakdown.map((s) => (
                <li key={s.label} role="row" className="group grid grid-cols-[130px_1fr_36px] items-center gap-3 text-sm" title={`${s.label}: ${s.value}`}>
                  <span role="cell" className="truncate text-slate-400">{s.label}</span>
                  <span role="cell" className="h-2.5 overflow-hidden rounded-full bg-white/[0.04]">
                    <span
                      className="block h-full rounded-full bg-brand-violet transition-all duration-700 group-hover:bg-violet-400"
                      style={{ width: `${(s.value / max) * 100}%`, minWidth: s.value ? 6 : 0 }}
                    />
                  </span>
                  <span role="cell" className="text-right font-mono tabular-nums text-slate-200">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Card>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

const ROWS: [string, string][] = [
  ["Deposit and stake (test USDC, held in a program vault)", "Name, e-mail, phone, ID documents"],
  ["Account addresses, amounts, deadlines, rule, template, status", "Listing details, photos, documents"],
  ["Salted SHA-256 hashes of the listing and dispute evidence", "The salts (delete them and the hash points to nothing)"],
  ["Behaviour counters per account (completed, backed out, no-show, disputes lost)", "Which account belongs to which person"],
  ["Anonymous per-platform aggregate counters (this page)", "Platform user accounts and chats (each platform's own data)"],
];

function PrivacyTable() {
  return (
    <section className="mt-16">
      <div className="mb-6 max-w-2xl">
        <div className="label mb-2 text-brand-mint/80">Privacy by design · GDPR-friendly</div>
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">What is on-chain vs off-chain</h2>
        <p className="mt-3 text-[15px] text-slate-400">
          The blockchain records <i>behaviour</i>, never <i>identity</i>. Personal data lives off-chain where it can be deleted.
        </p>
      </div>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 border-b border-white/[0.06] bg-white/[0.02] text-sm font-semibold">
          <div className="flex items-center gap-2 p-4 text-white">
            <Link2 className="h-4 w-4 text-brand-mint" /> On-chain (Solana, public, permanent)
          </div>
          <div className="flex items-center gap-2 border-l border-white/[0.06] p-4 text-white">
            <Database className="h-4 w-4 text-violet-300" /> Off-chain (deletable)
          </div>
        </div>
        {ROWS.map(([on, off]) => (
          <div key={on} className="grid grid-cols-2 border-b border-white/[0.04] text-sm last:border-0">
            <div className="flex gap-2.5 p-4 text-slate-300">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-mint" /> {on}
            </div>
            <div className="flex gap-2.5 border-l border-white/[0.06] p-4 text-slate-300">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" /> {off}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 border-t border-white/[0.06] bg-rose-400/[0.04] p-4 text-sm text-rose-200">
          <X className="h-4 w-4 shrink-0" /> Never written on-chain: names, e-mails, phone numbers, addresses, licence plates, listing text, free text.
        </div>
      </Card>
    </section>
  );
}
