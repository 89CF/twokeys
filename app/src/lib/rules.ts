import type BN from "bn.js";
import { payout, type UiDeal, type UiOutcome, type UiStatus } from "./model";
import type { OnComplete, Penalty, TemplatePreset } from "./templates";
import { fmtUsdc } from "./format";

export type Role = "payer" | "payee" | "arbiter" | "visitor";
export type Tone = "good" | "warn" | "bad" | "neutral";

export function roleOf(deal: UiDeal, wallet: string | null | undefined): Role {
  if (!wallet) return "visitor";
  if (deal.payee.toBase58() === wallet) return "payee";
  if (deal.payer && deal.payer.toBase58() === wallet) return "payer";
  if (deal.arbiter && deal.arbiter.toBase58() === wallet) return "arbiter";
  return "visitor";
}

/** "Buyer"/"Seller", "Renter"/"Owner", … for a role in this template. */
export function roleName(t: TemplatePreset, role: "payer" | "payee"): string {
  return t.roles[role];
}

export function statusLabel(status: UiStatus, t: TemplatePreset): string {
  switch (status) {
    case "offered":
      return `Waiting for the ${t.roles.payer.toLowerCase()}`;
    case "reserved":
      return "Funds locked";
    case "disputed":
      return "In dispute";
    default:
      return "Settled";
  }
}

export function outcomeInfo(outcome: UiOutcome, t: TemplatePreset): { title: string; desc: string; tone: Tone } {
  const payer = t.roles.payer;
  const payee = t.roles.payee;
  switch (outcome) {
    case "completed":
      return {
        title: "Deal completed",
        desc:
          t.onComplete === "toPayer"
            ? `Both confirmed. The ${t.key === "rental" ? "security deposit" : "amount"} went back to the ${payer.toLowerCase()}.`
            : `Both confirmed. The money went to the ${payee.toLowerCase()}.`,
        tone: "good",
      };
    case "payerWithdrew":
      return { title: `${payer} backed out`, desc: "Funds were split by the agreed rule.", tone: "warn" };
    case "payeeWithdrew":
      return { title: `${payee} backed out`, desc: "Funds were split by the agreed rule.", tone: "warn" };
    case "payerNoShow":
      return { title: `${payer} didn't confirm in time`, desc: `Only the ${payee.toLowerCase()} confirmed before the deadline, so the rule was applied automatically.`, tone: "warn" };
    case "payeeNoShow":
      return { title: `${payee} didn't confirm in time`, desc: `Only the ${payer.toLowerCase()} confirmed before the deadline, so the rule was applied automatically.`, tone: "warn" };
    case "expired":
      return { title: "Expired: nobody confirmed", desc: "Neither side confirmed in time. Everyone got their own money back.", tone: "neutral" };
    case "cancelled":
      return { title: "Offer cancelled", desc: `Nobody reserved the offer. The ${payee.toLowerCase()}'s stake was returned.`, tone: "neutral" };
    case "resolved":
      return { title: "Resolved by arbiter", desc: "The arbiter both sides agreed on split the funds. They could not take any for themselves.", tone: "neutral" };
    case "disputeTimeout":
      return { title: "Dispute timed out", desc: "The arbiter didn't decide in time, so everyone got their own money back.", tone: "neutral" };
    default:
      return { title: "In progress", desc: "", tone: "neutral" };
  }
}

export interface RuleLine {
  when: string;
  then: string;
  tone: Tone;
}

/**
 * Plain-language consequences for every way the deal can end, derived from the payout table and phrased for the
 * viewer ("you" when the viewer is that party).
 */
