/** Maps program / wallet errors to short, human-readable messages. */
const PROGRAM_ERRORS: Record<string, string> = {
  InvalidAmount: "The amount must be greater than zero.",
  StakeMustEqualDeposit: "Under the zadatek rule the seller stake must equal the deposit.",
  InvalidWindow: "All time windows must be positive.",
  InvalidStatus: "This action is not allowed in the deal's current state. Refresh and try again.",
  NotParty: "Only the buyer or the seller can do this.",
  NotArbiter: "Only the deal's arbiter can resolve this dispute.",
  NoArbiter: "This deal has no arbiter, so disputes are disabled.",
  DeadlinePassed: "The deadline for this action has passed.",
  DeadlineNotReached: "The deadline has not been reached yet (the chain clock may lag a few seconds).",
  SelfDeal: "Seller, buyer and arbiter must be three different wallets. Switch wallets and try again.",
  UnsupportedKind: "Unsupported deal kind.",
  AlreadyConfirmed: "You have already confirmed this deal.",
  InvalidBps: "The buyer share must be between 0% and 100%.",
  MathOverflow: "Arithmetic overflow.",
  MintMismatch: "Wrong token mint.",
};

export function friendlyError(err: unknown): string {
  const e = err as { message?: string; error?: { errorCode?: { code?: string }; errorMessage?: string }; logs?: string[] };
  const code = e?.error?.errorCode?.code;
  if (code && PROGRAM_ERRORS[code]) return PROGRAM_ERRORS[code];
  if (e?.error?.errorMessage) return e.error.errorMessage;
  const msg = String(e?.message ?? err ?? "Unknown error");
  for (const [k, v] of Object.entries(PROGRAM_ERRORS)) if (msg.includes(k)) return v;
  if (/User rejected|rejected the request|Approval Denied/i.test(msg)) return "You rejected the request in your wallet.";
  if (/insufficient funds|0x1\b|custom program error: 0x1$/i.test(msg)) return "Insufficient token balance. Get test USDC from the faucet.";
  if (/no record of a prior credit|AccountNotFound|Attempt to debit an account/i.test(msg))
    return "Your wallet has no devnet SOL for fees. Use the faucet to get some.";
  if (/blockhash not found|block height exceeded/i.test(msg)) return "The transaction expired. Please try again.";
  if (/not implemented \(stub\)/.test(msg)) return "The TwoKeys SDK is not wired up yet (stub build).";
  if (/WalletNotConnected|wallet not connected/i.test(msg)) return "Connect your wallet first.";
  return msg.length > 180 ? msg.slice(0, 180) + "…" : msg;
}
