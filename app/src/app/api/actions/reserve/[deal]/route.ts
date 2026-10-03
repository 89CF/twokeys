import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { findProfilePda, findStatsPda, findVaultPda } from "@twokeys/sdk";
import { actionError, actionJson, actionOptions, publicOrigin } from "@/lib/server/actions";
import { parseKey, serverClient } from "@/lib/server/chain";
import { readDb } from "@/lib/server/db";
import { bytesToHex, fmtPln, fmtUsdc } from "@/lib/format";
import { headline, ruleLines } from "@/lib/rules";
import { isDecodeError, toUiDeal, type UiDeal } from "@/lib/model";
import { LEGAL_LABEL_INFO, PENALTY_INFO } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Solana Action (Blink) for reserving a TwoKeys deal: GET describes it, POST returns an unsigned `reserve` transaction
 * for the payer's account to sign. Uses the deal's own mint and platform for the accounts.
 */
async function loadDeal(param: string): Promise<{ deal: UiDeal } | { error: string; status: number }> {
  const key = parseKey(param);
  if (!key) return { error: "Invalid deal address", status: 400 };
  try {
    const deal = await serverClient().client.getDeal(key);
    return deal ? { deal: toUiDeal(deal) } : { error: "Deal not found on devnet", status: 404 };
  } catch (e) {
    if (isDecodeError(e)) return { error: "Deal not found (created by an older program version)", status: 404 };
    return { error: `Could not load deal: ${e instanceof Error ? e.message : String(e)}`, status: 500 };
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ deal: string }> }) {
  const { deal: param } = await ctx.params;
  const res = await loadDeal(param);
  if ("error" in res) return actionError(res.error, res.status);
  const { deal } = res;
  const origin = publicOrigin(req);
  const tpl = deal.tpl;
  const legal = LEGAL_LABEL_INFO[deal.legalLabel];
  const D = fmtUsdc(deal.payerAmount);

  // Optional human-readable listing title from the off-chain store (never on-chain).
  let listingTitle: string | null = null;
  try {
    const hex = bytesToHex(deal.listingHash);
    const rec = (await readDb()).listings.find((l) => l.hash === hex);
    listingTitle = ((rec?.data as { title?: string } | undefined)?.title ?? null) || null;
  } catch {
    /* optional */
  }

  const lines = ruleLines(tpl, deal, "payer", !!deal.arbiter)
    .slice(0, 3)
    .map((l) => `• ${l.when}: ${l.then}`)
    .join("\n");
  const head =
    `${listingTitle ? `${listingTitle}. ` : ""}${tpl.label}: ${tpl.amountLabel} of ${D} (≈ ${fmtPln(deal.payerAmount)}, demo rate). ` +
    (deal.payeeStake.gtn(0) ? `The ${tpl.roles.payee.toLowerCase()} has already locked ${fmtUsdc(deal.payeeStake)}. ` : "") +
    `${legal ? `${legal.name} (${legal.law})` : `${PENALTY_INFO[deal.penalty].name} rule`}. ${headline(tpl, deal, "payer")}`;

  const now = Math.floor(Date.now() / 1000);
  const open = deal.status === "offered" && now <= deal.reserveDeadline;
  const reason =
    deal.status !== "offered" ? `This deal is already ${deal.status}.` : now > deal.reserveDeadline ? "The reservation window has closed." : null;

  return actionJson({
    type: "action",
    icon: `${origin}/blink-icon.png`,
    title: `${tpl.key === "deposit" ? "Reserve" : tpl.key === "rental" ? "Rent" : tpl.key === "freelance" ? "Hire" : "Buy"}: ${D} ${tpl.amountLabel}${legal ? ` (${legal.name.toLowerCase()})` : ""}`,
    description: `${head}\n${lines}`,
    label: `Lock ${tpl.amountLabel}`,
    disabled: !open,
    ...(reason ? { error: { message: reason } } : {}),
    links: {
      actions: [{ type: "transaction", label: `Lock ${D}`, href: `/api/actions/reserve/${deal.address.toBase58()}` }],
    },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ deal: string }> }) {
  const { deal: param } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { account?: string } | null;
  let payerKey: PublicKey;
  try {
    payerKey = new PublicKey(String(body?.account ?? ""));
  } catch {
    return actionError('Invalid "account" in request body');
  }

  const res = await loadDeal(param);
  if ("error" in res) return actionError(res.error, res.status);
  const { deal } = res;
  if (deal.status !== "offered") return actionError(`This deal is already ${deal.status}.`);
  if (Math.floor(Date.now() / 1000) > deal.reserveDeadline) return actionError("The reservation window has closed.");
  if (payerKey.equals(deal.payee)) return actionError(`The ${deal.tpl.roles.payee.toLowerCase()} cannot accept their own offer.`);
  if (deal.arbiter && payerKey.equals(deal.arbiter)) return actionError("The arbiter cannot take part in the deal.");

  try {
    const { connection, client } = serverClient();
    const programId = client.programId;
    const payerTokenKey = getAssociatedTokenAddressSync(deal.mint, payerKey, true);
    const reserveIx = await client.program.methods
      .reserve()
      .accountsPartial({
        payer: payerKey,
        deal: deal.address,
        mint: deal.mint,
        vault: findVaultPda(deal.address, programId),
        payerToken: payerTokenKey,
        payerProfile: findProfilePda(payerKey, programId),
        stats: findStatsPda(deal.platform, programId),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: payerKey, blockhash, lastValidBlockHeight })
      // no-op if the payerKey already has a token account for this mint
      .add(createAssociatedTokenAccountIdempotentInstruction(payerKey, payerTokenKey, payerKey, deal.mint))
      .add(reserveIx);

    const transaction = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
    return actionJson({
      type: "transaction",
      transaction,
      message: `Locking ${fmtUsdc(deal.payerAmount)}. Track the deal at ${publicOrigin(req)}/d/${deal.address.toBase58()}`,
    });
  } catch (e) {
    return actionError(`Could not build transaction: ${e instanceof Error ? e.message : String(e)}`, 500);
  }
}

export const OPTIONS = actionOptions;
