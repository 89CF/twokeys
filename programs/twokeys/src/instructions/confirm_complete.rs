use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::TwoKeysError;
use crate::events::Confirmed;
use crate::settle::settle;
use crate::settle_accounts;
use crate::state::*;

/// Accounts shared by every instruction that may settle a reserved deal.
#[derive(Accounts)]
pub struct ConfirmComplete<'info> {
    /// payer or payee
    #[account(mut)]
    pub actor: Signer<'info>,

    #[account(
        mut,
        has_one = mint @ TwoKeysError::MintMismatch,
        has_one = payee @ TwoKeysError::NotParty,
        has_one = payer @ TwoKeysError::NotParty
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

    /// CHECK: must equal deal.payee (has_one); receives the vault rent.
    #[account(mut)]
    pub payee: UncheckedAccount<'info>,

    /// CHECK: must equal deal.payer (has_one).
    pub payer: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = actor,
        associated_token::mint = mint,
        associated_token::authority = payee,
        associated_token::token_program = token_program
    )]
    pub payee_token: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = actor,
        associated_token::mint = mint,
        associated_token::authority = payer,
        associated_token::token_program = token_program
    )]
    pub payer_token: Box<Account<'info, TokenAccount>>,

    #[account(mut, seeds = [PROFILE_SEED, payee.key().as_ref()], bump = payee_profile.bump)]
    pub payee_profile: Box<Account<'info, Profile>>,

    #[account(mut, seeds = [PROFILE_SEED, payer.key().as_ref()], bump = payer_profile.bump)]
    pub payer_profile: Box<Account<'info, Profile>>,

    #[account(mut, seeds = [STATS_SEED, deal.platform.as_ref()], bump = stats.bump)]
    pub stats: Box<Account<'info, PlatformStats>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ConfirmComplete>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let actor = ctx.accounts.actor.key();
    let deal_key = ctx.accounts.deal.key();
    let deal = &mut ctx.accounts.deal;

    require!(deal.status == Status::Reserved, TwoKeysError::InvalidStatus);
    require!(now <= deal.grace_end()?, TwoKeysError::DeadlinePassed);
    if actor == deal.payer {
        require!(!deal.payer_confirmed, TwoKeysError::AlreadyConfirmed);
        deal.payer_confirmed = true;
    } else if actor == deal.payee {
        require!(!deal.payee_confirmed, TwoKeysError::AlreadyConfirmed);
        deal.payee_confirmed = true;
    } else {
        return err!(TwoKeysError::NotParty);
    }
    let both = deal.payer_confirmed && deal.payee_confirmed;

    emit!(Confirmed {
        deal: deal_key,
        by: actor,
    });

    if both {
        settle(settle_accounts!(ctx.accounts), Outcome::Completed, 0, Fault::None)?;
    }
    Ok(())
}
