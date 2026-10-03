"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Gavel, Hash, Scale } from "lucide-react";
import { listUiDeals, type UiDeal } from "@/lib/model";
import { useKapora } from "@/hooks/useKapora";
import { usePolling } from "@/hooks/usePolling";
import { useChainNow } from "@/hooks/useChainNow";
import { Address, Badge, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { WalletButton } from "@/components/WalletButton";
import { ResolveForm } from "@/components/deal/ResolveForm";
import { DEFAULT_ARBITER } from "@/lib/config";
import { bytesToHex, fmtCountdown, fmtUsdc, shortAddr } from "@/lib/format";

interface EvidenceItem {
  hash: string;
  uploader: string | null;
  data: { statement?: string | null; file?: { name: string; size: number; sha256: string } | null } | null;
  createdAt: string;
}

export default function ArbiterPage() {
  const { readClient, walletStr, connected } = useKapora();
  const q = usePolling<UiDeal[]>(readClient ? () => listUiDeals(readClient, { status: "disputed" }) : null, 5000, `disputes:${readClient ? 1 : 0}`);
  const deals = q.data ?? [];
  const mine = walletStr ? deals.filter((d) => d.arbiter?.toBase58() === walletStr) : [];


  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="Dispute resolution"
        title="Arbiter desk"
        right={!connected ? <WalletButton /> : undefined}
      >
        Arbiters are <b className="text-slate-200">optional</b>: most deals never have one, and the main deposit flow runs without
        anyone in the middle. If both sides agreed on an arbiter in the offer, it can only <i>split</i> the locked funds between
        them, never take them, and must decide before the deadline; otherwise anyone can refund both sides.
        {DEFAULT_ARBITER && (
          <span className="mt-2 block text-sm">
            Demo arbiter wallet: <span className="font-mono text-slate-300">{shortAddr(DEFAULT_ARBITER, 6)}</span>
          </span>
        )}
      </PageHeader>

      {connected && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <Badge tone={mine.length ? "brand" : "neutral"}>{mine.length} assigned to you</Badge>
          <Badge>{deals.length} open disputes total</Badge>
        </div>
      )}

      {q.loading && !q.data ? (
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : q.error && !q.data ? (
        <EmptyState icon={<Scale className="h-6 w-6" />} title="Couldn't load disputes">
          {q.error.message}
        </EmptyState>
      ) : deals.length === 0 ? (
        <EmptyState icon={<Gavel className="h-6 w-6" />} title="No open disputes">
          When a buyer or seller opens a dispute on a deal with an arbiter, it appears here. Most deals never need one.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {deals.map((d) => (
            <DisputeCard
              key={d.address.toBase58()}
              deal={d}
              onDone={() => void q.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DisputeCard({ deal, onDone }: { deal: UiDeal; onDone: () => void }) {
  const now = useChainNow();
  const left = deal.disputeDeadline - now;
  const [evidence, setEvidence] = useState<EvidenceItem[] | null>(null);
  const key = deal.address.toBase58();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/records?deal=${key}`)
      .then((r) => (r.ok ? r.json() : { evidence: [] }))
      .then((j: { evidence: EvidenceItem[] }) => !cancelled && setEvidence(j.evidence ?? []))
      .catch(() => !cancelled && setEvidence([]));
    return () => {
      cancelled = true;
    };
  }, [key]);

  const onChainHash = bytesToHex(deal.evidenceHash);
  const matching = evidence?.filter((e) => e.hash === onChainHash) ?? [];
  const other = evidence?.filter((e) => e.hash !== onChainHash) ?? [];

  return (
    <Card className="grid gap-0 overflow-hidden lg:grid-cols-[1fr_380px]">
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="warn" dot>
            Disputed
          </Badge>
          <Badge tone="brand">{deal.tpl.label}</Badge>
          <Badge tone={left > 0 ? "info" : "bad"}>{left > 0 ? `Decide within ${fmtCountdown(left)}` : "Deadline passed"}</Badge>
        </div>
        <Link href={`/d/${key}`} className="mt-3 block font-mono text-lg text-white hover:underline">
          Deal {shortAddr(deal.address, 6)}
        </Link>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Info label={`${deal.tpl.roles.payer}'s ${deal.tpl.amountLabel}`} value={fmtUsdc(deal.payerAmount)} />
          <Info label={`${deal.tpl.roles.payee}'s stake`} value={fmtUsdc(deal.payeeStake)} />
          <Info label="In vault" value={fmtUsdc(deal.payerAmount.add(deal.payeeStake))} />
          <Info
            label="Confirmations"
            value={`${deal.tpl.roles.payer} ${deal.payerConfirmed ? "✓" : "–"} · ${deal.tpl.roles.payee} ${deal.payeeConfirmed ? "✓" : "–"}`}
          />
        </dl>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
          <span>
            {deal.tpl.roles.payee} <Address value={deal.payee} href={`/profile/${deal.payee.toBase58()}`} />
          </span>
          {deal.payer && (
            <span>
              {deal.tpl.roles.payer} <Address value={deal.payer} href={`/profile/${deal.payer.toBase58()}`} />
            </span>
          )}
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <Hash className="h-3 w-3" /> On-chain evidence hash
          </div>
          <div className="break-all rounded-lg bg-ink-900 px-3 py-2 font-mono text-[11px] text-slate-400">{onChainHash}</div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Off-chain evidence</div>
          {evidence === null ? (
            <Skeleton className="h-16" />
          ) : evidence.length === 0 ? (
            <p className="text-sm text-slate-500">No off-chain evidence record found on this server (it may have been deleted).</p>
          ) : (
            [...matching, ...other].map((e) => (
              <div key={e.hash} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-300">from {e.uploader ? shortAddr(e.uploader) : "unknown"}</span>
                  {e.hash === onChainHash ? <Badge tone="good">hash matches chain</Badge> : <Badge>superseded</Badge>}
                </div>
                {e.data?.statement && <p className="text-slate-400">&ldquo;{e.data.statement}&rdquo;</p>}
                {e.data?.file && (
                  <p className="mt-1 text-xs text-slate-500">
                    Attachment: {e.data.file.name} ({(e.data.file.size / 1024).toFixed(1)} KB) · sha256 {e.data.file.sha256.slice(0, 16)}…
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <div className="border-t border-white/[0.06] bg-white/[0.015] p-6 lg:border-l lg:border-t-0">
        <div className="mb-4 flex items-center gap-2 font-semibold text-white">
          <Gavel className="h-4 w-4" /> Decision
        </div>
        <ResolveForm deal={deal} onDone={onDone} />
        <p className="mt-3 text-center text-[11px] text-slate-500">Arbiter: {shortAddr(deal.arbiter)}</p>
      </div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-white">{value}</dd>
    </div>
  );
}
