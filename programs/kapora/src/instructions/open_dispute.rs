use anchor_lang::prelude::*;

use crate::errors::KaporaError;
use crate::events::DisputeOpened;
use crate::state::*;

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    pub actor: Signer<'info>,

    #[account(mut)]
    pub deal: Box<Account<'info, Deal>>,

    #[account(mut, seeds = [STATS_SEED, deal.platform.as_ref()], bump = stats.bump)]
    pub stats: Box<Account<'info, PlatformStats>>,
}

pub fn handler(ctx: Context<OpenDispute>, evidence_hash: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let actor = ctx.accounts.actor.key();
    let deal_key = ctx.accounts.deal.key();
    let deal = &mut ctx.accounts.deal;

    require!(deal.status == Status::Reserved, KaporaError::InvalidStatus);
    require!(actor == deal.payer || actor == deal.payee, KaporaError::NotParty);
    require!(deal.has_arbiter(), KaporaError::NoArbiter);
    require!(now <= deal.grace_end()?, KaporaError::DeadlinePassed);

    deal.status = Status::Disputed;
    deal.evidence_hash = evidence_hash;
    deal.dispute_deadline = now
        .checked_add(deal.arbiter_window_secs)
        .ok_or(KaporaError::MathOverflow)?;

    let stats = &mut ctx.accounts.stats;
    stats.disputed = stats.disputed.checked_add(1).ok_or(KaporaError::MathOverflow)?;

    emit!(DisputeOpened {
        deal: deal_key,
        by: actor,
        evidence_hash,
    });
    Ok(())
}
