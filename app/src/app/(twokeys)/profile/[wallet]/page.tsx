"use client";

import clsx from "clsx";
import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { CircleCheck, EyeOff, Fingerprint, Gavel, LogOut, SearchX, UserX } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import type { Profile } from "@twokeys/sdk";
import { listUiDeals, type UiDeal } from "@/lib/model";
import { useTwoKeys } from "@/hooks/useTwoKeys";
import { usePolling } from "@/hooks/usePolling";
import { Address, Badge, Card, EmptyState, Skeleton } from "@/components/ui";
import { fmtUsdc, shortAddr } from "@/lib/format";
import { outcomeInfo, statusLabel } from "@/lib/rules";

function trust(p: Profile | null | undefined) {
  const completed = p?.completed ?? 0;
  const bad = (p?.withdrew ?? 0) + (p?.noShow ?? 0) + 2 * (p?.disputesLost ?? 0);
  const total = completed + bad;
  if (total === 0) return { label: "New: no history yet", tone: "neutral" as const, score: null as number | null };
  const score = Math.round((completed / total) * 100);
  if (score >= 80 && completed >= 1) return { label: "Reliable", tone: "good" as const, score };
  if (score >= 50) return { label: "Mixed record", tone: "warn" as const, score };
  return { label: "Risky", tone: "bad" as const, score };
}

export default function ProfilePage() {
  const params = useParams<{ wallet: string }>();
  const walletStr = params?.wallet ?? "";
  const wallet = useMemo(() => {
    try {
      return new PublicKey(walletStr);
    } catch {
      return null;
    }
  }, [walletStr]);
  const { readClient, walletStr: me } = useTwoKeys();

  const profileQ = usePolling<Profile | null>(wallet && readClient ? () => readClient.getProfile(wallet) : null, 6000, `profile:${walletStr}:${readClient ? 1 : 0}`);
  const dealsQ = usePolling<UiDeal[]>(
    wallet && readClient
      ? async () => {
          const [s, b] = await Promise.all([listUiDeals(readClient, { payee: wallet }), listUiDeals(readClient, { payer: wallet })]);
          const seen = new Set<string>();
          return [...s, ...b]
            .filter((d) => (seen.has(d.address.toBase58()) ? false : (seen.add(d.address.toBase58()), true)))
            .sort((a, b2) => b2.createdAt - a.createdAt);
        }
      : null,
    15000,
    `deals:${walletStr}:${readClient ? 1 : 0}`,
  );

  if (!wallet) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <EmptyState icon={<SearchX className="h-6 w-6" />} title="Invalid wallet address" />
      </div>
    );
  }

  const p = profileQ.data;
  const t = trust(p);
  const counters = [
    { label: "Completed", value: p?.completed ?? 0, icon: <CircleCheck className="h-4 w-4" />, tone: "text-emerald-300" },
    { label: "Withdrew", value: p?.withdrew ?? 0, icon: <LogOut className="h-4 w-4" />, tone: "text-amber-300" },
    { label: "No-show", value: p?.noShow ?? 0, icon: <UserX className="h-4 w-4" />, tone: "text-amber-300" },
    { label: "Disputes lost", value: p?.disputesLost ?? 0, icon: <Gavel className="h-4 w-4" />, tone: "text-rose-300" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10"
            style={{ background: `linear-gradient(135deg, hsl(${hue(walletStr)} 70% 45% / .5), hsl(${(hue(walletStr) + 80) % 360} 70% 45% / .3))` }}
          >
            <Fingerprint className="h-8 w-8 text-white/90" />
          </div>
          <div>
            <div className="label">Behaviour profile {me === walletStr && "· you"}</div>
            <h1 className="mt-1 font-mono text-2xl font-semibold text-white">{shortAddr(walletStr, 6)}</h1>
            <Address value={walletStr} chars={8} className="mt-1 text-slate-500" />
          </div>
        </div>
        <TrustMeter label={t.label} tone={t.tone} score={t.score} />
      </div>

      {profileQ.loading && p === undefined ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : profileQ.error && p === undefined ? (
        <Card className="p-6 text-sm text-rose-200">Couldn&apos;t load profile: {profileQ.error.message}</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {counters.map((c) => (
              <Card key={c.label} className="p-5">
                <div className={clsx("flex items-center gap-2 text-sm", c.tone)}>
                  {c.icon} <span className="text-slate-400">{c.label}</span>
                </div>
                <div className="mt-3 text-4xl font-semibold tabular-nums text-white">{c.value}</div>
              </Card>
            ))}
          </div>
          <Card className="mt-4 flex items-center justify-between p-5">
            <span className="text-sm text-slate-400">Volume completed</span>
            <span className="text-xl font-semibold tabular-nums text-white">{fmtUsdc(p?.volumeCompleted ?? 0)}</span>
          </Card>
        </>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-sm text-slate-400">
        <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-brand-mint" />
        <p>
          <b className="text-slate-200">No identity stored on-chain.</b> This track record is just counters attached to an account address,
          written by the contract when deals settle. TwoKeys never records names, phone numbers or documents on-chain. It
          shows how someone <i>behaves</i>, not who they <i>are</i>.
        </p>
      </div>

      <h2 className="mb-4 mt-12 text-lg font-semibold text-white">Deals</h2>
      {dealsQ.loading && !dealsQ.data ? (
        <Skeleton className="h-24" />
      ) : dealsQ.error && !dealsQ.data ? (
        <p className="text-sm text-slate-500">Deal history unavailable ({dealsQ.error.message}).</p>
      ) : !dealsQ.data?.length ? (
        <p className="text-sm text-slate-500">No deals found for this wallet.</p>
      ) : (
        <div className="space-y-2">
          {dealsQ.data.slice(0, 20).map((d) => (
            <Link key={d.address.toBase58()} href={`/d/${d.address.toBase58()}`} className="panel panel-hover flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="font-mono text-sm text-slate-200">{shortAddr(d.address, 6)}</div>
                <div className="text-xs text-slate-500">
                  {d.tpl.label} · as {(d.payee.toBase58() === walletStr ? d.tpl.roles.payee : d.tpl.roles.payer).toLowerCase()} · {new Date(d.createdAt * 1000).toLocaleDateString("en-GB")}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm tabular-nums text-slate-300">{fmtUsdc(d.payerAmount)}</span>
                <Badge tone={d.status === "settled" ? outcomeInfo(d.outcome, d.tpl).tone : "info"}>
                  {d.status === "settled" ? outcomeInfo(d.outcome, d.tpl).title : statusLabel(d.status, d.tpl)}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function hue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function TrustMeter({ label, tone, score }: { label: string; tone: "good" | "warn" | "bad" | "neutral"; score: number | null }) {
  const color = tone === "good" ? "bg-emerald-400" : tone === "warn" ? "bg-amber-400" : tone === "bad" ? "bg-rose-400" : "bg-slate-500";
  return (
    <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:w-64">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">Trust signal</span>
        <span className="font-semibold text-white">{label}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={clsx("h-full rounded-full transition-all duration-700", color)} style={{ width: `${score ?? 0}%` }} />
      </div>
      <div className="mt-1.5 text-[11px] text-slate-500">
        {score === null ? "Completes a deal to build a track record" : `${score}% of finished deals completed as agreed`}
      </div>
    </div>
  );
}
