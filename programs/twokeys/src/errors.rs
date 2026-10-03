use anchor_lang::prelude::*;

#[error_code]
pub enum TwoKeysError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Zadatek requires payee stake == payer amount")]
    StakeMustEqualDeposit,
    #[msg("Parameters violate the legal label (zadatek: Forfeit + S == D + ToPayee; zaliczka: Refund)")]
    InvalidLegalParams,
    #[msg("All time windows must be > 0")]
    InvalidWindow,
    #[msg("Instruction not allowed in the current deal status")]
    InvalidStatus,
    #[msg("Signer is not a party of this deal")]
    NotParty,
    #[msg("Signer is not the arbiter of this deal")]
    NotArbiter,
    #[msg("This deal has no arbiter; disputes are disabled")]
    NoArbiter,
    #[msg("Deadline has passed")]
    DeadlinePassed,
    #[msg("Deadline has not been reached yet")]
    DeadlineNotReached,
    #[msg("Buyer and seller must be different wallets")]
    SelfDeal,
    #[msg("Unsupported deal kind")]
    UnsupportedKind,
    #[msg("Already confirmed")]
    AlreadyConfirmed,
    #[msg("buyer_bps must be <= 10000")]
    InvalidBps,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Token mint does not match the deal mint")]
    MintMismatch,
    #[msg("Payout does not add up to the vault total")]
    PayoutMismatch,
    #[msg("Invalid outcome for payout")]
    InvalidOutcome,
}
