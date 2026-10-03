"use client";

import clsx from "clsx";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  EyeOff,
  Gavel,
  Hash,
  Hourglass,
  Lock,
  LogOut,
  RefreshCw,
  SearchX,
  ShieldCheck,
  Snowflake,
  Undo2,
  Zap,
} from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import type { KaporaClient } from "@kapora/sdk";
import { useKapora } from "@/hooks/useKapora";
import { useDeal, useListingInfo } from "@/hooks/useDeal";
import { useChainNow } from "@/hooks/useChainNow";
import { useTx } from "@/hooks/useTx";
import { useBalances } from "@/hooks/useTokenBalance";
import { useEmbedded } from "@/hooks/useEmbedded";
import { recordTx } from "@/hooks/useDealActivity";
import { Address, Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { WalletButton } from "@/components/WalletButton";
import { Timeline } from "./Timeline";
import { Countdown } from "./Countdown";
import { ShareBox } from "./ShareBox";
import { OutcomeCard } from "./OutcomeCard";
import { ResolveForm } from "./ResolveForm";
import { ActivityCard } from "./ActivityCard";
import { DisputeDialog, WithdrawDialog } from "./Dialogs";
import { platformName } from "@/lib/config";
import { payout, type UiDeal, type UiOutcome } from "@/lib/model";
import { LEGAL_LABEL_INFO, PENALTY_INFO } from "@/lib/templates";
import { bytesToHex, fmtCountdown, fmtDuration, fmtNumber, fmtPln, fmtUsdc, isZeroBytes, shortAddr, toUi } from "@/lib/format";
import { headline, outcomeInfo, roleOf, ruleLines, statusLabel, type Role } from "@/lib/rules";

const PAYER_VERB: Record<string, string> = { deposit: "Reserve", rental: "Rent", freelance: "Hire", purchase: "Buy" };

export function DealView({ address, created }: { address: string; created: boolean }) {
  const dealKey = useMemo(() => {
    try {
      return new PublicKey(address);
    } catch {
      return null;
    }
  }, [address]);
  const { data, error, loading, refresh } = useDeal(dealKey);
  const embedded = useEmbedded();

  if (!dealKey) {
    return (
      <Shell>
        <EmptyState icon={<SearchX className="h-6 w-6" />} title="That's not a valid deal link">
          The address in the link is not a Solana account address. Check the link you received.
        </EmptyState>
      </Shell>
    );
  }
  if (loading && data === undefined) return <DealSkeleton />;
  if (data === undefined && error) {
    return (
      <Shell>
        <EmptyState
          icon={<CircleAlert className="h-6 w-6" />}
          title="Couldn't load this deal"
          action={
            <Button variant="secondary" onClick={() => void refresh()}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          }
        >
          {error.message}
        </EmptyState>
      </Shell>
    );
  }
  if (data === "incompatible") {
    return (
      <Shell>
        <EmptyState icon={<SearchX className="h-6 w-6" />} title="Deal not found (incompatible version)">
          This address holds a deal created by an older version of the Kapora program, which this app can no longer read.
          Create a new offer to try the current version.
        </EmptyState>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <EmptyState icon={<Hourglass className="h-6 w-6" />} title="Looking for this deal on Solana devnet…">
          No deal exists at <span className="font-mono text-slate-300">{shortAddr(address, 6)}</span> yet. If it was just
          created, it will appear in a few seconds. This page refreshes automatically.
        </EmptyState>
      </Shell>
    );
  }
  return <DealLoaded deal={data} refresh={refresh} created={created} embedded={embedded} stale={!!error} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">{children}</div>;
}

function DealSkeleton() {
  return (
    <Shell>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-3 h-10 w-96 max-w-full" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-96" />
      </div>
    </Shell>
  );
}

export function DealLoaded({ deal, refresh, created, embedded, stale }: { deal: UiDeal; refresh: () => Promise<void>; created: boolean; embedded: boolean; stale: boolean }) {
  const { client, walletStr, wallet, connected } = useKapora();
  const now = useChainNow();
  const { run, pending } = useTx();
  const balances = useBalances(wallet);
  const listing = useListingInfo(deal.listingHash);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const tpl = deal.tpl;
  const role = roleOf(deal, walletStr);
  const isParty = role === "payer" || role === "payee";
  const D = deal.payerAmount;
  const S = deal.payeeStake;
  const P = D.add(S);
  const hasArbiter = !!deal.arbiter;
  const pName = platformName(deal.platform);
  const legal = LEGAL_LABEL_INFO[deal.legalLabel];
  const title = listing?.data?.title ?? `${tpl.label}: ${fmtUsdc(D)}`;
  const usdc = balances.data?.usdc;
  const payerName = tpl.roles.payer;
  const payeeName = tpl.roles.payee;
  const dealStr = deal.address.toBase58();

  const tx = (label: string, fn: (c: KaporaClient) => Promise<string>, success?: string) => async () => {
    if (!client) return;
    const sig = await run(label, () => fn(client), { success });
    if (sig) {
      recordTx(dealStr, label, sig, walletStr);
      void refresh();
    }
    return sig;
  };

  // ---- availability (mirrors the on-chain state machine) ----
  const reserveOpen = deal.status === "offered" && now <= deal.reserveDeadline;
  const canReserve = reserveOpen && connected && role !== "payee" && role !== "arbiter";
  const inWindow = deal.status === "reserved" && now <= deal.claimableAt;
  const myConfirmed = role === "payer" ? deal.payerConfirmed : role === "payee" ? deal.payeeConfirmed : false;
  const canConfirm = inWindow && isParty && !myConfirmed;
  const canWithdraw = inWindow && isParty;
  const canDispute = inWindow && isParty && hasArbiter;
  const claimReady = deal.status === "reserved" && now > deal.claimableAt;
  const cancelReady = deal.status === "offered" && now > deal.reserveDeadline;
  const expireReady = deal.status === "disputed" && now > deal.disputeDeadline;

  const claimOutcome: UiOutcome =
    deal.payerConfirmed && !deal.payeeConfirmed ? "payeeNoShow" : deal.payeeConfirmed && !deal.payerConfirmed ? "payerNoShow" : "expired";
  const claimSplit = payout(deal, claimOutcome);
  const refundSplit = payout(deal, "expired");
  const rules = ruleLines(tpl, deal, role, hasArbiter);
  const freelanceClient = tpl.key === "freelance" && role === "payer";
  const confirmLabel = role === "payer" ? tpl.confirmLabels.payer : tpl.confirmLabels.payee;
  const roleLabel: Record<Role, string> = {
    payer: `You are the ${payerName.toLowerCase()}`,
    payee: `You are the ${payeeName.toLowerCase()}`,
    arbiter: "You are the arbiter",
    visitor: "You are viewing as a visitor",
  };

  const claimCard = deal.status === "reserved" && (
    <TriggerCard
      ready={claimReady}
      availableAt={deal.claimableAt}
      now={now}
      title={claimReady ? "Deadline passed: apply the outcome" : "After the deadline, anyone can apply the outcome"}
      result={
        claimSplit
          ? `${outcomeInfo(claimOutcome, tpl).title}: ${payerName.toLowerCase()} gets ${fmtUsdc(claimSplit.toPayer)}, ${payeeName.toLowerCase()} gets ${fmtUsdc(claimSplit.toPayee)}.`
          : ""
      }
      buttonLabel="Apply the outcome"
      testId="claim-btn"
      connected={connected}
      disabled={!client}
      loading={pending === "Apply the outcome"}
      onClick={tx("Apply the outcome", (c) => c.claimAfterDeadline(deal.address), "Outcome applied by the program")}
    />
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2" data-testid="deal-status" data-status={deal.status} data-outcome={deal.outcome}>
            <Badge
              tone={deal.status === "settled" ? (outcomeInfo(deal.outcome, tpl).tone === "good" ? "good" : "neutral") : deal.status === "disputed" ? "warn" : deal.status === "reserved" ? "good" : "info"}
              dot
            >
              {deal.status === "settled" ? outcomeInfo(deal.outcome, tpl).title : statusLabel(deal.status, tpl)}
            </Badge>
            <Badge tone="brand">{tpl.label}</Badge>
            {legal && <Badge>{legal.name}</Badge>}
            <Badge>{PENALTY_INFO[deal.penalty].name} rule</Badge>
            {pName && <Badge>via {pName}</Badge>}
            {stale && <Badge tone="warn">Reconnecting…</Badge>}
          </div>
          <h1 className="mt-3 truncate text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>Deal</span>
            <Address value={deal.address} chars={6} />
            {listing?.data?.location && <span>· {listing.data.location}</span>}
          </div>
        </div>
        <div
          data-testid="role-pill"
          data-role={connected ? role : "disconnected"}
          className={clsx(
            "inline-flex items-center gap-2 self-start rounded-full border px-3.5 py-1.5 text-sm font-medium md:self-auto",
            role === "visitor" ? "border-white/10 bg-white/[0.03] text-slate-300" : "border-brand-violet/40 bg-brand-violet/10 text-violet-100",
          )}
        >
          <span className={clsx("h-2 w-2 rounded-full", role === "visitor" ? "bg-slate-500" : "bg-brand-mint")} />
          {connected ? roleLabel[role] : "Connect an account to take part"}
        </div>
      </div>

      {/* Banners */}
      <div className="mb-6 space-y-4">
        {deal.status === "settled" && <OutcomeCard deal={deal} walletStr={walletStr} />}
        {deal.status === "offered" && role === "payee" && created && <ShareBox deal={dealStr} highlight amountLabel={fmtUsdc(D)} payerName={payerName.toLowerCase()} />}
        {deal.status === "reserved" && role === "payee" && (
          <Banner tone="good" icon={<ShieldCheck className="h-6 w-6" />} title={tpl.key === "rental" ? "Deposit secured" : "Payment secured"}>
            The {payerName.toLowerCase()} locked <b>{fmtUsdc(D)}</b> in the program. Nobody, not even Kapora, can move it except by the rules below.
            When you&apos;re done, press &ldquo;{tpl.confirmLabels.payee}&rdquo;.
          </Banner>
        )}
        {deal.status === "reserved" && role === "payer" && (
          <Banner tone="good" icon={<Lock className="h-6 w-6" />} title={`Your ${tpl.amountLabel} is locked in the program, not with the ${payeeName.toLowerCase()}`}>
            {headline(tpl, deal, role)}
          </Banner>
        )}
        {deal.status === "disputed" && (
          <Banner tone="warn" icon={<Snowflake className="h-6 w-6" />} title="Funds frozen: dispute in progress">
            The arbiter both sides agreed on has until the deadline to split the funds. If they stay silent, anyone can refund both sides.
          </Banner>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Amounts */}
          <Card className="grid divide-y divide-white/[0.06] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <MoneyTile label={`${payerName}'s ${tpl.amountLabel} (D)`} amount={D} sub={deal.payer ? `locked by the ${payerName.toLowerCase()}` : "locked on reservation"} />
            <MoneyTile label={`${payeeName}'s stake (S)`} amount={S} sub={S.isZero() ? "no stake" : `locked by the ${payeeName.toLowerCase()}`} />
            <MoneyTile
              label="In the program vault"
              amount={deal.status === "offered" ? S : deal.status === "settled" ? null : P}
              sub={deal.status === "settled" ? "paid out" : "held by code, not by a person"}
              highlight
            />
          </Card>
          <p className="-mt-3 text-right text-[11px] text-slate-600">Test USDC on Solana devnet · demo rate: 1 USDC ≈ 1 PLN</p>

          {/* Countdowns */}
          {deal.status !== "settled" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {deal.status === "offered" && <Countdown label="Reservation window" at={deal.reserveDeadline} now={now} />}
              {deal.status === "reserved" && (
                <>
                  <Countdown label="Confirm by" at={deal.completeDeadline} now={now} />
                  <Countdown
                    label="Objection period ends"
                    at={deal.claimableAt}
                    now={now}
                    hint={now > deal.claimableAt ? "Anyone can now apply the outcome" : `+${fmtDuration(deal.graceSecs)} to confirm or dispute`}
                  />
                </>
              )}
              {deal.status === "disputed" && <Countdown label="Arbiter must decide by" at={deal.disputeDeadline} now={now} />}
            </div>
          )}

          {claimReady && claimCard}

          {/* Actions */}
          {deal.status !== "settled" && (
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Actions</h2>
                {!connected && <WalletButton />}
              </div>

              {deal.status === "offered" && (
                <div className="space-y-4">
                  {role !== "payee" && (
                    <div className="rounded-2xl border border-brand-violet/25 bg-brand-violet/[0.06] p-5">
                      <div className="text-sm text-slate-400">
                        To {PAYER_VERB[tpl.key].toLowerCase()} as the {payerName.toLowerCase()}, you will lock
                      </div>
                      <div className="mt-1 text-3xl font-semibold tabular-nums text-white">{fmtUsdc(D)}</div>
                      <div className="text-xs text-slate-500">≈ {fmtPln(D)} · demo rate: 1 USDC ≈ 1 PLN</div>
                      <p className="mt-3 text-sm text-slate-300">{headline(tpl, deal, "payer")}</p>
                      {connected && usdc !== undefined && (
                        <div className={clsx("mt-3 text-xs", usdc < toUi(D) ? "text-rose-300" : "text-slate-400")}>
                          Your balance: {fmtNumber(usdc)} USDC
                          {usdc < toUi(D) && (
                            <>
                              {" "}·{" "}
                              <Link href="/dev/faucet" target={embedded ? "_blank" : undefined} className="underline underline-offset-2">
                                get test USDC
                              </Link>
                            </>
                          )}
                        </div>
                      )}
                      {connected ? (
                        <Button
                          size="lg"
                          className="mt-4 w-full"
                          disabled={!canReserve || !client}
                          data-testid="reserve-btn"
                          loading={pending === "Reserve"}
                          onClick={tx("Reserve", (c) => c.reserve(deal.address), `Locked: your ${tpl.amountLabel} is in the program`)}
                        >
                          <Lock className="h-4 w-4" /> {PAYER_VERB[tpl.key]} &amp; lock {fmtUsdc(D)}
                        </Button>
                      ) : (
                        <WalletButton className="mt-4 w-full justify-center" label={`Connect an account to ${PAYER_VERB[tpl.key].toLowerCase()}`} />
                      )}
                      {!reserveOpen && <p className="mt-2 text-center text-xs text-slate-500">The reservation window has closed.</p>}
                      {reserveOpen && role === "arbiter" && (
                        <p className="mt-2 text-center text-xs text-slate-500">You are this deal&apos;s arbiter, so you can&apos;t also be the {payerName.toLowerCase()}.</p>
                      )}
                    </div>
                  )}
                  {role === "payee" && !created && <ShareBox deal={dealStr} amountLabel={fmtUsdc(D)} payerName={payerName.toLowerCase()} />}
                  {role === "payee" && (
                    <ActionRow title="Cancel offer" desc={`Your ${fmtUsdc(S)} stake comes back. Allowed any time before someone reserves.`}>
                      <Button variant="secondary" data-testid="cancel-btn" disabled={!client} loading={pending === "Cancel offer"} onClick={tx("Cancel offer", (c) => c.cancelOffer(deal.address), "Offer cancelled, stake returned")}>
                        <Undo2 className="h-4 w-4" /> Cancel offer
                      </Button>
                    </ActionRow>
                  )}
                </div>
              )}

              {deal.status === "reserved" && (
                <div className="space-y-3">
                  {isParty && (
                    <>
                      <ActionRow
                        title={myConfirmed ? `You confirmed: "${confirmLabel}"` : confirmLabel}
                        desc={
                          myConfirmed
                            ? `Waiting for the ${role === "payer" ? payeeName.toLowerCase() : payerName.toLowerCase()}. If they don't respond before the deadline, anyone can apply the outcome.`
                            : `Confirm when this is true. When both sides confirm, the program pays out: ${
                                deal.onComplete === "toPayee" ? `${payeeName.toLowerCase()} receives ${fmtUsdc(P)}` : `${payerName.toLowerCase()} gets the ${fmtUsdc(D)} back`
                              }.`
                        }
                      >
                        {myConfirmed ? (
                          <Badge tone="good" className="confirmed-badge">
                            <CircleCheck className="h-3.5 w-3.5" /> Confirmed
                          </Badge>
                        ) : (
                          <Button variant="success" data-testid="confirm-btn" disabled={!canConfirm || !client} loading={pending === "Confirm"} onClick={tx("Confirm", (c) => c.confirm(deal.address), "Confirmation recorded on-chain")}>
                            <CircleCheck className="h-4 w-4" /> Confirm
                          </Button>
                        )}
                      </ActionRow>
                      {freelanceClient && hasArbiter && (
                        <ActionRow title="Not happy with the work?" desc="Open a dispute and the agreed arbiter decides. Backing out instead would hand the fee to the freelancer (Forfeit rule).">
                          <Button variant="warning" data-testid="dispute-btn" disabled={!canDispute || !client} onClick={() => setDisputeOpen(true)}>
                            <Gavel className="h-4 w-4" /> Open dispute
                          </Button>
                        </ActionRow>
                      )}
                      <ActionRow
                        title={freelanceClient ? "Back out (not recommended)" : "Back out"}
                        desc={
                          deal.penalty === "forfeit"
                            ? role === "payer"
                              ? `You lose your ${fmtUsdc(D)} ${tpl.amountLabel}: it goes to the ${payeeName.toLowerCase()}.`
                              : `The ${payerName.toLowerCase()} receives ${fmtUsdc(P)}${S.eq(D) ? " (2× back)" : ""}.`
                            : "Everyone gets their own money back."
                        }
                      >
                        <Button variant="danger" data-testid="withdraw-btn" disabled={!canWithdraw || !client} onClick={() => setWithdrawOpen(true)}>
                          <LogOut className="h-4 w-4" /> Back out
                        </Button>
                      </ActionRow>
                      {hasArbiter && !freelanceClient && (
                        <ActionRow title="Open a dispute" desc="Freezes the funds; the arbiter you both agreed on splits them. Evidence is hashed, never published.">
                          <Button variant="warning" data-testid="dispute-btn" disabled={!canDispute || !client} onClick={() => setDisputeOpen(true)}>
                            <Gavel className="h-4 w-4" /> Dispute
                          </Button>
                        </ActionRow>
                      )}
                    </>
                  )}
                  {!isParty && (
                    <p className="text-sm text-slate-400">
                      Only the {payerName.toLowerCase()} and the {payeeName.toLowerCase()} can confirm or back out. After the deadline, anyone, including you, can apply the outcome.
                    </p>
                  )}
                </div>
              )}

              {deal.status === "disputed" &&
                (role === "arbiter" ? (
                  <ResolveForm deal={deal} onDone={() => void refresh()} />
                ) : (
                  <p className="text-sm text-slate-400">
                    Waiting for the arbiter ({shortAddr(deal.arbiter)}). Evidence fingerprint:{" "}
                    <span className="font-mono text-slate-300">{bytesToHex(deal.evidenceHash).slice(0, 16)}…</span>
                  </p>
                ))}
            </Card>
          )}

          {!claimReady && claimCard}

          {deal.status === "offered" && (
            <TriggerCard
              ready={cancelReady}
              availableAt={deal.reserveDeadline}
              now={now}
              title={cancelReady ? "Nobody reserved in time: close the offer" : "If nobody reserves in time, anyone can close the offer"}
              result={`The ${payeeName.toLowerCase()}'s ${fmtUsdc(S)} stake goes back to them.`}
              buttonLabel="Close offer"
              testId="cancel-expired-btn"
              connected={connected}
              disabled={!client}
              loading={pending === "Close offer"}
              onClick={tx("Close offer", (c) => c.cancelOffer(deal.address), "Offer closed, stake returned")}
            />
          )}
          {deal.status === "disputed" && (
            <TriggerCard
              ready={expireReady}
              availableAt={deal.disputeDeadline}
              now={now}
              title={expireReady ? "The arbiter missed the deadline: refund both sides" : "If the arbiter stays silent, anyone can refund both sides"}
              result={refundSplit ? `${payerName} gets ${fmtUsdc(refundSplit.toPayer)}, ${payeeName.toLowerCase()} gets ${fmtUsdc(refundSplit.toPayee)}.` : ""}
              buttonLabel="Refund both sides"
              testId="expire-btn"
              connected={connected}
              disabled={!client}
              loading={pending === "Refund both sides"}
              onClick={tx("Refund both sides", (c) => c.expireDispute(deal.address), "Dispute expired, everyone refunded")}
            />
          )}

          {/* Rules */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white">What happens if…</h2>
            <p className="mt-1 text-sm text-slate-500">
              {tpl.label}
              {legal ? ` · ${legal.name} (${legal.law})` : ""} · {PENALTY_INFO[deal.penalty].name} rule. Written into the offer; nobody can change it afterwards.
            </p>
            <p className="mt-4 rounded-xl bg-brand-violet/[0.08] p-3.5 text-sm font-medium text-violet-100">{headline(tpl, deal, role === "visitor" || role === "arbiter" ? "payer" : role)}</p>
            <ul className="mt-4 space-y-2.5">
              {rules.map((r) => (
                <li key={r.when} className="flex gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3.5">
                  <span
                    className={clsx(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      r.tone === "good" ? "bg-emerald-400" : r.tone === "bad" ? "bg-rose-400" : r.tone === "warn" ? "bg-amber-400" : "bg-slate-500",
                    )}
                  />
                  <div className="text-sm">
                    <span className="font-medium text-slate-200">{r.when}:</span> <span className="text-slate-400">{r.then}</span>
                  </div>
                </li>
              ))}
            </ul>
            {tpl.key !== "deposit" && (
              <div className="mt-5">
                <div className="label mb-2">How {tpl.label.toLowerCase()} works (for the {payerName.toLowerCase()})</div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-400">
                  {tpl.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-400">Timeline</h2>
            <Timeline deal={deal} />
          </Card>

          <ActivityCard deal={deal} walletStr={walletStr} />

          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Parties</h2>
            <dl className="space-y-3 text-sm">
              <Party label={payeeName} pk={deal.payee} you={role === "payee"} />
              <Party label={payerName} pk={deal.payer} you={role === "payer"} empty={`Waiting for a ${payerName.toLowerCase()}`} />
              <Party label="Arbiter" pk={deal.arbiter} you={role === "arbiter"} empty="None (optional)" />
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              <EyeOff className="h-4 w-4" /> Privacy
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-slate-500">No names, phone numbers or listing text on-chain. Only salted fingerprints.</p>
            <HashRow label="Listing hash" bytes={deal.listingHash} />
            {!isZeroBytes(deal.evidenceHash) && <HashRow label="Evidence hash" bytes={deal.evidenceHash} />}
          </Card>
        </div>
      </div>

      {isParty && (
        <>
          <WithdrawDialog
            open={withdrawOpen}
            onClose={() => setWithdrawOpen(false)}
            deal={deal}
            role={role}
            loading={pending === "Back out"}
            onConfirm={async () => {
              const sig = await tx("Back out", (c) => c.withdraw(deal.address), "Settled: you backed out")();
              if (sig) setWithdrawOpen(false);
            }}
          />
          <DisputeDialog
            open={disputeOpen}
            onClose={() => setDisputeOpen(false)}
            deal={deal}
            uploader={walletStr}
            loading={pending === "Open dispute"}
            onSubmit={async (hashBytes) => {
              const sig = await tx("Open dispute", (c) => c.openDispute(deal.address, hashBytes), "Dispute opened: funds frozen")();
              if (sig) setDisputeOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}

/**
 * Permissionless trigger (claim_after_deadline / cancel after reserve deadline / expire_dispute): visible to everyone.
 * This is the moment the intermediary disappears: nobody has to be trusted to move the money.
 */
function TriggerCard(p: {
  ready: boolean;
  availableAt: number;
  now: number;
  title: string;
  result: string;
  buttonLabel: string;
  testId: string;
  connected: boolean;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div
      data-testid={`${p.testId}-card`}
      data-ready={p.ready ? "true" : "false"}
      className={clsx(
        "rounded-3xl border p-5 sm:p-6",
        p.ready
          ? "border-brand-mint/40 bg-gradient-to-br from-brand-mint/[0.12] via-brand-violet/[0.10] to-transparent shadow-glow"
          : "border-dashed border-white/10 bg-white/[0.015]",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span
            className={clsx(
              "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              p.ready ? "bg-brand-gradient text-white" : "bg-white/[0.05] text-slate-400",
            )}
          >
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <div className={clsx("font-semibold", p.ready ? "text-lg text-white" : "text-slate-200")}>{p.title}</div>
            <p className="mt-0.5 text-sm text-slate-400">
              <b className="text-slate-200">No intermediary needed:</b> anyone can trigger the payout the rules prescribe. {p.result}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-center">
          {!p.ready ? (
            <Button variant="secondary" disabled data-testid={p.testId}>
              <Hourglass className="h-4 w-4" /> Available in {fmtCountdown(p.availableAt - p.now)}
            </Button>
          ) : p.connected ? (
            <Button size="lg" data-testid={p.testId} disabled={p.disabled} loading={p.loading} onClick={p.onClick}>
              <Zap className="h-4 w-4" /> {p.buttonLabel}
            </Button>
          ) : (
            <WalletButton label="Connect an account to trigger" />
          )}
        </div>
      </div>
    </div>
  );
}

function Banner({ tone, icon, title, children }: { tone: "good" | "warn"; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        "flex animate-fade-up items-start gap-4 rounded-3xl border p-5 sm:p-6",
        tone === "good" ? "border-emerald-400/30 bg-gradient-to-r from-emerald-400/[0.14] to-brand-mint/[0.03]" : "border-amber-400/30 bg-gradient-to-r from-amber-400/[0.12] to-transparent",
      )}
    >
      <span className={clsx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", tone === "good" ? "bg-emerald-400/20 text-emerald-200" : "bg-amber-400/20 text-amber-200")}>{icon}</span>
      <div>
        <div className="text-xl font-semibold text-white">{title}</div>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">{children}</p>
      </div>
    </div>
  );
}

function MoneyTile({ label, amount, sub, highlight }: { label: string; amount: UiDeal["payerAmount"] | null; sub: string; highlight?: boolean }) {
  return (
    <div className="p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={clsx("mt-2 text-2xl font-semibold tabular-nums tracking-tight", highlight ? "text-gradient" : "text-white")}>{amount ? fmtUsdc(amount) : "0 USDC"}</div>
      <div className="mt-0.5 text-xs text-slate-500">
        {amount ? `≈ ${fmtPln(amount)} · ` : ""}
        {sub}
      </div>
    </div>
  );
}

function ActionRow({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="font-medium text-white">{title}</div>
        <div className="text-sm text-slate-400">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Party({ label, pk, you, empty }: { label: string; pk: PublicKey | null; you: boolean; empty?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">
        {label}
        {you && <span className="ml-1.5 rounded bg-brand-violet/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-200">you</span>}
      </dt>
      <dd>{pk ? <Address value={pk} href={`/profile/${pk.toBase58()}`} /> : <span className="text-xs text-slate-600">{empty}</span>}</dd>
    </div>
  );
}

function HashRow({ label, bytes }: { label: string; bytes: number[] }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <Hash className="h-3 w-3" /> {label}
      </div>
      <div className="break-all rounded-lg bg-ink-900 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-slate-400">{bytesToHex(bytes)}</div>
    </div>
  );
}
