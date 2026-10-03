//! Kapora Protocol — trustless deposits for marketplaces.
//!
//! A payer locks a deposit, the payee locks a matching stake, and the legal
//! deposit rule (zadatek / zaliczka) is enforced by the program instead of a court.

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod settle;
pub mod state;

pub use instructions::*;
pub use state::*;

declare_id!("AkQXPVXUYDqyNUVNAsYGYXy9sHQR636xcuJbAJkiJe5F");

#[program]
pub mod kapora {
    use super::*;

    /// Payee opens an offer and locks their stake `S` in the vault.
    pub fn create_offer(ctx: Context<CreateOffer>, args: CreateOfferArgs) -> Result<()> {
        instructions::create_offer::handler(ctx, args)
    }

    /// Payee cancels anytime while `Offered`; anyone may after the reserve deadline.
    pub fn cancel_offer(ctx: Context<CancelOffer>) -> Result<()> {
        instructions::cancel_offer::handler(ctx)
    }

    /// Payer locks deposit `D` and reserves the offer.
    pub fn reserve(ctx: Context<Reserve>) -> Result<()> {
        instructions::reserve::handler(ctx)
    }

    /// Payer or payee confirms the deal happened. Second confirmation settles.
    pub fn confirm_complete(ctx: Context<ConfirmComplete>) -> Result<()> {
        instructions::confirm_complete::handler(ctx)
    }

    /// Payer or payee backs out; the legal rule decides who gets what.
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        instructions::withdraw::handler(ctx)
    }

    /// Anyone may settle after `complete_deadline + grace_secs`.
    pub fn claim_after_deadline(ctx: Context<ClaimAfterDeadline>) -> Result<()> {
        instructions::claim_after_deadline::handler(ctx)
    }

    /// Payer or payee escalates to the arbiter with a salted evidence hash.
    pub fn open_dispute(ctx: Context<OpenDispute>, evidence_hash: [u8; 32]) -> Result<()> {
        instructions::open_dispute::handler(ctx, evidence_hash)
    }

    /// Arbiter splits the vault (`payer_bps` / 10000 to the payer) and assigns fault.
    pub fn resolve(ctx: Context<Resolve>, payer_bps: u16, fault: Fault) -> Result<()> {
        instructions::resolve::handler(ctx, payer_bps, fault)
    }

    /// Anyone may refund both sides if the arbiter stays silent.
    pub fn expire_dispute(ctx: Context<ExpireDispute>) -> Result<()> {
        instructions::expire_dispute::handler(ctx)
    }
}
