/**
 * Template presets (brief section 4.1). Templates live off-chain: they only fill
 * the `create_offer` parameters. On-chain the program stores the `template` label
 * and enforces penalty / on_complete / legal_label exactly the same for everybody.
 */
import type { LegalLabel, OnComplete, Penalty } from "./types";
import { TemplateId } from "./types";

export type TemplateKey = "deposit" | "rental" | "freelance" | "purchase";

export interface TemplatePreset {
  key: TemplateKey;
  id: TemplateId;
  label: string;
  /** one-line pitch shown in pickers */
  tagline: string;
  penalty: Penalty;
  onComplete: OnComplete;
  legalLabel: LegalLabel;
  /** default payee stake: equal to the payer amount, or zero */
  defaultStake: "equal" | "zero";
  /** can the user change the stake? (zadatek requires S == D) */
  stakeEditable: boolean;
  roles: { payer: string; payee: string };
  /** what the payer locks, e.g. "deposit", "security deposit", "fee", "price" */
  amountLabel: string;
  confirmLabels: { payer: string; payee: string };
  arbiterRecommended: boolean;
  /** plain-language rules, from the payer's point of view */
  rules: string[];
}

export const TEMPLATES: Record<TemplateKey, TemplatePreset> = {
  deposit: {
    key: "deposit",
    id: TemplateId.Deposit,
    label: "Deposit (zadatek)",
    tagline: "Reservation deposit for a car, flat or other expensive item.",
    penalty: "forfeit",
    onComplete: "toPayee",
    legalLabel: "zadatek",
    defaultStake: "equal",
    stakeEditable: false,
    roles: { payer: "Buyer", payee: "Seller" },
    amountLabel: "deposit",
    confirmLabels: { payer: "Deal completed", payee: "Deal completed" },
    arbiterRecommended: false,
    rules: [
      "Both confirm the handover: the deposit goes to the seller as part of the price, the seller gets their stake back.",
      "The buyer backs out or doesn't show up: the seller keeps the deposit.",
      "The seller backs out or doesn't show up: the buyer gets 2× the deposit back.",
      "Nobody confirms before the deadline: everybody gets their own money back.",
    ],
  },
  rental: {
    key: "rental",
    id: TemplateId.Rental,
    label: "P2P rental",
    tagline: "Security deposit when renting a camera, laptop or car from a stranger.",
    penalty: "forfeit",
    onComplete: "toPayer",
    legalLabel: "none",
    defaultStake: "zero",
    stakeEditable: true,
    roles: { payer: "Renter", payee: "Owner" },
    amountLabel: "security deposit",
    confirmLabels: { payer: "I returned the item", payee: "Item returned in good condition" },
    arbiterRecommended: true,
    rules: [
      "You return the item and confirm. If the owner confirms too, or doesn't object in time, the deposit comes back to you.",
      "The owner claims damage: they open a dispute and the arbiter splits the deposit.",
      "You keep the item: the owner opens a dispute and the arbiter can award the deposit to them (that's why an arbiter is recommended for rentals).",
    ],
  },
  freelance: {
    key: "freelance",
    id: TemplateId.Freelance,
    label: "Freelance job",
    tagline: "One-delivery job: the fee is locked before work starts.",
    penalty: "forfeit",
    onComplete: "toPayee",
    legalLabel: "none",
    defaultStake: "zero",
    stakeEditable: true,
    roles: { payer: "Client", payee: "Freelancer" },
    amountLabel: "fee",
    confirmLabels: { payer: "I accept the work", payee: "Work delivered" },
    arbiterRecommended: true,
    rules: [
      "The freelancer delivers and confirms. If you don't object in time, the fee is paid automatically.",
      "Not happy with the work? Open a dispute — backing out (withdraw) forfeits the fee to the freelancer.",
      "The freelancer never delivers or confirms: the fee comes back to you after the deadline.",
    ],
  },
  purchase: {
    key: "purchase",
    id: TemplateId.Purchase,
    label: "P2P purchase",
    tagline: "Second-hand purchase: the price waits until you have the item.",
    penalty: "forfeit",
    onComplete: "toPayee",
    legalLabel: "none",
    defaultStake: "zero",
    stakeEditable: true,
    roles: { payer: "Buyer", payee: "Seller" },
    amountLabel: "price",
    confirmLabels: { payer: "Item received", payee: "Item handed over / sent" },
    arbiterRecommended: true,
    rules: [
      "The seller hands over or ships the item and confirms. If you don't object in time, the price is paid to the seller.",
      "Item not as described? Open a dispute before the deadline.",
      "The seller never confirms: the price comes back to you after the deadline.",
    ],
  },
};

export const TEMPLATE_KEYS: TemplateKey[] = ["deposit", "rental", "freelance", "purchase"];

export function templateFromId(id: number): TemplatePreset {
  return TEMPLATES[TEMPLATE_KEYS[id] ?? "deposit"] ?? TEMPLATES.deposit;
}

/** Accepts legacy widget values ("car", "property") too. */
export function templateFromKey(key: string | null | undefined): TemplatePreset {
  if (key && key in TEMPLATES) return TEMPLATES[key as TemplateKey];
  return TEMPLATES.deposit;
}
