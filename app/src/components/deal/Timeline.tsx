"use client";

import clsx from "clsx";
import { Check, CircleDot, Flag, Gavel, Handshake, Lock, X } from "lucide-react";
import type { UiDeal } from "@/lib/model";
import { fmtDateTime } from "@/lib/format";
import { outcomeInfo } from "@/lib/rules";

type StepState = "done" | "current" | "upcoming" | "failed";
interface Step {
  key: string;
  title: string;
  desc: string;
  state: StepState;
  icon: React.ReactNode;
  extra?: React.ReactNode;
}

function ConfirmPill({ who, label, ok }: { who: string; label: string; ok: boolean }) {
  return (
    <span
      title={label}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.03] text-slate-400",
      )}
    >
      {ok ? <Check className="h-3 w-3" /> : <CircleDot className="h-3 w-3" />}
      {who} {ok ? "confirmed" : "pending"}
    </span>
  );
}

function buildSteps(deal: UiDeal): Step[] {
  const { status, outcome, tpl } = deal;
  const settled = status === "settled";
  const disputeBranch = status === "disputed" || outcome === "resolved" || outcome === "disputeTimeout";
  const withdrawn = outcome === "payerWithdrew" || outcome === "payeeWithdrew";
  const payer = tpl.roles.payer;
  const payee = tpl.roles.payee;

  const steps: Step[] = [
    {
      key: "offered",
      title: "Offer created",
      desc: `${deal.payeeStake.isZero() ? `${payee} made the offer` : `${payee} locked their stake`} · ${fmtDateTime(deal.createdAt)}`,
      state: "done",
      icon: <Lock className="h-4 w-4" />,
    },
  ];
  if (outcome === "cancelled") {
    steps.push({ key: "cancelled", title: "Cancelled", desc: outcomeInfo("cancelled", tpl).desc, state: "failed", icon: <X className="h-4 w-4" /> });
    return steps;
  }
  steps.push({
    key: "reserved",
    title: "Reserved",
    desc: deal.reservedAt ? `${payer} locked the ${tpl.amountLabel} · ${fmtDateTime(deal.reservedAt)}` : `Waiting for the ${payer.toLowerCase()} to lock the ${tpl.amountLabel}`,
    state: status === "offered" ? "current" : "done",
    icon: <Lock className="h-4 w-4" />,
  });
  if (disputeBranch) {
    steps.push({
      key: "dispute",
      title: "Dispute",
      desc: status === "disputed" ? "The agreed arbiter is reviewing the evidence" : "The dispute was closed",
      state: status === "disputed" ? "current" : "done",
      icon: <Gavel className="h-4 w-4" />,
    });
  } else {
    steps.push({
      key: "confirm",
      title: withdrawn ? "Backed out" : "Confirmations",
      desc: withdrawn
        ? outcomeInfo(outcome, tpl).title
        : status === "reserved"
          ? "Both sides confirm; or the deadline decides"
          : status === "offered"
            ? "Both sides confirm when done"
            : "Confirmation window closed",
      state: status === "reserved" ? "current" : settled ? (outcome === "completed" ? "done" : "failed") : "upcoming",
      icon: <Handshake className="h-4 w-4" />,
      extra:
        status !== "offered" && !withdrawn ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <ConfirmPill who={payer} label={tpl.confirmLabels.payer} ok={deal.payerConfirmed} />
            <ConfirmPill who={payee} label={tpl.confirmLabels.payee} ok={deal.payeeConfirmed} />
          </div>
        ) : undefined,
    });
  }
  steps.push({
    key: "settled",
    title: settled ? outcomeInfo(outcome, tpl).title : "Settled",
    desc: settled ? "Paid out automatically by the program" : "The program pays out by the rules",
    state: settled ? "done" : "upcoming",
    icon: <Flag className="h-4 w-4" />,
  });
  return steps;
}

export function Timeline({ deal }: { deal: UiDeal }) {
  const steps = buildSteps(deal);
  return (
    <ol className="relative">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={clsx("absolute left-[17px] top-9 h-[calc(100%-28px)] w-px", s.state === "done" ? "bg-gradient-to-b from-brand-mint/60 to-brand-mint/20" : "bg-white/10")}
            />
          )}
          <span
            className={clsx(
              "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
              s.state === "done" && "border-brand-mint/40 bg-brand-mint/15 text-brand-mint",
              s.state === "current" && "animate-pulse-ring border-brand-violet/60 bg-brand-violet/20 text-violet-200",
              s.state === "upcoming" && "border-white/10 bg-white/[0.03] text-slate-500",
              s.state === "failed" && "border-amber-400/40 bg-amber-400/10 text-amber-300",
            )}
          >
            {s.state === "done" && s.key !== "settled" ? <Check className="h-4 w-4" /> : s.icon}
          </span>
          <div className="min-w-0 pt-1">
            <div className={clsx("font-semibold", s.state === "upcoming" ? "text-slate-500" : "text-white")}>{s.title}</div>
            <div className="text-sm text-slate-400">{s.desc}</div>
            {s.extra}
          </div>
        </li>
      ))}
    </ol>
  );
}
