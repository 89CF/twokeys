use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::errors::KaporaError;
use crate::events::OfferCreated;
use crate::state::*;

#[derive(Accounts)]
#[instruction(args: CreateOfferArgs)]
pub struct CreateOffer<'info> {
    #[account(mut)]
    pub payee: Signer<'info>,

    #[account(
        init,
        payer = payee,
        space = 8 + Deal::INIT_SPACE,
        seeds = [DEAL_SEED, payee.key().as_ref(), &args.offer_id.to_le_bytes()],
        bump
    )]
    pub deal: Box<Account<'info, Deal>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = payee,
        seeds = [VAULT_SEED, deal.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = deal,
        token::token_program = token_program
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = payee_token.mint == mint.key() @ KaporaError::MintMismatch,
        constraint = payee_token.owner == payee.key() @ KaporaError::NotParty
    )]
    pub payee_token: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = payee,
        space = 8 + Profile::INIT_SPACE,
        seeds = [PROFILE_SEED, payee.key().as_ref()],
        bump
    )]
    pub payee_profile: Box<Account<'info, Profile>>,

    #[account(
        init_if_needed,
        payer = payee,
        space = 8 + PlatformStats::INIT_SPACE,
        seeds = [STATS_SEED, args.platform.as_ref()],
        bump
    )]
    pub stats: Box<Account<'info, PlatformStats>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateOffer>, args: CreateOfferArgs) -> Result<()> {
    let kind = DealKind::from_u8(args.kind).ok_or(KaporaError::UnsupportedKind)?;
    require!(args.payer_amount > 0, KaporaError::InvalidAmount);
    validate_legal_params(&args)?;
    require!(
        args.reserve_window_secs > 0
            && args.complete_window_secs > 0
            && args.grace_secs > 0
            && args.arbiter_window_secs > 0,
        KaporaError::InvalidWindow
    );
    let payee_key = ctx.accounts.payee.key();
    require_keys_neq!(args.arbiter, payee_key, KaporaError::SelfDeal);
    args.payer_amount
        .checked_add(args.payee_stake)
        .ok_or(KaporaError::MathOverflow)?;

    let now = Clock::get()?.unix_timestamp;
    now.checked_add(args.reserve_window_secs)
        .ok_or(KaporaError::MathOverflow)?;

    let deal_key = ctx.accounts.deal.key();
    let deal = &mut ctx.accounts.deal;
    deal.set_inner(Deal {
        kind,
        payee: payee_key,
        payer: Pubkey::default(),
        arbiter: args.arbiter,
        platform: args.platform,
        mint: ctx.accounts.mint.key(),
        offer_id: args.offer_id,
        payer_amount: args.payer_amount,
        payee_stake: args.payee_stake,
        penalty: args.penalty,
        on_complete: args.on_complete,
        legal_label: args.legal_label,
        template: args.template,
        listing_hash: args.listing_hash,
        evidence_hash: [0u8; 32],
        reserve_window_secs: args.reserve_window_secs,
        complete_window_secs: args.complete_window_secs,
        grace_secs: args.grace_secs,
        arbiter_window_secs: args.arbiter_window_secs,
        created_at: now,
        reserved_at: 0,
        complete_deadline: 0,
        dispute_deadline: 0,
        payer_confirmed: false,
        payee_confirmed: false,
        status: Status::Offered,
        outcome: Outcome::None,
        bump: ctx.bumps.deal,
        vault_bump: ctx.bumps.vault,
    });

    if args.payee_stake > 0 {
        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.payee_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.payee.to_account_info(),
                },
            ),
            args.payee_stake,
            ctx.accounts.mint.decimals,
        )?;
    }

    let profile = &mut ctx.accounts.payee_profile;
    if profile.wallet == Pubkey::default() {
        profile.wallet = payee_key;
        profile.bump = ctx.bumps.payee_profile;
    }

    let stats = &mut ctx.accounts.stats;
    if stats.platform == Pubkey::default() {
        stats.platform = args.platform;
        stats.bump = ctx.bumps.stats;
    }
    stats.offers = stats.offers.checked_add(1).ok_or(KaporaError::MathOverflow)?;

    emit!(OfferCreated {
        deal: deal_key,
        payee: payee_key,
        platform: args.platform,
        payer_amount: args.payer_amount,
        payee_stake: args.payee_stake,
        penalty: args.penalty,
        on_complete: args.on_complete,
        legal_label: args.legal_label,
        template: args.template,
    });
    Ok(())
}

/// Legal labels constrain the economic parameters (brief section 4):
/// - Zadatek (PL art. 394): Forfeit, S == D, ToPayee — so "the payee pays back double" is backed by locked funds.
/// - Zaliczka: Refund.
pub fn validate_legal_params(args: &CreateOfferArgs) -> Result<()> {
    match args.legal_label {
        LegalLabel::Zadatek => {
            require!(
                args.penalty == Penalty::Forfeit && args.on_complete == OnComplete::ToPayee,
                KaporaError::InvalidLegalParams
            );
            require!(
                args.payee_stake == args.payer_amount,
                KaporaError::StakeMustEqualDeposit
            );
        }
        LegalLabel::Zaliczka => {
            require!(args.penalty == Penalty::Refund, KaporaError::InvalidLegalParams);
        }
        LegalLabel::None | LegalLabel::TrBaglanma => {}
    }
    Ok(())
}
