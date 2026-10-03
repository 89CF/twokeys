/**
 * @twokeys/sdk — thin TypeScript layer over the Anchor client of the `twokeys` program.
 *
 * - PDA helpers (`findDealPda`, `findVaultPda`, `findProfilePda`, `findStatsPda`)
 * - `previewPayout` mirrors the on-chain payout table (programs/twokeys/src/settle.rs)
 * - `TwoKeysClient` wraps every instruction and decodes accounts into plain objects
 */
import { AnchorProvider, Program, type Provider, utils } from "@coral-xyz/anchor";
import type { Connection, GetProgramAccountsFilter } from "@solana/web3.js";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import BN from "bn.js";

import idlJson from "./idl/twokeys.json";
import type { Twokeys as TwoKeys } from "./idl/twokeys";
import type {
  CreateOfferParams,
  Deal,
  DealStatus,
  Fault,
  LegalLabel,
  OnComplete,
  Outcome,
  Payout,
  Penalty,
  PlatformStats,
  Profile,
  TemplateId,
} from "./types";

export * from "./types";
export * from "./templates";
export type { Twokeys as TwoKeys } from "./idl/twokeys";
export const IDL = idlJson as TwoKeys;

export const TWOKEYS_PROGRAM_ID = new PublicKey(idlJson.address);
export const USDC_DECIMALS = 6;
export const BPS_DENOMINATOR = 10_000;

// ---------------------------------------------------------------------------
// PDAs
// ---------------------------------------------------------------------------

export function findDealPda(
  payee: PublicKey,
  offerId: BN,
  programId: PublicKey = TWOKEYS_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("deal"), payee.toBuffer(), offerId.toArrayLike(Buffer, "le", 8)],
    programId,
  )[0];
}

export function findVaultPda(deal: PublicKey, programId: PublicKey = TWOKEYS_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), deal.toBuffer()], programId)[0];
}

export function findProfilePda(
  wallet: PublicKey,
  programId: PublicKey = TWOKEYS_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("profile"), wallet.toBuffer()], programId)[0];
}

export function findStatsPda(
  platform: PublicKey,
  programId: PublicKey = TWOKEYS_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("stats"), platform.toBuffer()], programId)[0];
}

// ---------------------------------------------------------------------------
// Payout table (must stay identical to settle.rs::payout_deposit)
// ---------------------------------------------------------------------------

export function previewPayout(
  penalty: Penalty,
  onComplete: OnComplete,
  outcome: Outcome,
  payerAmount: BN,
  payeeStake: BN,
  payerBps = 0,
): Payout {
  const d = payerAmount;
  const st = payeeStake;
  const p = d.add(st);
  const zero = new BN(0);
  const refund = { toPayer: d, toPayee: st };
  const forfeit = penalty === "forfeit";
  switch (outcome) {
    case "completed":
      return onComplete === "toPayee" ? { toPayer: zero, toPayee: p } : refund;
    case "payerWithdrew":
    case "payerNoShow":
      return forfeit ? { toPayer: zero, toPayee: p } : refund;
    case "payeeWithdrew":
    case "payeeNoShow":
      return forfeit ? { toPayer: p, toPayee: zero } : refund;
    case "expired":
    case "disputeTimeout":
      return refund;
    case "cancelled":
      return { toPayer: zero, toPayee: st };
    case "resolved": {
      if (payerBps < 0 || payerBps > BPS_DENOMINATOR) throw new Error("payerBps must be 0..10000");
      const toPayer = p.muln(payerBps).divn(BPS_DENOMINATOR);
      return { toPayer, toPayee: p.sub(toPayer) };
    }
    case "none":
    default:
      throw new Error(`no payout for outcome "${outcome}"`);
  }
}

/** Convenience: payout preview for a decoded deal. */
export function previewDealPayout(deal: Deal, outcome: Outcome, payerBps = 0): Payout {
  return previewPayout(deal.penalty, deal.onComplete, outcome, deal.payerAmount, deal.payeeStake, payerBps);
}

export function toBaseUnits(uiAmount: number): BN {
  return new BN(Math.round(uiAmount * 10 ** USDC_DECIMALS).toString());
}

