/**
 * Test harness: runs the compiled program inside LiteSVM (in-process, with clock
 * control) and exposes it to the Anchor client / @kapora/sdk through a tiny Provider.
 */
import { type Provider, Wallet, utils } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  unpackAccount,
} from "@solana/spl-token";
import {
  type AccountInfo,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
  type Signer,
  VersionedTransaction,
} from "@solana/web3.js";
import { FailedTransactionMetadata, LiteSVM } from "litesvm";
import BN from "bn.js";
import path from "node:path";

import { KAPORA_PROGRAM_ID, KaporaClient } from "../sdk/src";

export const PROGRAM_SO = path.join(__dirname, "..", "target", "deploy", "kapora.so");
export const USDC = (ui: number) => new BN(ui).mul(new BN(1_000_000));

export class TxError extends Error {
  constructor(
    message: string,
    public logs: string[],
  ) {
    super(message);
  }
}

function send(svm: LiteSVM, tx: Transaction, payer: Keypair, signers: Signer[] = []): string {
  svm.expireBlockhash();
  tx.recentBlockhash = svm.latestBlockhash();
  tx.feePayer = payer.publicKey;
  const all = [payer, ...signers.filter((s) => !s.publicKey.equals(payer.publicKey))];
  tx.sign(...all);
  const res = svm.sendTransaction(tx);
  if (res instanceof FailedTransactionMetadata) {
    const logs = res.meta().logs();
    throw new TxError(`${res.toString()}\n${logs.join("\n")}`, logs);
  }
  return utils.bytes.bs58.encode(res.signature());
}

/** Minimal Anchor Provider backed by LiteSVM. */
export class SvmProvider implements Provider {
  readonly connection: any;
  readonly wallet: Wallet;
  readonly publicKey: PublicKey;

  constructor(
    readonly svm: LiteSVM,
    readonly payer: Keypair,
  ) {
    this.wallet = new Wallet(payer);
    this.publicKey = payer.publicKey;
    const getAccountInfo = async (pk: PublicKey): Promise<AccountInfo<Buffer> | null> => {
      const a = svm.getAccount(pk);
      return a ? { ...a, data: Buffer.from(a.data) } : null;
    };
    this.connection = {
      rpcEndpoint: "litesvm",
      commitment: "confirmed",
      getAccountInfo,
      getAccountInfoAndContext: async (pk: PublicKey) => ({
        context: { slot: Number(svm.getClock().slot) },
        value: await getAccountInfo(pk),
      }),
      getLatestBlockhash: async () => ({
        blockhash: svm.latestBlockhash(),
        lastValidBlockHeight: 0,
      }),
      getMinimumBalanceForRentExemption: async (len: number) =>
        Number(svm.minimumBalanceForRentExemption(BigInt(len))),
    };
  }

  async sendAndConfirm(tx: Transaction | VersionedTransaction, signers?: Signer[]): Promise<string> {
    if (tx instanceof VersionedTransaction) throw new Error("versioned tx not supported in tests");
    return send(this.svm, tx, this.payer, signers ?? []);
  }
}

export interface Env {
  svm: LiteSVM;
  mint: PublicKey;
  mintAuthority: Keypair;
  platform: PublicKey;
  payee: Keypair;
  payer: Keypair;
  arbiter: Keypair;
  stranger: Keypair;
  client: (kp: Keypair) => KaporaClient;
  balance: (owner: PublicKey, mint?: PublicKey) => bigint;
  warp: (seconds: number) => void;
  now: () => number;
  createMint: () => PublicKey;
  fund: (owner: PublicKey, uiAmount: number, mint?: PublicKey) => void;
  sendIxs: (payer: Keypair, ixs: TransactionInstruction[], signers?: Signer[]) => string;
}

export const START_USDC = 10_000;

export function setup(): Env {
  const svm = new LiteSVM();
  svm.addProgramFromFile(KAPORA_PROGRAM_ID, PROGRAM_SO);

  const [mintAuthority, payee, payer, arbiter, stranger] = Array.from({ length: 5 }, () =>
    Keypair.generate(),
  );
  for (const kp of [mintAuthority, payee, payer, arbiter, stranger]) {
    svm.airdrop(kp.publicKey, BigInt(100 * LAMPORTS_PER_SOL));
  }
  const sendIxs = (payer: Keypair, ixs: TransactionInstruction[], signers: Signer[] = []) =>
    send(svm, new Transaction().add(...ixs), payer, signers);

  const createMint = () => {
    const mint = Keypair.generate();
    sendIxs(
      mintAuthority,
      [
        SystemProgram.createAccount({
          fromPubkey: mintAuthority.publicKey,
          newAccountPubkey: mint.publicKey,
          lamports: Number(svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE))),
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMint2Instruction(mint.publicKey, 6, mintAuthority.publicKey, null),
      ],
      [mint],
    );
    return mint.publicKey;
  };
  const mint = createMint();

  const fund = (owner: PublicKey, uiAmount: number, m: PublicKey = mint) => {
    const ata = getAssociatedTokenAddressSync(m, owner, true);
    sendIxs(mintAuthority, [
      createAssociatedTokenAccountIdempotentInstruction(
        mintAuthority.publicKey,
        ata,
        owner,
        m,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      createMintToInstruction(m, ata, mintAuthority.publicKey, BigInt(USDC(uiAmount).toString())),
    ]);
  };
  for (const kp of [payee, payer, stranger]) fund(kp.publicKey, START_USDC);

  const balance = (owner: PublicKey, m: PublicKey = mint): bigint => {
    const ata = getAssociatedTokenAddressSync(m, owner, true);
    const acc = svm.getAccount(ata);
    if (!acc) return 0n;
    return unpackAccount(ata, { ...acc, data: Buffer.from(acc.data) }).amount;
  };

  const warp = (seconds: number) => {
    const clock = svm.getClock();
    clock.unixTimestamp = clock.unixTimestamp + BigInt(seconds);
    clock.slot = clock.slot + 1n;
    svm.setClock(clock);
  };
  // start at a realistic timestamp
  const clock = svm.getClock();
  clock.unixTimestamp = BigInt(Math.floor(Date.now() / 1000));
  svm.setClock(clock);

  return {
    svm,
    mint,
    mintAuthority,
    platform: Keypair.generate().publicKey,
    payee,
    payer,
    arbiter,
    stranger,
    client: (kp) => new KaporaClient(new SvmProvider(svm, kp)),
    balance,
    warp,
    now: () => Number(svm.getClock().unixTimestamp),
    createMint,
    fund,
    sendIxs,
  };
}

export async function expectError(p: Promise<unknown>, name: string): Promise<void> {
  try {
    await p;
  } catch (e: any) {
    const text = `${e?.message ?? ""}\n${(e?.logs ?? []).join("\n")}\n${String(e)}`;
    if (!text.includes(name)) {
      throw new Error(`expected error "${name}", got:\n${text.slice(0, 2000)}`);
    }
    return;
  }
  throw new Error(`expected error "${name}", but the transaction succeeded`);
}

export async function expectFailure(p: Promise<unknown>): Promise<void> {
  try {
    await p;
  } catch {
    return;
  }
  throw new Error("expected the transaction to fail, but it succeeded");
}
