import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";

import {
  type CreateOfferParams,
  type LegalLabel,
  type OnComplete,
  type Penalty,
  TwoKeysClient,
  TemplateId,
  findDealPda,
  findProfilePda,
  findStatsPda,
  findVaultPda,
  newOfferId,
  previewPayout,
} from "../sdk/src";
import { type Env, START_USDC, USDC, expectError, expectFailure, setup } from "./helpers";

const D = USDC(2_000);
const WINDOWS = { reserve: 600, complete: 60, grace: 30, arbiter: 60 };
const start = BigInt(USDC(START_USDC).toString());
const big = (b: BN) => BigInt(b.toString());

type Preset = { penalty: Penalty; onComplete: OnComplete; legalLabel: LegalLabel; template: TemplateId };
const PRESETS = {
  zadatek: { penalty: "forfeit", onComplete: "toPayee", legalLabel: "zadatek", template: TemplateId.Deposit },
  zaliczka: { penalty: "refund", onComplete: "toPayee", legalLabel: "zaliczka", template: TemplateId.Deposit },
  rental: { penalty: "forfeit", onComplete: "toPayer", legalLabel: "none", template: TemplateId.Rental },
  freelance: { penalty: "forfeit", onComplete: "toPayee", legalLabel: "none", template: TemplateId.Freelance },
  refund: { penalty: "refund", onComplete: "toPayee", legalLabel: "none", template: TemplateId.Purchase },
} satisfies Record<string, Preset>;
type PresetKey = keyof typeof PRESETS;

