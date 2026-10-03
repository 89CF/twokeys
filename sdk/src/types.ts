import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

/**
 * Roles:
 * - `payer`: locks the main amount D (buyer, renter, client)
 * - `payee`: creates the offer and may lock a stake S (seller, owner, freelancer)
 */

/** What happens to the party that backs out or stays silent past the deadline. */
export type Penalty = "forfeit" | "refund";

/** Where D goes when both parties confirm. S always returns to the payee. */
export type OnComplete = "toPayee" | "toPayer";

/** Legal label; constrains the parameters (zadatek: forfeit + S == D + toPayee; zaliczka: refund). */
export type LegalLabel = "none" | "zadatek" | "zaliczka" | "trBinding";

export type DealKind = "standard";

export type DealStatus = "offered" | "reserved" | "disputed" | "settled";

export type Outcome =
  | "none"
  | "completed"
  | "payerWithdrew"
  | "payeeWithdrew"
  | "payerNoShow"
  | "payeeNoShow"
  | "expired"
  | "cancelled"
  | "resolved"
  | "disputeTimeout";

export type Fault = "none" | "payer" | "payee";

/** On-chain `template` label (u8). Does not change logic by itself. */
export enum TemplateId {
  Deposit = 0,
  Rental = 1,
  Freelance = 2,
  Purchase = 3,
}

export interface Deal {
  address: PublicKey;
  kind: DealKind;
  payee: PublicKey;
  /** null until reserved */
  payer: PublicKey | null;
  /** null = no arbiter, disputes disabled */
  arbiter: PublicKey | null;
  platform: PublicKey;
  mint: PublicKey;
  offerId: BN;
  /** D — payer amount, base units (6 decimals) */
  payerAmount: BN;
  /** S — payee stake, base units (6 decimals) */
  payeeStake: BN;
  penalty: Penalty;
  onComplete: OnComplete;
  legalLabel: LegalLabel;
  template: TemplateId;
  listingHash: number[];
  evidenceHash: number[];
  reserveWindowSecs: number;
  completeWindowSecs: number;
  graceSecs: number;
  arbiterWindowSecs: number;
  /** unix seconds */
  createdAt: number;
  reservedAt: number;
  completeDeadline: number;
  disputeDeadline: number;
  /** computed: createdAt + reserveWindowSecs */
  reserveDeadline: number;
  /** computed: completeDeadline + graceSecs (0 if not reserved); claim_after_deadline allowed when now > claimableAt */
  claimableAt: number;
  payerConfirmed: boolean;
  payeeConfirmed: boolean;
  status: DealStatus;
  outcome: Outcome;
}

export interface Profile {
  address: PublicKey;
  wallet: PublicKey;
  completed: number;
  withdrew: number;
  noShow: number;
  disputesLost: number;
  volumeCompleted: BN;
}

export interface PlatformStats {
  address: PublicKey;
  platform: PublicKey;
  offers: BN;
  reserved: BN;
  completed: BN;
  payerWithdrew: BN;
  payeeWithdrew: BN;
  noShow: BN;
  expired: BN;
  cancelled: BN;
  disputed: BN;
  resolved: BN;
  volumeCompleted: BN;
}

export interface CreateOfferParams {
  /** defaults to a Date.now()-based unique u64 */
  offerId?: BN;
  mint: PublicKey;
  /** D, base units */
  payerAmount: BN;
  /** S, base units (may be 0; must equal payerAmount for zadatek) */
  payeeStake: BN;
  penalty: Penalty;
  onComplete: OnComplete;
  legalLabel: LegalLabel;
  template: TemplateId;
  /** 32 bytes */
  listingHash: number[] | Uint8Array;
  reserveWindowSecs: number;
  completeWindowSecs: number;
  graceSecs: number;
  arbiterWindowSecs: number;
  /** omit/null for no arbiter */
  arbiter?: PublicKey | null;
  platform: PublicKey;
}

export interface Payout {
  toPayer: BN;
  toPayee: BN;
}
