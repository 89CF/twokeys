use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::TwoKeysError;
use crate::events::OfferCancelled;
use crate::settle::{settle, SettleAccounts};
use crate::state::*;

#[derive(Accounts)]
pub struct CancelOffer<'info> {
    /// payee (anytime) or anyone after the reserve deadline
    #[account(mut)]
    pub actor: Signer<'info>,

    #[account(
        mut,
        has_one = mint @ TwoKeysError::MintMismatch,
        has_one = payee @ TwoKeysError::NotParty
    )]
    pub deal: Box<Account<'info, Deal>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [VAULT_SEED, deal.key().as_ref()],
        bump = deal.vault_bump,
        constraint = vault.mint == deal.mint @ TwoKeysError::MintMismatch
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: must equal deal.payee (has_one); receives stake + vault rent.
    #[account(mut)]
    pub payee: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = actor,
        associated_token::mint = mint,
        associated_token::authority = payee,
        associated_token::token_program = token_program
    )]
    pub payee_token: Box<Account<'info, TokenAccount>>,

    #[account(mut, seeds = [STATS_SEED, deal.platform.as_ref()], bump = stats.bump)]
    pub stats: Box<Account<'info, PlatformStats>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelOffer>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let deal_key = ctx.accounts.deal.key();
    let deal = &ctx.accounts.deal;

    require!(deal.status == Status::Offered, TwoKeysError::InvalidStatus);
    if ctx.accounts.actor.key() != deal.payee {
        require!(now > deal.reserve_deadline()?, TwoKeysError::DeadlineNotReached);
    }

    let a = &mut *ctx.accounts;
    settle(
        SettleAccounts {
            deal: &mut a.deal,
            vault: &a.vault,
            mint: &a.mint,
            payee: a.payee.to_account_info(),
            payee_token: a.payee_token.to_account_info(),
            payer_token: None,
            token_program: a.token_program.to_account_info(),
            payee_profile: None,
            payer_profile: None,
            stats: &mut a.stats,
        },
        Outcome::Cancelled,
        0,
        Fault::None,
    )?;

    emit!(OfferCancelled { deal: deal_key });
    Ok(())
}
