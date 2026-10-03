use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::errors::KaporaError;
use crate::events::Reserved;
use crate::state::*;

#[derive(Accounts)]
pub struct Reserve<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut, has_one = mint @ KaporaError::MintMismatch)]
    pub deal: Box<Account<'info, Deal>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [VAULT_SEED, deal.key().as_ref()],
        bump = deal.vault_bump,
        constraint = vault.mint == deal.mint @ KaporaError::MintMismatch
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = payer_token.mint == mint.key() @ KaporaError::MintMismatch,
        constraint = payer_token.owner == payer.key() @ KaporaError::NotParty
    )]
    pub payer_token: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + Profile::INIT_SPACE,
        seeds = [PROFILE_SEED, payer.key().as_ref()],
        bump
    )]
    pub payer_profile: Box<Account<'info, Profile>>,

    #[account(mut, seeds = [STATS_SEED, deal.platform.as_ref()], bump = stats.bump)]
    pub stats: Box<Account<'info, PlatformStats>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Reserve>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let payer_key = ctx.accounts.payer.key();
    let deal_key = ctx.accounts.deal.key();
    let deal = &mut ctx.accounts.deal;

    require!(deal.status == Status::Offered, KaporaError::InvalidStatus);
    require!(now <= deal.reserve_deadline()?, KaporaError::DeadlinePassed);
    require_keys_neq!(payer_key, deal.payee, KaporaError::SelfDeal);
    require_keys_neq!(payer_key, deal.arbiter, KaporaError::SelfDeal);

    deal.payer = payer_key;
    deal.reserved_at = now;
    deal.complete_deadline = now
        .checked_add(deal.complete_window_secs)
        .ok_or(KaporaError::MathOverflow)?;
    deal.grace_end()?;
    deal.status = Status::Reserved;
    let amount = deal.payer_amount;
    let complete_deadline = deal.complete_deadline;

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.payer_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    let profile = &mut ctx.accounts.payer_profile;
    if profile.wallet == Pubkey::default() {
        profile.wallet = payer_key;
        profile.bump = ctx.bumps.payer_profile;
    }

    let stats = &mut ctx.accounts.stats;
    stats.reserved = stats.reserved.checked_add(1).ok_or(KaporaError::MathOverflow)?;

    emit!(Reserved {
        deal: deal_key,
        payer: payer_key,
        complete_deadline,
    });
    Ok(())
}
