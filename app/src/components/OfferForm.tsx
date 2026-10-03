"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Gavel, Info, Lock, Scale, ShieldCheck, Timer, Wallet } from "lucide-react";
import { toBaseUnits, type LegalLabel, type Penalty } from "@kapora/sdk";
import type { PublicKey } from "@solana/web3.js";
import { useKapora } from "@/hooks/useKapora";
import { useTx } from "@/hooks/useTx";
import { useBalances } from "@/hooks/useTokenBalance";
import { useEmbedded } from "@/hooks/useEmbedded";
import { recordTx } from "@/hooks/useDealActivity";
import { Button, Callout, Card } from "./ui";
import { WalletButton } from "./WalletButton";
import { ListingArt } from "./ListingArt";
import { DEFAULT_ARBITER, DEMO_WINDOWS, REAL_WINDOWS, USDC_MINT, platformName } from "@/lib/config";
import { LEGAL_LABEL_INFO, PENALTY_INFO, TEMPLATES, type TemplateKey } from "@/lib/templates";
import { fmtDuration, fmtNumber, parsePubkey, shortAddr } from "@/lib/format";
import { fmtPrice, type Listing } from "@/data/listings";

export interface OfferFormProps {
  platform: PublicKey;
  listingId: string;
  listing?: Listing;
  amount: number;
  template: TemplateKey;
}

type WindowKey = "reserve" | "complete" | "grace" | "arbiter";

