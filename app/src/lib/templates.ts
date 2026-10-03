/**
 * Deal templates come from the SDK (same program, different parameters; brief §4.1).
 * This module re-exports them and adds a few UI-only helpers.
 */
import { TEMPLATES, templateFromKey, type LegalLabel, type Penalty, type TemplateKey } from "@twokeys/sdk";

export { TEMPLATES, TEMPLATE_KEYS, templateFromId, templateFromKey } from "@twokeys/sdk";
export type { LegalLabel, OnComplete, Penalty, TemplateKey, TemplatePreset } from "@twokeys/sdk";

/** Accepts current keys plus legacy widget values (car/property/item → deposit). */
export function parseTemplate(s: string | null | undefined): TemplateKey {
  return templateFromKey(s).key;
}

export const LEGAL_LABEL_INFO: Record<LegalLabel, { name: string; law: string } | null> = {
  none: null,
  zadatek: { name: "Zadatek", law: "Polish Civil Code, art. 394" },
  zaliczka: { name: "Zaliczka", law: "Refundable advance payment (PL)" },
  trBinding: { name: "Binding deposit (TR)", law: "Turkish Code of Obligations (design assumption)" },
};

export const PENALTY_INFO: Record<Penalty, { name: string; short: string }> = {
  forfeit: { name: "Forfeit", short: "Whoever backs out, or stays silent past the deadline, loses what they locked." },
  refund: { name: "Refund", short: "If the deal falls through, everyone gets their own money back." },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);