export function fromBaseUnits(amount: BN): number {
  return Number(amount.toString()) / 10 ** USDC_DECIMALS;
}

/** Unique-enough u64 offer id: ms timestamp * 1000 + random. */
export function newOfferId(): BN {
  return new BN(Date.now()).muln(1000).addn(Math.floor(Math.random() * 1000));
}

// ---------------------------------------------------------------------------
// Account decoding
// ---------------------------------------------------------------------------

/** Anchor encodes enums as `{ variantName: {} }`. */
function enumKey<T extends string>(e: Record<string, unknown>): T {
  return Object.keys(e)[0] as T;
}

function optionalKey(k: PublicKey): PublicKey | null {
  return k.equals(PublicKey.default) ? null : k;
}

// Byte offsets inside the Deal account (8-byte discriminator first), used for memcmp filters.
const DEAL_OFFSETS = {
  payee: 8 + 1,
  payer: 8 + 1 + 32,
  platform: 8 + 1 + 32 * 3,
  status: 327,
} as const;
const STATUS_INDEX: Record<DealStatus, number> = {
  offered: 0,
  reserved: 1,
  disputed: 2,
  settled: 3,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeDeal(address: PublicKey, a: any): Deal {
  const createdAt = Number(a.createdAt);
  const completeDeadline = Number(a.completeDeadline);
  const graceSecs = Number(a.graceSecs);
  const status = enumKey<DealStatus>(a.status);
  return {
    address,
    kind: enumKey<"standard">(a.kind),
    payee: a.payee,
    payer: optionalKey(a.payer),
    arbiter: optionalKey(a.arbiter),
    platform: a.platform,
    mint: a.mint,
    offerId: a.offerId,
    payerAmount: a.payerAmount,
    payeeStake: a.payeeStake,
    penalty: enumKey<Penalty>(a.penalty),
    onComplete: enumKey<OnComplete>(a.onComplete),
    legalLabel: enumKey<LegalLabel>(a.legalLabel),
    template: a.template as TemplateId,
    listingHash: Array.from(a.listingHash as number[]),
    evidenceHash: Array.from(a.evidenceHash as number[]),
    reserveWindowSecs: Number(a.reserveWindowSecs),
    completeWindowSecs: Number(a.completeWindowSecs),
    graceSecs,
    arbiterWindowSecs: Number(a.arbiterWindowSecs),
    createdAt,
    reservedAt: Number(a.reservedAt),
    completeDeadline,
    disputeDeadline: Number(a.disputeDeadline),
    reserveDeadline: createdAt + Number(a.reserveWindowSecs),
    claimableAt: completeDeadline > 0 ? completeDeadline + graceSecs : 0,
    payerConfirmed: a.payerConfirmed,
    payeeConfirmed: a.payeeConfirmed,
    status,
    outcome: enumKey<Outcome>(a.outcome),
  };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface FullDealAccounts {
  deal: PublicKey;
  mint: PublicKey;
  vault: PublicKey;
  payee: PublicKey;
  payer: PublicKey;
  payeeToken: PublicKey;
  payerToken: PublicKey;
  payeeProfile: PublicKey;
  payerProfile: PublicKey;
  stats: PublicKey;
  tokenProgram: PublicKey;
  associatedTokenProgram: PublicKey;
  systemProgram: PublicKey;
}

export class TwoKeysClient {
  readonly program: Program<TwoKeys>;

  constructor(provider: Provider, programId: PublicKey = TWOKEYS_PROGRAM_ID) {
    const idl = { ...IDL, address: programId.toBase58() } as TwoKeys;
    this.program = new Program<TwoKeys>(idl, provider);
  }

  /** Client without a wallet — for reading accounts only. */
  static readOnly(connection: Connection, programId: PublicKey = TWOKEYS_PROGRAM_ID): TwoKeysClient {
    const wallet = {
      publicKey: PublicKey.default,
      signTransaction: async () => {
        throw new Error("read-only client");
      },
      signAllTransactions: async () => {
        throw new Error("read-only client");
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
    return new TwoKeysClient(provider, programId);
  }

  get programId(): PublicKey {
    return this.program.programId;
  }

  get provider(): Provider {
    return this.program.provider;
  }

  /** Connected wallet. */
  get walletKey(): PublicKey {
    const pk = this.program.provider.publicKey;
    if (!pk || pk.equals(PublicKey.default)) throw new Error("wallet not connected");
    return pk;
  }

  // ---- reads ---------------------------------------------------------------

  async getDeal(deal: PublicKey): Promise<Deal | null> {
    const a = await this.program.account.deal.fetchNullable(deal);
    return a ? decodeDeal(deal, a) : null;
  }

  async getProfile(wallet: PublicKey): Promise<Profile | null> {
    const address = findProfilePda(wallet, this.programId);
    const a = await this.program.account.profile.fetchNullable(address);
    if (!a) return null;
    return {
      address,
      wallet: a.wallet,
      completed: a.completed,
      withdrew: a.withdrew,
      noShow: a.noShow,
      disputesLost: a.disputesLost,
      volumeCompleted: a.volumeCompleted,
    };
  }

  async getPlatformStats(platform: PublicKey): Promise<PlatformStats | null> {
    const address = findStatsPda(platform, this.programId);
    const a = await this.program.account.platformStats.fetchNullable(address);
    if (!a) return null;
    return {
      address,
      platform: a.platform,
      offers: a.offers,
      reserved: a.reserved,
      completed: a.completed,
      payerWithdrew: a.payerWithdrew,
      payeeWithdrew: a.payeeWithdrew,
      noShow: a.noShow,
      expired: a.expired,
      cancelled: a.cancelled,
      disputed: a.disputed,
      resolved: a.resolved,
      volumeCompleted: a.volumeCompleted,
    };
  }

  async listDeals(
    filter: { payee?: PublicKey; payer?: PublicKey; status?: DealStatus; platform?: PublicKey } = {},
  ): Promise<Deal[]> {
    const filters: GetProgramAccountsFilter[] = [];
    const memcmp = (offset: number, bytes: Uint8Array) =>
      filters.push({ memcmp: { offset, bytes: utils.bytes.bs58.encode(bytes) } });
    if (filter.payee) memcmp(DEAL_OFFSETS.payee, filter.payee.toBytes());
    if (filter.payer) memcmp(DEAL_OFFSETS.payer, filter.payer.toBytes());
    if (filter.platform) memcmp(DEAL_OFFSETS.platform, filter.platform.toBytes());
    if (filter.status) memcmp(DEAL_OFFSETS.status, Uint8Array.from([STATUS_INDEX[filter.status]]));
    const all = await this.program.account.deal.all(filters);
    return all
      .map((x) => decodeDeal(x.publicKey, x.account))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Every account a settling instruction needs, derived from the deal. */
  dealAccounts(deal: Deal): FullDealAccounts {
    const payer = deal.payer ?? PublicKey.default;
    return {
      deal: deal.address,
      mint: deal.mint,
      vault: findVaultPda(deal.address, this.programId),
      payee: deal.payee,
      payer,
      payeeToken: getAssociatedTokenAddressSync(deal.mint, deal.payee, true),
      payerToken: getAssociatedTokenAddressSync(deal.mint, payer, true),
      payeeProfile: findProfilePda(deal.payee, this.programId),
      payerProfile: findProfilePda(payer, this.programId),
      stats: findStatsPda(deal.platform, this.programId),
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    };
  }

  private async mustGetDeal(deal: PublicKey): Promise<Deal> {
    const d = await this.getDeal(deal);
    if (!d) throw new Error(`deal ${deal.toBase58()} not found`);
    return d;
  }

  // ---- instructions --------------------------------------------------------

  async createOffer(
    p: CreateOfferParams,
  ): Promise<{ signature: string; deal: PublicKey; offerId: BN }> {
    const payee = this.walletKey;
    const offerId = p.offerId ?? newOfferId();
    const deal = findDealPda(payee, offerId, this.programId);
    const listingHash = Array.from(p.listingHash);
    if (listingHash.length !== 32) throw new Error("listingHash must be 32 bytes");
    const signature = await this.program.methods
      .createOffer({
        kind: 0,
        offerId,
        payerAmount: p.payerAmount,
        payeeStake: p.payeeStake,
        penalty: { [p.penalty]: {} } as never,
        onComplete: { [p.onComplete]: {} } as never,
        legalLabel: { [p.legalLabel]: {} } as never,
        template: p.template,
        listingHash,
        reserveWindowSecs: new BN(p.reserveWindowSecs),
        completeWindowSecs: new BN(p.completeWindowSecs),
        graceSecs: new BN(p.graceSecs),
        arbiterWindowSecs: new BN(p.arbiterWindowSecs),
        arbiter: p.arbiter ?? PublicKey.default,
        platform: p.platform,
      })
      .accountsPartial({
        payee,
        deal,
        mint: p.mint,
        vault: findVaultPda(deal, this.programId),
        payeeToken: getAssociatedTokenAddressSync(p.mint, payee, true),
        payeeProfile: findProfilePda(payee, this.programId),
        stats: findStatsPda(p.platform, this.programId),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return { signature, deal, offerId };
  }

  async cancelOffer(deal: PublicKey): Promise<string> {
    const d = await this.mustGetDeal(deal);
    const a = this.dealAccounts(d);
    return this.program.methods
      .cancelOffer()
      .accountsPartial({
        actor: this.walletKey,
        deal: a.deal,
        mint: a.mint,
        vault: a.vault,
        payee: a.payee,
        payeeToken: a.payeeToken,
        stats: a.stats,
        tokenProgram: a.tokenProgram,
        associatedTokenProgram: a.associatedTokenProgram,
        systemProgram: a.systemProgram,
      })
      .rpc();
  }

  async reserve(deal: PublicKey): Promise<string> {
    const d = await this.mustGetDeal(deal);
    const payer = this.walletKey;
    return this.program.methods
      .reserve()
      .accountsPartial({
        payer,
        deal,
        mint: d.mint,
        vault: findVaultPda(deal, this.programId),
        payerToken: getAssociatedTokenAddressSync(d.mint, payer, true),
        payerProfile: findProfilePda(payer, this.programId),
        stats: findStatsPda(d.platform, this.programId),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  private async settleAccounts(deal: PublicKey) {
    const d = await this.mustGetDeal(deal);
    return { actor: this.walletKey, ...this.dealAccounts(d) };
  }

  async confirm(deal: PublicKey): Promise<string> {
    const accounts = await this.settleAccounts(deal);
    return this.program.methods.confirmComplete().accountsPartial(accounts).rpc();
  }

  async withdraw(deal: PublicKey): Promise<string> {
    const accounts = await this.settleAccounts(deal);
    return this.program.methods.withdraw().accountsPartial(accounts).rpc();
  }

  async claimAfterDeadline(deal: PublicKey): Promise<string> {
    const accounts = await this.settleAccounts(deal);
    return this.program.methods.claimAfterDeadline().accountsPartial(accounts).rpc();
  }

  async openDispute(deal: PublicKey, evidenceHash: number[] | Uint8Array): Promise<string> {
    const d = await this.mustGetDeal(deal);
    const hash = Array.from(evidenceHash);
    if (hash.length !== 32) throw new Error("evidenceHash must be 32 bytes");
    return this.program.methods
      .openDispute(hash)
      .accountsPartial({
        actor: this.walletKey,
        deal,
        stats: findStatsPda(d.platform, this.programId),
      })
      .rpc();
  }

  async resolve(deal: PublicKey, payerBps: number, fault: Fault): Promise<string> {
    const accounts = await this.settleAccounts(deal);
    const faultArg = { [fault]: {} } as never;
    return this.program.methods.resolve(payerBps, faultArg).accountsPartial(accounts).rpc();
  }

  async expireDispute(deal: PublicKey): Promise<string> {
    const accounts = await this.settleAccounts(deal);
    return this.program.methods.expireDispute().accountsPartial(accounts).rpc();
  }
}