describe("twokeys", () => {
  let env: Env;
  let payee: TwoKeysClient;
  let payer: TwoKeysClient;
  let arbiter: TwoKeysClient;
  let stranger: TwoKeysClient;

  beforeEach(() => {
    env = setup();
    payee = env.client(env.payee);
    payer = env.client(env.payer);
    arbiter = env.client(env.arbiter);
    stranger = env.client(env.stranger);
  });

  function offerParams(over: Partial<CreateOfferParams> = {}): CreateOfferParams {
    return {
      mint: env.mint,
      payerAmount: D,
      payeeStake: D,
      ...PRESETS.zadatek,
      listingHash: Array.from({ length: 32 }, (_, i) => i),
      reserveWindowSecs: WINDOWS.reserve,
      completeWindowSecs: WINDOWS.complete,
      graceSecs: WINDOWS.grace,
      arbiterWindowSecs: WINDOWS.arbiter,
      arbiter: env.arbiter.publicKey,
      platform: env.platform,
      ...over,
    };
  }

  async function offer(rule: PresetKey = "zadatek", over: Partial<CreateOfferParams> = {}) {
    const { deal } = await payee.createOffer(offerParams({ ...PRESETS[rule], ...over }));
    return deal;
  }

  async function reserved(rule: PresetKey = "zadatek", over: Partial<CreateOfferParams> = {}) {
    const deal = await offer(rule, over);
    await payer.reserve(deal);
    return deal;
  }

  const payeeBal = () => env.balance(env.payee.publicKey);
  const payerBal = () => env.balance(env.payer.publicKey);

  // -------------------------------------------------------------------------

  it("create_offer locks the payee stake and initialises accounts", async () => {
    const deal = await offer();
    const d = (await payee.getDeal(deal))!;
    expect(d.status).to.eq("offered");
    expect(d.outcome).to.eq("none");
    expect(d.legalLabel).to.eq("zadatek");
    expect(d.penalty).to.eq("forfeit");
    expect(d.onComplete).to.eq("toPayee");
    expect(d.template).to.eq(TemplateId.Deposit);
    expect(d.kind).to.eq("standard");
    expect(d.payer).to.eq(null);
    expect(d.arbiter!.equals(env.arbiter.publicKey)).to.eq(true);
    expect(d.reserveDeadline).to.eq(d.createdAt + WINDOWS.reserve);
    expect(payeeBal()).to.eq(start - big(D));
    expect(env.balance(findVaultPda(deal), env.mint)).to.eq(0n); // vault is a PDA token account, not an ATA
    const stats = (await payee.getPlatformStats(env.platform))!;
    expect(stats.offers.toNumber()).to.eq(1);
    const profile = (await payee.getProfile(env.payee.publicKey))!;
    expect(profile.wallet.equals(env.payee.publicKey)).to.eq(true);
  });

  it("1. happy path: offer -> reserve -> two confirmations -> Completed", async () => {
    const deal = await reserved();
    let d = (await payee.getDeal(deal))!;
    expect(d.status).to.eq("reserved");
    expect(d.payer!.equals(env.payer.publicKey)).to.eq(true);
    expect(d.completeDeadline).to.eq(d.reservedAt + WINDOWS.complete);
    expect(payerBal()).to.eq(start - big(D));

    await payer.confirm(deal);
    d = (await payee.getDeal(deal))!;
    expect(d.payerConfirmed).to.eq(true);
    expect(d.status).to.eq("reserved");

    await payee.confirm(deal);
    d = (await payee.getDeal(deal))!;
    expect(d.status).to.eq("settled");
    expect(d.outcome).to.eq("completed");

    // payee receives P = D + S (their own stake back + the payer's deposit)
    expect(payeeBal()).to.eq(start + big(D));
    expect(payerBal()).to.eq(start - big(D));
    expect(env.svm.getAccount(findVaultPda(deal))).to.eq(null);

    for (const w of [env.payee.publicKey, env.payer.publicKey]) {
      const p = (await payee.getProfile(w))!;
      expect(p.completed).to.eq(1);
      expect(p.volumeCompleted.eq(D)).to.eq(true);
      expect(p.withdrew + p.noShow + p.disputesLost).to.eq(0);
    }
    const stats = (await payee.getPlatformStats(env.platform))!;
    expect(stats.reserved.toNumber()).to.eq(1);
    expect(stats.completed.toNumber()).to.eq(1);
    expect(stats.volumeCompleted.eq(D)).to.eq(true);
  });

  it("2. zadatek, payer withdraws: payee takes P", async () => {
    const deal = await reserved("zadatek");
    await payer.withdraw(deal);
    const d = (await payee.getDeal(deal))!;
    expect(d.outcome).to.eq("payerWithdrew");
    expect(payeeBal()).to.eq(start + big(D));
    expect(payerBal()).to.eq(start - big(D));
    expect((await payee.getProfile(env.payer.publicKey))!.withdrew).to.eq(1);
    expect((await payee.getProfile(env.payee.publicKey))!.withdrew).to.eq(0);
    expect((await payee.getPlatformStats(env.platform))!.payerWithdrew.toNumber()).to.eq(1);
  });

  it("3. zadatek, payee withdraws: payer gets P = 2D back", async () => {
    const deal = await reserved("zadatek");
    await payee.withdraw(deal);
    const d = (await payee.getDeal(deal))!;
    expect(d.outcome).to.eq("payeeWithdrew");
    expect(payerBal()).to.eq(start + big(D));
    expect(payeeBal()).to.eq(start - big(D));
    expect((await payee.getProfile(env.payee.publicKey))!.withdrew).to.eq(1);
    expect((await payee.getPlatformStats(env.platform))!.payeeWithdrew.toNumber()).to.eq(1);
  });

  it("4. zaliczka, payee withdraws: payer gets D, payee gets S", async () => {
    const S = USDC(500);
    const deal = await reserved("zaliczka", { payeeStake: S });
    await payee.withdraw(deal);
    const d = (await payee.getDeal(deal))!;
    expect(d.outcome).to.eq("payeeWithdrew");
    expect(payerBal()).to.eq(start);
    expect(payeeBal()).to.eq(start);
  });

  it("4b. zaliczka with zero payee stake works", async () => {
    const deal = await reserved("zaliczka", { payeeStake: new BN(0) });
    await payer.withdraw(deal);
    expect((await payee.getDeal(deal))!.outcome).to.eq("payerWithdrew");
    expect(payerBal()).to.eq(start);
    expect(payeeBal()).to.eq(start);
  });

  it("5. only payer confirms, deadline passes: PayeeNoShow (zadatek -> payer gets P)", async () => {
    const deal = await reserved("zadatek");
    await payer.confirm(deal);
    await expectError(stranger.claimAfterDeadline(deal), "DeadlineNotReached");
    env.warp(WINDOWS.complete + WINDOWS.grace + 1);
    // after the grace period nobody can confirm or withdraw any more
    await expectError(payee.confirm(deal), "DeadlinePassed");
    await expectError(payee.withdraw(deal), "DeadlinePassed");
    await stranger.claimAfterDeadline(deal);
    const d = (await payee.getDeal(deal))!;
    expect(d.outcome).to.eq("payeeNoShow");
    expect(payerBal()).to.eq(start + big(D));
    expect(payeeBal()).to.eq(start - big(D));
    expect((await payee.getProfile(env.payee.publicKey))!.noShow).to.eq(1);
    expect((await payee.getProfile(env.payer.publicKey))!.noShow).to.eq(0);
  });

  it("5b. only payee confirms, deadline passes: PayerNoShow (zadatek -> payee gets P)", async () => {
    const deal = await reserved("zadatek");
    await payee.confirm(deal);
    env.warp(WINDOWS.complete + WINDOWS.grace + 1);
    await stranger.claimAfterDeadline(deal);
    expect((await payee.getDeal(deal))!.outcome).to.eq("payerNoShow");
    expect(payeeBal()).to.eq(start + big(D));
    expect((await payee.getProfile(env.payer.publicKey))!.noShow).to.eq(1);
  });

  it("6. nobody confirms: Expired, both refunded, both no-show", async () => {
    const deal = await reserved("zadatek");
    env.warp(WINDOWS.complete + WINDOWS.grace + 1);
    await stranger.claimAfterDeadline(deal);
    expect((await payee.getDeal(deal))!.outcome).to.eq("expired");
    expect(payerBal()).to.eq(start);
    expect(payeeBal()).to.eq(start);
    expect((await payee.getProfile(env.payer.publicKey))!.noShow).to.eq(1);
    expect((await payee.getProfile(env.payee.publicKey))!.noShow).to.eq(1);
    expect((await payee.getPlatformStats(env.platform))!.expired.toNumber()).to.eq(1);
  });

  it("7. payer never comes: after reserve deadline anyone can cancel", async () => {
    const deal = await offer();
    await expectError(stranger.cancelOffer(deal), "DeadlineNotReached");
    env.warp(WINDOWS.reserve + 1);
    await expectError(payer.reserve(deal), "DeadlinePassed");
    await stranger.cancelOffer(deal);
    const d = (await payee.getDeal(deal))!;
    expect(d.status).to.eq("settled");
    expect(d.outcome).to.eq("cancelled");
    expect(payeeBal()).to.eq(start);
    expect((await payee.getPlatformStats(env.platform))!.cancelled.toNumber()).to.eq(1);
  });

  it("7b. payee may cancel anytime while Offered, but not after reservation", async () => {
    const deal = await offer();
    await payee.cancelOffer(deal);
    expect((await payee.getDeal(deal))!.outcome).to.eq("cancelled");
    expect(payeeBal()).to.eq(start);

    const deal2 = await reserved();
    await expectError(payee.cancelOffer(deal2), "InvalidStatus");
  });

  it("8. dispute: arbiter splits 70/30 and blames the payee", async () => {
    const deal = await reserved("zadatek");
    const evidence = Array.from({ length: 32 }, () => 7);
    await payer.openDispute(deal, evidence);
    let d = (await payee.getDeal(deal))!;
    expect(d.status).to.eq("disputed");
    expect(d.evidenceHash).to.deep.eq(evidence);
    expect(d.disputeDeadline).to.be.greaterThan(0);

    // parties can no longer confirm / withdraw / claim while disputed
    await expectError(payee.confirm(deal), "InvalidStatus");
    await expectError(payee.withdraw(deal), "InvalidStatus");
    await expectError(stranger.resolve(deal, 7_000, "payee"), "NotArbiter");
    await expectError(payer.resolve(deal, 7_000, "payee"), "NotArbiter");
    await expectError(arbiter.resolve(deal, 10_001, "payee"), "InvalidBps");

    await arbiter.resolve(deal, 7_000, "payee");
    d = (await payee.getDeal(deal))!;
    expect(d.outcome).to.eq("resolved");
    const P = big(D) * 2n;
    const toPayer = (P * 7000n) / 10000n;
    expect(payerBal()).to.eq(start - big(D) + toPayer);
    expect(payeeBal()).to.eq(start - big(D) + (P - toPayer));
    expect((await payee.getProfile(env.payee.publicKey))!.disputesLost).to.eq(1);
    expect((await payee.getProfile(env.payer.publicKey))!.disputesLost).to.eq(0);
    const stats = (await payee.getPlatformStats(env.platform))!;
    expect(stats.disputed.toNumber()).to.eq(1);
    expect(stats.resolved.toNumber()).to.eq(1);
  });

  it("9. dispute: arbiter stays silent -> DisputeTimeout refunds both", async () => {
    const deal = await reserved("zadatek");
    await payee.openDispute(deal, new Uint8Array(32).fill(1));
    await expectError(stranger.expireDispute(deal), "DeadlineNotReached");
    env.warp(WINDOWS.arbiter + 1);
    await expectError(arbiter.resolve(deal, 5_000, "none"), "DeadlinePassed");
    await stranger.expireDispute(deal);
    expect((await payee.getDeal(deal))!.outcome).to.eq("disputeTimeout");
    expect(payerBal()).to.eq(start);
    expect(payeeBal()).to.eq(start);
  });

  it("10. rental: both confirm -> deposit returns to the payer, stake to the payee", async () => {
    const S = USDC(100);
    const deal = await reserved("rental", { payeeStake: S });
    await payer.confirm(deal);
    await payee.confirm(deal);
    const d = (await payee.getDeal(deal))!;
    expect(d.outcome).to.eq("completed");
    expect(d.template).to.eq(TemplateId.Rental);
    expect(payerBal()).to.eq(start);
    expect(payeeBal()).to.eq(start);
    expect((await payee.getProfile(env.payer.publicKey))!.completed).to.eq(1);
  });

  it("11. freelance: only the freelancer confirms, client stays silent -> PayerNoShow, fee to freelancer", async () => {
    const deal = await reserved("freelance", { payeeStake: new BN(0), arbiter: null });
    await payee.confirm(deal); // "Work delivered"
    env.warp(WINDOWS.complete + WINDOWS.grace + 1);
    await stranger.claimAfterDeadline(deal);
    expect((await payee.getDeal(deal))!.outcome).to.eq("payerNoShow");
    expect(payeeBal()).to.eq(start + big(D));
    expect(payerBal()).to.eq(start - big(D));
    expect((await payee.getProfile(env.payer.publicKey))!.noShow).to.eq(1);
  });

  it("12. refund rule: payee withdraws -> payer gets D, payee gets S", async () => {
    const S = USDC(300);
    const deal = await reserved("refund", { payeeStake: S });
    await payee.withdraw(deal);
    expect((await payee.getDeal(deal))!.outcome).to.eq("payeeWithdrew");
    expect(payerBal()).to.eq(start);
    expect(payeeBal()).to.eq(start);
  });

  it("13. legal label constraints are enforced", async () => {
    await expectError(offer("zadatek", { penalty: "refund" }), "InvalidLegalParams");
    await expectError(offer("zadatek", { onComplete: "toPayer" }), "InvalidLegalParams");
    await expectError(offer("zadatek", { payeeStake: USDC(1) }), "StakeMustEqualDeposit");
    await expectError(offer("zaliczka", { penalty: "forfeit" }), "InvalidLegalParams");
    // no label: any combination is allowed
    const deal = await offer("rental", { penalty: "refund", payeeStake: new BN(0) });
    expect((await payee.getDeal(deal))!.penalty).to.eq("refund");
  });

  it("previewPayout matches every on-chain settlement", async () => {
    const S = USDC(300);
    expect(previewPayout("forfeit", "toPayee", "payeeWithdrew", D, D).toPayer.eq(D.muln(2))).to.eq(true);
    expect(previewPayout("refund", "toPayee", "payeeWithdrew", D, S).toPayee.eq(S)).to.eq(true);
    expect(previewPayout("forfeit", "toPayer", "completed", D, S).toPayer.eq(D)).to.eq(true);
    expect(previewPayout("refund", "toPayee", "resolved", D, S, 3_333).toPayer.add(
      previewPayout("refund", "toPayee", "resolved", D, S, 3_333).toPayee,
    ).eq(D.add(S))).to.eq(true);
  });

  // -------------------------------------------------------------------------
  describe("14. negative cases", () => {
    it("rejects a wrong signer", async () => {
      const deal = await reserved();
      await expectError(stranger.confirm(deal), "NotParty");
      await expectError(stranger.withdraw(deal), "NotParty");
      await expectError(stranger.openDispute(deal, new Uint8Array(32)), "NotParty");
    });

    it("rejects instructions in the wrong status", async () => {
      const deal = await offer();
      await expectError(payer.openDispute(deal, new Uint8Array(32)), "InvalidStatus");
      await payer.reserve(deal);
      await expectError(env.client(env.stranger).reserve(deal), "InvalidStatus");
      await expectError(stranger.expireDispute(deal), "InvalidStatus");
    });

    it("rejects zadatek with S != D", async () => {
      await expectError(offer("zadatek", { payeeStake: USDC(1_000) }), "StakeMustEqualDeposit");
    });

    it("rejects invalid amounts and windows", async () => {
      await expectError(
        offer("zaliczka", { payerAmount: new BN(0), payeeStake: new BN(0) }),
        "InvalidAmount",
      );
      await expectError(offer("zadatek", { graceSecs: 0 }), "InvalidWindow");
      await expectError(offer("zadatek", { completeWindowSecs: -5 }), "InvalidWindow");
    });

    it("rejects reserving your own offer (and the arbiter reserving)", async () => {
      const deal = await offer();
      await expectError(payee.reserve(deal), "SelfDeal");
      env.fund(env.arbiter.publicKey, 5_000);
      await expectError(arbiter.reserve(deal), "SelfDeal");
      await expectError(
        payee.createOffer(offerParams({ arbiter: env.payee.publicKey })),
        "SelfDeal",
      );
    });

    it("cannot settle twice", async () => {
      const deal = await reserved();
      await payer.confirm(deal);
      await payee.confirm(deal);
      await expectFailure(payer.confirm(deal));
      await expectFailure(payee.withdraw(deal));
      env.warp(WINDOWS.complete + WINDOWS.grace + 1);
      await expectFailure(stranger.claimAfterDeadline(deal));
      expect((await payee.getDeal(deal))!.outcome).to.eq("completed");
      expect(payeeBal()).to.eq(start + big(D));
    });

    it("rejects claim before the deadline", async () => {
      const deal = await reserved();
      await expectError(stranger.claimAfterDeadline(deal), "DeadlineNotReached");
      env.warp(WINDOWS.complete + WINDOWS.grace); // exactly at grace end: still not claimable
      await expectError(stranger.claimAfterDeadline(deal), "DeadlineNotReached");
    });

    it("rejects a dispute without an arbiter", async () => {
      const deal = await reserved("zadatek", { arbiter: null });
      await expectError(payer.openDispute(deal, new Uint8Array(32)), "NoArbiter");
    });

    it("rejects a dispute after the grace period", async () => {
      const deal = await reserved();
      env.warp(WINDOWS.complete + WINDOWS.grace + 1);
      await expectError(payer.openDispute(deal, new Uint8Array(32)), "DeadlinePassed");
    });

    it("rejects double confirmation by the same party", async () => {
      const deal = await reserved();
      await payer.confirm(deal);
      await expectError(payer.confirm(deal), "AlreadyConfirmed");
    });

    it("rejects an unsupported deal kind", async () => {
      const offerId = newOfferId();
      const deal = findDealPda(env.payee.publicKey, offerId);
      await expectError(
        payee.program.methods
          .createOffer({
            kind: 1,
            offerId,
            payerAmount: D,
            payeeStake: D,
            penalty: { forfeit: {} },
            onComplete: { toPayee: {} },
            legalLabel: { zadatek: {} },
            template: 0,
            listingHash: new Array(32).fill(0),
            reserveWindowSecs: new BN(60),
            completeWindowSecs: new BN(60),
            graceSecs: new BN(60),
            arbiterWindowSecs: new BN(60),
            arbiter: PublicKey.default,
            platform: env.platform,
          })
          .accountsPartial({
            payee: env.payee.publicKey,
            deal,
            mint: env.mint,
            vault: findVaultPda(deal),
            payeeToken: getAssociatedTokenAddressSync(env.mint, env.payee.publicKey),
            payeeProfile: findProfilePda(env.payee.publicKey),
            stats: findStatsPda(env.platform),
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc(),
        "UnsupportedKind",
      );
    });

    it("rejects a token account of a different mint", async () => {
      const deal = await offer();
      const otherMint = env.createMint();
      env.fund(env.payer.publicKey, 5_000, otherMint);
      const d = (await payer.getDeal(deal))!;
      await expectError(
        payer.program.methods
          .reserve()
          .accountsPartial({
            payer: env.payer.publicKey,
            deal,
            mint: d.mint,
            vault: findVaultPda(deal),
            payerToken: getAssociatedTokenAddressSync(otherMint, env.payer.publicKey),
            payerProfile: findProfilePda(env.payer.publicKey),
            stats: findStatsPda(env.platform),
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc(),
        "MintMismatch",
      );
      await expectError(
        payer.program.methods
          .reserve()
          .accountsPartial({
            payer: env.payer.publicKey,
            deal,
            mint: otherMint,
            vault: findVaultPda(deal),
            payerToken: getAssociatedTokenAddressSync(otherMint, env.payer.publicKey),
            payerProfile: findProfilePda(env.payer.publicKey),
            stats: findStatsPda(env.platform),
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc(),
        "MintMismatch",
      );
    });

    it("tokens donated to the vault do not block settlement", async () => {
      const deal = await reserved("zaliczka");
      // a griefer sends extra tokens straight into the vault
      const vault = findVaultPda(deal);
      const { createTransferInstruction } = await import("@solana/spl-token");
      env.sendIxs(env.stranger, [
        createTransferInstruction(
          getAssociatedTokenAddressSync(env.mint, env.stranger.publicKey),
          vault,
          env.stranger.publicKey,
          1_000_000n,
        ),
      ]);
      await payer.withdraw(deal);
      expect(env.svm.getAccount(vault)).to.eq(null);
      expect(payerBal()).to.eq(start);
      expect(payeeBal()).to.eq(start + 1_000_000n);
    });
  });
});

