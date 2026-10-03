use anchor_lang::prelude::*;

pub const DEAL_SEED: &[u8] = b"deal";
pub const VAULT_SEED: &[u8] = b"vault";
pub const PROFILE_SEED: &[u8] = b"profile";
pub const STATS_SEED: &[u8] = b"stats";

pub const BPS_DENOMINATOR: u64 = 10_000;

/// What kind of deal this is. The MVP only implements `Standard` (one-shot deal,
/// used by all four templates); future mechanics (milestones, attesters) get a
/// new variant + payout fn.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum DealKind {
    Standard,
}

impl DealKind {
    pub fn from_u8(kind: u8) -> Option<Self> {
        match kind {
            0 => Some(DealKind::Standard),
            _ => None,
        }
    }
}

/// What happens to the party that backs out or stays silent past the deadline.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Penalty {
    /// the faulty party loses what they locked
    Forfeit,
    /// everybody gets their own money back
    Refund,
}

/// Where `D` goes when both parties confirm. `S` always returns to the payee.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum OnComplete {
    /// deposit / fee / price is paid to the payee
    ToPayee,
    /// security deposit returns to the payer (rental)
    ToPayer,
}

/// Legal label. Does not change the payout by itself but constrains the parameters:
/// Zadatek (PL Civil Code art. 394) => Forfeit + S == D + ToPayee; Zaliczka => Refund.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum LegalLabel {
    None,
    Zadatek,
    Zaliczka,
    TrBaglanma,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Status {
    Offered,
    Reserved,
    Disputed,
    Settled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Outcome {
    None,
    Completed,
    PayerWithdrew,
    PayeeWithdrew,
    PayerNoShow,
    PayeeNoShow,
    Expired,
    Cancelled,
    Resolved,
    DisputeTimeout,
}

/// Which party the arbiter found at fault (updates `disputes_lost`).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Fault {
    None,
    Payer,
    Payee,
}

/// One deal between a payee (creates the offer: seller / owner / freelancer) and a
/// (future) payer (locks the main amount: buyer / renter / client).
/// seeds: ["deal", payee, offer_id.to_le_bytes()]
#[account]
#[derive(InitSpace, Debug)]
pub struct Deal {
    pub kind: DealKind,
    pub payee: Pubkey,
    /// Pubkey::default() until `reserve`
    pub payer: Pubkey,
    /// Pubkey::default() = no arbiter, disputes disabled
    pub arbiter: Pubkey,
    /// integrating platform (anonymous stats only)
    pub platform: Pubkey,
    pub mint: Pubkey,
    pub offer_id: u64,
    /// D
    pub payer_amount: u64,
    /// S (may be 0)
    pub payee_stake: u64,
    pub penalty: Penalty,
    pub on_complete: OnComplete,
    pub legal_label: LegalLabel,
    /// 0=Deposit, 1=Rental, 2=Freelance, 3=Purchase (label only)
    pub template: u8,
    /// salted SHA-256 of the listing; the salt lives off-chain
    pub listing_hash: [u8; 32],
    /// salted hash of dispute evidence (zero if none)
    pub evidence_hash: [u8; 32],
    pub reserve_window_secs: i64,
    pub complete_window_secs: i64,
    pub grace_secs: i64,
    pub arbiter_window_secs: i64,
    pub created_at: i64,
    pub reserved_at: i64,
    pub complete_deadline: i64,
    pub dispute_deadline: i64,
    pub payer_confirmed: bool,
    pub payee_confirmed: bool,
    pub status: Status,
    pub outcome: Outcome,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Deal {
    pub fn reserve_deadline(&self) -> Result<i64> {
        self.created_at
            .checked_add(self.reserve_window_secs)
            .ok_or_else(|| error!(crate::errors::KaporaError::MathOverflow))
    }

    /// Last second at which confirm / withdraw / dispute are still allowed.
    pub fn grace_end(&self) -> Result<i64> {
        self.complete_deadline
            .checked_add(self.grace_secs)
            .ok_or_else(|| error!(crate::errors::KaporaError::MathOverflow))
    }

    pub fn has_arbiter(&self) -> bool {
        self.arbiter != Pubkey::default()
    }
}

/// Behaviour trail of a wallet. No identity — only counters.
/// seeds: ["profile", wallet]
#[account]
#[derive(InitSpace, Debug)]
pub struct Profile {
    pub wallet: Pubkey,
    pub completed: u32,
    pub withdrew: u32,
    pub no_show: u32,
    pub disputes_lost: u32,
    pub volume_completed: u64,
    pub bump: u8,
}

/// Anonymous aggregate counters per integrating platform.
/// seeds: ["stats", platform]
#[account]
#[derive(InitSpace, Debug)]
pub struct PlatformStats {
    pub platform: Pubkey,
    pub offers: u64,
    pub reserved: u64,
    pub completed: u64,
    pub payer_withdrew: u64,
    pub payee_withdrew: u64,
    pub no_show: u64,
    pub expired: u64,
    pub cancelled: u64,
    pub disputed: u64,
    pub resolved: u64,
    pub volume_completed: u64,
    pub bump: u8,
}

/// Arguments of `create_offer`, bundled in a struct to keep the instruction readable.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CreateOfferArgs {
    /// 0 = Standard. Anything else -> UnsupportedKind.
    pub kind: u8,
    pub offer_id: u64,
    pub payer_amount: u64,
    pub payee_stake: u64,
    pub penalty: Penalty,
    pub on_complete: OnComplete,
    pub legal_label: LegalLabel,
    pub template: u8,
    pub listing_hash: [u8; 32],
    pub reserve_window_secs: i64,
    pub complete_window_secs: i64,
    pub grace_secs: i64,
    pub arbiter_window_secs: i64,
    pub arbiter: Pubkey,
    pub platform: Pubkey,
}