export function ruleLines(
  t: TemplatePreset,
  terms: { penalty: Penalty; onComplete: OnComplete; payerAmount: BN; payeeStake: BN },
  role: Role,
  hasArbiter: boolean,
): RuleLine[] {
  const pay = (o: UiOutcome) => payout(terms, o)!;
  const isPayer = role === "payer";
  const isPayee = role === "payee";
  const P_ = isPayer ? "you" : `the ${t.roles.payer.toLowerCase()}`;
  const E_ = isPayee ? "you" : `the ${t.roles.payee.toLowerCase()}`;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const P = terms.payerAmount.add(terms.payeeStake);
  const double = terms.payeeStake.eq(terms.payerAmount) && terms.payeeStake.gtn(0);
  const lines: RuleLine[] = [];

  const done = pay("completed");
  lines.push({
    when: `Both confirm${t.key === "deposit" ? " the handover" : ""}`,
    then:
      terms.onComplete === "toPayee"
        ? `${cap(E_)} receive${isPayee ? "" : "s"} ${fmtUsdc(done.toPayee)}${t.key === "deposit" ? " (the deposit counts toward the price)" : ""}.`
        : `${cap(P_)} get${isPayer ? "" : "s"} the ${fmtUsdc(done.toPayer)} back${terms.payeeStake.gtn(0) ? `; ${E_} get${isPayee ? "" : "s"} the stake back` : ""}.`,
    tone: "good",
  });

  if (terms.penalty === "forfeit") {
    const payeeOut = pay("payeeWithdrew");
    const payerOut = pay("payerWithdrew");
    lines.push({
      when: `${cap(E_)} back${isPayee ? "" : "s"} out or ${isPayee ? "don't" : "doesn't"} confirm in time`,
      then: `${cap(P_)} get${isPayer ? "" : "s"} ${fmtUsdc(payeeOut.toPayer)}${double ? " (2× back)" : ""}.`,
      tone: isPayee ? "bad" : "good",
    });
    lines.push({
      when: `${cap(P_)} back${isPayer ? "" : "s"} out or ${isPayer ? "don't" : "doesn't"} confirm in time`,
      then: `${cap(E_)} receive${isPayee ? "" : "s"} ${fmtUsdc(payerOut.toPayee)}${isPayer ? `: you lose the ${fmtUsdc(terms.payerAmount)} you locked` : ""}.`,
      tone: isPayer ? "bad" : "neutral",
    });
  } else {
    lines.push({ when: "Either side backs out or doesn't confirm in time", then: "Everyone gets their own money back. No penalty.", tone: "neutral" });
  }
  lines.push({ when: "Nobody confirms before the deadline", then: `Everyone gets their own money back (${fmtUsdc(P)} returned in total).`, tone: "neutral" });
  lines.push(
    hasArbiter
      ? {
          when: "You disagree about what happened",
          then: "Either side can open a dispute before the deadline; the agreed arbiter splits the funds but can never take them. If the arbiter stays silent, everyone is refunded.",
          tone: "neutral",
        }
      : {
          when: "There is no arbiter",
          then: "The deadlines and the rule above are the only mechanism. Nobody can freeze, redirect or keep the money.",
          tone: "neutral",
        },
  );
  return lines;
}

/** One-sentence headline of the protection for the viewer, per template (brief §4.1 behaviour). */
export function headline(t: TemplatePreset, terms: { penalty: Penalty; payerAmount: BN; payeeStake: BN }, role: Role): string {
  const double = terms.penalty === "forfeit" && terms.payeeStake.eq(terms.payerAmount) && terms.payeeStake.gtn(0);
  switch (t.key) {
    case "deposit":
      return role === "payee"
        ? "If the buyer backs out or doesn't show up, you keep the deposit."
        : double
          ? "If the seller backs out or doesn't show up, you get 2× back."
          : "If the deal falls through, the rule below decides who gets what.";
    case "rental":
      return role === "payee"
        ? "If the item comes back fine, confirm and the deposit returns to the renter. If it is damaged or kept, open a dispute: the arbiter can award you the deposit."
        : "Return the item and confirm. If the owner doesn't object in time, your deposit comes back automatically.";
    case "freelance":
      return role === "payer"
        ? "The fee is paid out when the freelancer delivers and you don't object in time. Object with a dispute, not by backing out."
        : "Deliver and confirm. If the client doesn't object in time, the fee is paid to you automatically.";
    case "purchase":
      return role === "payer"
        ? "Confirm when you receive the item. If the seller never confirms sending it, your money comes back."
        : "Hand over or send the item and confirm. If the buyer doesn't object in time, the price is paid to you.";
  }
}
