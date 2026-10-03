import type BN from "bn.js";
import type { PublicKey } from "@solana/web3.js";
import { previewPayout, templateFromId, type Deal, type DealStatus, type TwoKeysClient, type OnComplete, type Outcome, type Payout, type Penalty, type TemplatePreset } from "@twokeys/sdk";

/** A deal plus its resolved template preset (role names, confirm labels, …). */
export type UiDeal = Deal & { tpl: TemplatePreset };
export type UiOutcome = Outcome;
export type UiStatus = DealStatus;

export function toUiDeal(d: Deal): UiDeal {
  return { ...d, tpl: templateFromId(d.template) };
}

export async function listUiDeals(client: TwoKeysClient, filter: { payee?: PublicKey; payer?: PublicKey; status?: DealStatus; platform?: PublicKey }) {
  return (await client.listDeals(filter)).map(toUiDeal);
}

/** Safe wrapper around the SDK payout table (which throws for outcome "none"). */
export function payout(
  terms: { penalty: Penalty; onComplete: OnComplete; payerAmount: BN; payeeStake: BN },
  outcome: Outcome,
  payerBps = 0,
): Payout | null {
  try {
    return previewPayout(terms.penalty, terms.onComplete, outcome, terms.payerAmount, terms.payeeStake, payerBps);
  } catch {
    return null;
  }
}

/** Account-decoding errors (e.g. deals created by an older program layout) should read as "not found / incompatible". */
export function isDecodeError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /decode|discriminator|buffer length|out of range|offset|Invalid account|AccountDidNotDeserialize/i.test(m);
}