export function OfferForm({ platform, listingId, listing, amount, template }: OfferFormProps) {
  const router = useRouter();
  const embedded = useEmbedded();
  const { client, wallet, walletStr, connected } = useKapora();
  const { run, pending } = useTx();
  const balances = useBalances(wallet);
  const tpl = TEMPLATES[template];
  const payer = tpl.roles.payer;
  const payee = tpl.roles.payee;

  const initialAmount = amount > 0 ? String(amount) : "500";
  const [what, setWhat] = useState(listing?.title ?? "");
  const [deposit, setDeposit] = useState<string>(initialAmount);
  const [legal, setLegal] = useState<LegalLabel>(tpl.legalLabel);
  const [stakeInput, setStakeInput] = useState<string>(tpl.defaultStake === "equal" ? initialAmount : "0");
  const [demoMode, setDemoMode] = useState(true);
  const [win, setWin] = useState<Record<WindowKey, string>>({
    reserve: String(DEMO_WINDOWS.reserve),
    complete: String(DEMO_WINDOWS.complete),
    grace: String(DEMO_WINDOWS.grace),
    arbiter: String(DEMO_WINDOWS.arbiter),
  });
  const [useArbiter, setUseArbiter] = useState(false);
  const [arbiterInput, setArbiterInput] = useState<string>(DEFAULT_ARBITER?.toBase58() ?? "");

  // Legal label constrains the rule: zadatek = forfeit + stake == amount; zaliczka = refund.
  const penalty: Penalty = legal === "zaliczka" ? "refund" : tpl.penalty;
  const stakeLocked = legal === "zadatek";
  const depositNum = Number(deposit);
  const stakeNum = stakeLocked ? depositNum : Number(stakeInput);
  const windows = demoMode
    ? { reserve: Number(win.reserve), complete: Number(win.complete), grace: Number(win.grace), arbiter: Number(win.arbiter) }
    : REAL_WINDOWS;
  const arbiter = useArbiter ? parsePubkey(arbiterInput) : null;

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!(depositNum > 0)) e.push(`The ${tpl.amountLabel} must be greater than 0.`);
    if (!(stakeNum >= 0)) e.push("The stake must be 0 or more.");
    if (Object.values(windows).some((v) => !(v > 0) || !Number.isInteger(v))) e.push("All deadlines must be whole seconds greater than 0.");
    if (useArbiter && !arbiter) e.push("The arbiter must be a valid Solana account address (or switch the arbiter off).");
    if (useArbiter && arbiter && wallet && arbiter.equals(wallet)) e.push("You cannot be your own arbiter.");
    return e;
  }, [depositNum, stakeNum, windows, useArbiter, arbiter, wallet, tpl.amountLabel]);

  const usdc = balances.data?.usdc;
  const insufficient = connected && usdc !== undefined && stakeNum > usdc;
  const pName = platformName(platform);

  async function submit() {
    if (!client || errors.length) return;
    const result = await run(
      "Create offer",
      async () => {
        const res = await fetch("/api/hash", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "listing",
            data: {
              platform: platform.toBase58(),
              listingId,
              title: what.trim() || listing?.title || null,
              price: listing?.price ?? null,
              location: listing?.location ?? null,
              template,
              amountPln: depositNum,
              payee: walletStr,
              createdAt: new Date().toISOString(),
            },
          }),
        });
        if (!res.ok) throw new Error(`Hash service failed (${res.status})`);
        const { hashBytes } = (await res.json()) as { hashBytes: number[] };
        return client.createOffer({
          mint: USDC_MINT,
          payerAmount: toBaseUnits(depositNum),
          payeeStake: toBaseUnits(stakeNum),
          penalty,
          onComplete: tpl.onComplete,
          legalLabel: legal,
          template: tpl.id,
          listingHash: hashBytes,
          reserveWindowSecs: windows.reserve,
          completeWindowSecs: windows.complete,
          graceSecs: windows.grace,
          arbiterWindowSecs: windows.arbiter,
          arbiter,
          platform,
        });
      },
      { success: stakeNum > 0 ? "Offer created: your stake is locked" : "Offer created", signature: (r) => r.signature },
    );
    if (result) {
      const deal = result.deal.toBase58();
      recordTx(deal, "Offer created", result.signature, walletStr);
      if (embedded) window.parent?.postMessage({ type: "kapora:deal-created", deal }, "*");
      router.push(`/d/${deal}?created=1`);
    }
  }

  const legalOptions: LegalLabel[] = template === "deposit" ? ["zadatek", "zaliczka"] : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* What */}
        <Card className="flex items-center gap-4 p-4">
          {listing ? (
            <ListingArt listing={listing} className="h-20 w-28 shrink-0 rounded-xl" />
          ) : (
            <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-slate-500">
              <ShieldCheck className="h-7 w-7" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="label">
              {tpl.label}
              {listingId ? ` · ${pName ?? `platform ${shortAddr(platform)}`} · listing #${listingId}` : ""}
            </div>
            {listing ? (
              <>
                <div className="mt-1 truncate text-lg font-semibold text-white">{listing.title}</div>
                <div className="text-sm text-slate-400">
                  {listing.location} · {fmtPrice(listing.price)}
                  {listing.site === "rent" ? " / day" : ""}
                </div>
              </>
            ) : (
              <input
                className="input mt-2"
                placeholder={template === "freelance" ? "What is the job? e.g. Logo design, 3 concepts" : "What is this deal for? (stays off-chain)"}
                value={what}
                onChange={(e) => setWhat(e.target.value)}
                maxLength={120}
              />
            )}
          </div>
        </Card>

        {/* Amount */}
        <Card className="p-6">
          <SectionTitle icon={<Wallet className="h-4 w-4" />} title={`${payer}'s ${tpl.amountLabel}`} />
          <p className="mt-1 text-sm text-slate-500">The {payer.toLowerCase()} locks this amount when they accept your offer.</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="number"
                min={1}
                step="any"
                data-testid="deposit-input"
                className="input pr-24 text-lg font-semibold tabular-nums"
                value={deposit}
                onChange={(e) => {
                  if (!stakeLocked && tpl.defaultStake === "equal" && stakeInput === deposit) setStakeInput(e.target.value);
                  setDeposit(e.target.value);
                }}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">USDC</span>
            </div>
            <div className="text-sm text-slate-400">
              ≈ <b className="text-slate-200">{fmtNumber(depositNum || 0, 0)} PLN</b>
              <div className="text-[11px] text-slate-600">demo rate: 1 USDC ≈ 1 PLN</div>
            </div>
          </div>
        </Card>

        {/* Rule */}
        <Card className="p-6">
          <SectionTitle icon={<Scale className="h-4 w-4" />} title="Rule" />
          {legalOptions.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {legalOptions.map((l) => {
                const info = LEGAL_LABEL_INFO[l]!;
                const active = legal === l;
                return (
                  <button
                    key={l}
                    type="button"
                    data-testid={`rule-${l}`}
                    onClick={() => {
                      setLegal(l);
                      if (l === "zaliczka") setStakeInput(deposit);
                    }}
                    className={clsx(
                      "rounded-2xl border p-4 text-left transition",
                      active ? "border-brand-violet/60 bg-brand-violet/10 ring-4 ring-brand-violet/10" : "border-white/10 bg-white/[0.02] hover:border-white/20",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{info.name}</span>
                      {l === "zadatek" && <span className="rounded-full bg-brand-mint/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-mint">Default</span>}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{info.law}</div>
                    <div className="mt-2 text-sm text-slate-300">
                      {l === "zadatek" ? "Whoever backs out pays. If you back out, the buyer gets 2× back." : "Refundable advance: no penalty if the deal falls through."}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm">
              <div className="font-semibold text-white">{PENALTY_INFO[penalty].name}</div>
              <div className="mt-1 text-slate-400">{PENALTY_INFO[penalty].short}</div>
            </div>
          )}
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-400">
            {tpl.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>

          <div className="mt-5">
            <div className="label mb-2">Your stake ({payee.toLowerCase()} collateral)</div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="number"
                  min={0}
                  step="any"
                  data-testid="stake-input"
                  className="input pr-24 tabular-nums disabled:opacity-60"
                  value={stakeLocked ? deposit : stakeInput}
                  disabled={stakeLocked}
                  onChange={(e) => setStakeInput(e.target.value)}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">USDC</span>
              </div>
              {stakeLocked && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Lock className="h-3.5 w-3.5" /> = {tpl.amountLabel} (zadatek)
                </span>
              )}
            </div>
            {!stakeLocked && <p className="mt-2 text-xs text-slate-500">Optional. A stake shows you&apos;re serious: you lose it if you back out.</p>}
          </div>
        </Card>

        {/* Timing */}
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <SectionTitle icon={<Timer className="h-4 w-4" />} title="Deadlines" />
            <Toggle checked={demoMode} onChange={setDemoMode} label="Demo mode: deadlines in seconds" testId="demo-toggle" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                { k: "reserve", label: `${payer} must accept within` },
                { k: "complete", label: "Both confirm within" },
                { k: "grace", label: "Then objection period" },
                { k: "arbiter", label: "Arbiter decides within" },
              ] as { k: WindowKey; label: string }[]
            ).map((w) => (
              <div key={w.k} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[11px] leading-snug text-slate-500">{w.label}</div>
                {demoMode ? (
                  <div className="mt-1 flex items-baseline gap-1">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      data-testid={`window-${w.k}`}
                      className="w-full bg-transparent font-semibold tabular-nums text-white outline-none"
                      value={win[w.k]}
                      onChange={(e) => setWin((s) => ({ ...s, [w.k]: e.target.value }))}
                    />
                    <span className="text-xs text-slate-500">s</span>
                  </div>
                ) : (
                  <div className="mt-1 font-semibold tabular-nums text-white">{fmtDuration(REAL_WINDOWS[w.k])}</div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">After the objection period, anyone can apply the outcome. No one has to be trusted to release the money.</p>
        </Card>

        {/* Arbiter */}
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <SectionTitle icon={<Gavel className="h-4 w-4" />} title="Arbiter (optional)" />
            <Toggle checked={useArbiter} onChange={setUseArbiter} label="Add an arbiter" testId="arbiter-toggle" />
          </div>
          <p className="mt-3 text-sm text-slate-400">
            {tpl.arbiterRecommended
              ? `Adding an arbiter is recommended for ${tpl.label.toLowerCase()}: it's the only way to settle "${tpl.key === "rental" ? "the item came back damaged" : tpl.key === "freelance" ? "the work isn't what we agreed" : "the item isn't as described"}". It stays optional.`
              : "Optional. The deposit rule works without anyone in the middle."}{" "}
            An arbiter can only split the locked funds between the two sides, never take them, and must decide in time or everyone is refunded.
          </p>
          {useArbiter && (
            <div className="mt-4">
              <input className="input font-mono text-[13px]" placeholder="Arbiter account address" value={arbiterInput} onChange={(e) => setArbiterInput(e.target.value)} />
              {DEFAULT_ARBITER && arbiterInput === DEFAULT_ARBITER.toBase58() && <p className="mt-2 text-xs text-slate-500">Using the Kapora demo arbiter.</p>}
            </div>
          )}
        </Card>
      </div>

      {/* Summary */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card className="overflow-hidden">
          <div className="border-b border-white/[0.06] bg-gradient-to-br from-brand-violet/15 to-transparent p-5">
            <div className="label">Summary · {tpl.label}</div>
            <div className="mt-3 space-y-2.5 text-sm">
              <Row k="You lock now" v={`${fmtNumber(stakeNum || 0)} USDC`} strong />
              <Row k={`${payer} locks on accepting`} v={`${fmtNumber(depositNum || 0)} USDC`} />
              <Row k="Total held by the program" v={`${fmtNumber((stakeNum || 0) + (depositNum || 0))} USDC`} />
              <Row k="Rule" v={LEGAL_LABEL_INFO[legal]?.name ?? PENALTY_INFO[penalty].name} />
              <Row k="Arbiter" v={useArbiter ? "Yes" : "None"} />
            </div>
          </div>
          <div className="space-y-4 p-5">
            {connected && usdc !== undefined && (
              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-xs">
                <span className="text-slate-500">Your test USDC</span>
                <span className={clsx("font-semibold tabular-nums", insufficient ? "text-rose-300" : "text-slate-200")}>{fmtNumber(usdc)} USDC</span>
              </div>
            )}
            {insufficient && (
              <Callout tone="warn" title="Not enough test USDC">
                <Link href="/dev/faucet" target={embedded ? "_blank" : undefined} className="underline underline-offset-2">
                  Get 1,000 test USDC from the faucet →
                </Link>
              </Callout>
            )}
            {errors.length > 0 && (
              <ul className="space-y-1 text-xs text-rose-300">
                {errors.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            )}
            {connected ? (
              <Button size="lg" className="w-full" onClick={submit} loading={!!pending} disabled={!client || errors.length > 0} data-testid="create-offer-submit">
                <Lock className="h-4 w-4" /> {stakeNum > 0 ? "Lock stake & create offer" : "Create offer"}
              </Button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <WalletButton />
                <span className="text-xs text-slate-500">Connect the {payee.toLowerCase()}&apos;s account (devnet)</span>
              </div>
            )}
            <p className="flex gap-2 text-[11px] leading-relaxed text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Next you get a link to share with the {payer.toLowerCase()}. Details stay off-chain; only a salted SHA-256 fingerprint goes on-chain.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-slate-300">{icon}</span>
      <h3 className="font-semibold text-white">{title}</h3>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{k}</span>
      <span className={clsx("tabular-nums", strong ? "text-base font-semibold text-white" : "text-slate-200")}>{v}</span>
    </div>
  );
}

export function Toggle({ checked, onChange, label, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs font-medium text-slate-300">
      <span className="text-right">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={clsx("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-brand-mint/80" : "bg-white/10")}
      >
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </label>
  );
}
