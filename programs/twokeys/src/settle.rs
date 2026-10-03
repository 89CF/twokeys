//! Payout table (brief section 4) and the single settlement routine.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, TokenAccount, TransferChecked};

use crate::errors::TwoKeysError;
use crate::events::Settled;
use crate::state::*;

/// Pure payout table for `DealKind::Standard` (brief section 4).
///
/// Returns `(to_payer, to_payee)`. `d` = payer amount, `s` = payee stake, `p = d + s`.
/// For `Cancelled` only the payee stake is in the vault (no payer yet), so the total
/// is `s`; otherwise it is `p`. Any rounding remainder of the bps split goes to the payee.
pub fn payout(
    penalty: Penalty,
    on_complete: OnComplete,
    outcome: Outcome,
    d: u64,
    s: u64,
    payer_bps: u16,
) -> Result<(u64, u64)> {
    let p = d.checked_add(s).ok_or(TwoKeysError::MathOverflow)?;
    let forfeit = penalty == Penalty::Forfeit;
    let res = match outcome {
        Outcome::Completed => match on_complete {
            OnComplete::ToPayee => (0, p),
            OnComplete::ToPayer => (d, s),
        },
        // payer is at fault
        Outcome::PayerWithdrew | Outcome::PayerNoShow => {
            if forfeit {
                (0, p)
            } else {
                (d, s)
            }
        }
        // payee is at fault
        Outcome::PayeeWithdrew | Outcome::PayeeNoShow => {
            if forfeit {
                (p, 0)
            } else {
                (d, s)
            }
        }
        Outcome::Expired | Outcome::DisputeTimeout => (d, s),
        Outcome::Cancelled => (0, s),
        Outcome::Resolved => {
            require!(payer_bps as u64 <= BPS_DENOMINATOR, TwoKeysError::InvalidBps);
            let to_payer = (p as u128)
                .checked_mul(payer_bps as u128)
                .ok_or(TwoKeysError::MathOverflow)?
                .checked_div(BPS_DENOMINATOR as u128)
                .ok_or(TwoKeysError::MathOverflow)?;
            let to_payer = u64::try_from(to_payer).map_err(|_| TwoKeysError::MathOverflow)?;
            let to_payee = p.checked_sub(to_payer).ok_or(TwoKeysError::MathOverflow)?;
            (to_payer, to_payee)
        }
        Outcome::None => return err!(TwoKeysError::InvalidOutcome),
    };
    Ok(res)
}

/// Amount that must be in the vault for a given outcome.
pub fn expected_total(outcome: Outcome, d: u64, s: u64) -> Result<u64> {
    if outcome == Outcome::Cancelled {
        Ok(s)
    } else {
        d.checked_add(s).ok_or_else(|| error!(TwoKeysError::MathOverflow))
    }
}

/// Dispatch on deal kind. New kinds add a branch + their own payout fn.
pub fn compute_payout(deal: &Deal, outcome: Outcome, payer_bps: u16) -> Result<(u64, u64)> {
    match deal.kind {
        DealKind::Standard => payout(
            deal.penalty,
            deal.on_complete,
            outcome,
            deal.payer_amount,
            deal.payee_stake,
            payer_bps,
        ),
    }
}

/// Everything `settle` needs. Built from each instruction's accounts with `settle_accounts!`.
pub struct SettleAccounts<'a, 'info> {
    pub deal: &'a mut Account<'info, Deal>,
    pub vault: &'a Account<'info, TokenAccount>,
    pub mint: &'a Account<'info, Mint>,
    /// receives vault rent
    pub payee: AccountInfo<'info>,
    pub payee_token: AccountInfo<'info>,
    pub payer_token: Option<AccountInfo<'info>>,
    pub token_program: AccountInfo<'info>,
    pub payee_profile: Option<&'a mut Account<'info, Profile>>,
    pub payer_profile: Option<&'a mut Account<'info, Profile>>,
    pub stats: &'a mut Account<'info, PlatformStats>,
}

#[macro_export]
macro_rules! settle_accounts {
    ($a:expr) => {
        $crate::settle::SettleAccounts {
            deal: &mut *$a.deal,
            vault: &*$a.vault,
            mint: &*$a.mint,
            payee: $a.payee.to_account_info(),
            payee_token: $a.payee_token.to_account_info(),
            payer_token: Some($a.payer_token.to_account_info()),
            token_program: $a.token_program.to_account_info(),
            payee_profile: Some(&mut *$a.payee_profile),
            payer_profile: Some(&mut *$a.payer_profile),
            stats: &mut *$a.stats,
        }
    };
}

/// Pays out the vault according to `outcome`, closes the vault, marks the deal
/// `Settled` and updates profiles + platform stats. Runs at most once per deal.
pub fn settle(a: SettleAccounts, outcome: Outcome, payer_bps: u16, fault: Fault) -> Result<()> {
    let deal = a.deal;
    require!(deal.status != Status::Settled, TwoKeysError::InvalidStatus);

    let d = deal.payer_amount;
    let s = deal.payee_stake;
    let total = expected_total(outcome, d, s)?;
    let (to_payer, to_payee) = compute_payout(deal, outcome, payer_bps)?;
    require!(
        to_payer.checked_add(to_payee).ok_or(TwoKeysError::MathOverflow)? == total,
        TwoKeysError::PayoutMismatch
    );
    require_keys_eq!(a.vault.mint, deal.mint, TwoKeysError::MintMismatch);
    // Tokens sent to the vault by third parties would block closing it; they go to the payee.
    let surplus = a
        .vault
        .amount
        .checked_sub(total)
        .ok_or(TwoKeysError::PayoutMismatch)?;
    let payee_amount = to_payee.checked_add(surplus).ok_or(TwoKeysError::MathOverflow)?;

    let payee_key = deal.payee;
    let offer_bytes = deal.offer_id.to_le_bytes();
    let bump = [deal.bump];
    let seeds: &[&[u8]] = &[DEAL_SEED, payee_key.as_ref(), &offer_bytes, &bump];
    let signer: &[&[&[u8]]] = &[seeds];
    let deal_info = deal.to_account_info();
    let decimals = a.mint.decimals;

    if to_payer > 0 {
        let payer_token = a.payer_token.clone().ok_or(TwoKeysError::NotParty)?;
        token::transfer_checked(
            CpiContext::new_with_signer(
                a.token_program.clone(),
                TransferChecked {
                    from: a.vault.to_account_info(),
                    mint: a.mint.to_account_info(),
                    to: payer_token,
                    authority: deal_info.clone(),
                },
                signer,
            ),
            to_payer,
            decimals,
        )?;
    }
    if payee_amount > 0 {
        token::transfer_checked(
            CpiContext::new_with_signer(
                a.token_program.clone(),
                TransferChecked {
                    from: a.vault.to_account_info(),
                    mint: a.mint.to_account_info(),
                    to: a.payee_token.clone(),
                    authority: deal_info.clone(),
                },
                signer,
            ),
            payee_amount,
            decimals,
        )?;
    }
    token::close_account(CpiContext::new_with_signer(
        a.token_program.clone(),
        CloseAccount {
            account: a.vault.to_account_info(),
            destination: a.payee.clone(),
            authority: deal_info,
        },
        signer,
    ))?;

    deal.status = Status::Settled;
    deal.outcome = outcome;

    let mut payer_profile = a.payer_profile;
    let mut payee_profile = a.payee_profile;
    let stats = a.stats;
    match outcome {
        Outcome::Completed => {
            for p in [payer_profile.as_deref_mut(), payee_profile.as_deref_mut()]
                .into_iter()
                .flatten()
            {
                p.completed = p.completed.checked_add(1).ok_or(TwoKeysError::MathOverflow)?;
                p.volume_completed = p
                    .volume_completed
                    .checked_add(d)
                    .ok_or(TwoKeysError::MathOverflow)?;
            }
            stats.completed = inc(stats.completed)?;
            stats.volume_completed = stats
                .volume_completed
                .checked_add(d)
                .ok_or(TwoKeysError::MathOverflow)?;
        }
        Outcome::PayerWithdrew => {
            if let Some(p) = payer_profile.as_deref_mut() {
                p.withdrew = inc32(p.withdrew)?;
            }
            stats.payer_withdrew = inc(stats.payer_withdrew)?;
        }
        Outcome::PayeeWithdrew => {
            if let Some(p) = payee_profile.as_deref_mut() {
                p.withdrew = inc32(p.withdrew)?;
            }
            stats.payee_withdrew = inc(stats.payee_withdrew)?;
        }
        Outcome::PayerNoShow => {
            if let Some(p) = payer_profile.as_deref_mut() {
                p.no_show = inc32(p.no_show)?;
            }
            stats.no_show = inc(stats.no_show)?;
        }
        Outcome::PayeeNoShow => {
            if let Some(p) = payee_profile.as_deref_mut() {
                p.no_show = inc32(p.no_show)?;
            }
            stats.no_show = inc(stats.no_show)?;
        }
        Outcome::Expired => {
            for p in [payer_profile.as_deref_mut(), payee_profile.as_deref_mut()]
                .into_iter()
                .flatten()
            {
                p.no_show = inc32(p.no_show)?;
            }
            stats.expired = inc(stats.expired)?;
        }
        Outcome::Cancelled => {
            stats.cancelled = inc(stats.cancelled)?;
        }
        Outcome::Resolved => {
            let loser = match fault {
                Fault::Payer => payer_profile.as_deref_mut(),
                Fault::Payee => payee_profile.as_deref_mut(),
                Fault::None => None,
            };
            if let Some(p) = loser {
                p.disputes_lost = inc32(p.disputes_lost)?;
            }
            stats.resolved = inc(stats.resolved)?;
        }
        Outcome::DisputeTimeout | Outcome::None => {}
    }

    emit!(Settled {
        deal: deal.key(),
        outcome,
        to_payer,
        to_payee: payee_amount,
    });
    Ok(())
}

fn inc(v: u64) -> Result<u64> {
    v.checked_add(1).ok_or_else(|| error!(TwoKeysError::MathOverflow))
}

fn inc32(v: u32) -> Result<u32> {
    v.checked_add(1).ok_or_else(|| error!(TwoKeysError::MathOverflow))
}

#[cfg(test)]
mod tests {
    use super::*;

    const D: u64 = 2_000_000_000;
    const S: u64 = 2_000_000_000;
    const P: u64 = D + S;

    fn f(o: Outcome) -> (u64, u64) {
        payout(Penalty::Forfeit, OnComplete::ToPayee, o, D, S, 0).unwrap()
    }
    fn r(o: Outcome) -> (u64, u64) {
        payout(Penalty::Refund, OnComplete::ToPayee, o, D, S, 0).unwrap()
    }

    #[test]
    fn completed_to_payee() {
        assert_eq!(f(Outcome::Completed), (0, P));
        assert_eq!(r(Outcome::Completed), (0, P));
    }

    #[test]
    fn completed_to_payer_rental() {
        for pen in [Penalty::Forfeit, Penalty::Refund] {
            assert_eq!(
                payout(pen, OnComplete::ToPayer, Outcome::Completed, D, S, 0).unwrap(),
                (D, S)
            );
        }
        assert_eq!(
            payout(Penalty::Forfeit, OnComplete::ToPayer, Outcome::Completed, D, 0, 0).unwrap(),
            (D, 0)
        );
    }

    #[test]
    fn payer_withdrew() {
        assert_eq!(f(Outcome::PayerWithdrew), (0, P));
        assert_eq!(r(Outcome::PayerWithdrew), (D, S));
    }

    #[test]
    fn payee_withdrew() {
        assert_eq!(f(Outcome::PayeeWithdrew), (P, 0));
        assert_eq!(r(Outcome::PayeeWithdrew), (D, S));
    }

    #[test]
    fn payer_no_show() {
        assert_eq!(f(Outcome::PayerNoShow), (0, P));
        assert_eq!(r(Outcome::PayerNoShow), (D, S));
        // freelance: S = 0, client silent -> freelancer gets the fee
        assert_eq!(
            payout(Penalty::Forfeit, OnComplete::ToPayee, Outcome::PayerNoShow, D, 0, 0).unwrap(),
            (0, D)
        );
    }

    #[test]
    fn payee_no_show() {
        assert_eq!(f(Outcome::PayeeNoShow), (P, 0));
        assert_eq!(r(Outcome::PayeeNoShow), (D, S));
    }

    #[test]
    fn expired() {
        assert_eq!(f(Outcome::Expired), (D, S));
        assert_eq!(r(Outcome::Expired), (D, S));
    }

    #[test]
    fn cancelled() {
        assert_eq!(f(Outcome::Cancelled), (0, S));
        assert_eq!(r(Outcome::Cancelled), (0, S));
        assert_eq!(expected_total(Outcome::Cancelled, D, S).unwrap(), S);
    }

    #[test]
    fn resolved() {
        let res = payout(Penalty::Forfeit, OnComplete::ToPayee, Outcome::Resolved, D, S, 7_000).unwrap();
        assert_eq!(res, (P * 7 / 10, P * 3 / 10));
        let res = payout(Penalty::Refund, OnComplete::ToPayer, Outcome::Resolved, D, S, 10_000).unwrap();
        assert_eq!(res, (P, 0));
        let res = payout(Penalty::Refund, OnComplete::ToPayee, Outcome::Resolved, D, S, 0).unwrap();
        assert_eq!(res, (0, P));
    }

    #[test]
    fn resolved_rounding_goes_to_payee() {
        let res = payout(Penalty::Refund, OnComplete::ToPayee, Outcome::Resolved, 2, 1, 3_333).unwrap();
        assert_eq!(res, (0, 3));
        let res = payout(Penalty::Refund, OnComplete::ToPayee, Outcome::Resolved, 7, 6, 5_000).unwrap();
        assert_eq!(res, (6, 7));
    }

    #[test]
    fn resolved_invalid_bps() {
        assert!(payout(Penalty::Forfeit, OnComplete::ToPayee, Outcome::Resolved, D, S, 10_001).is_err());
    }

    #[test]
    fn dispute_timeout() {
        assert_eq!(f(Outcome::DisputeTimeout), (D, S));
        assert_eq!(r(Outcome::DisputeTimeout), (D, S));
    }

    #[test]
    fn none_is_error() {
        assert!(payout(Penalty::Forfeit, OnComplete::ToPayee, Outcome::None, D, S, 0).is_err());
    }

    #[test]
    fn totals_always_match() {
        let outcomes = [
            Outcome::Completed,
            Outcome::PayerWithdrew,
            Outcome::PayeeWithdrew,
            Outcome::PayerNoShow,
            Outcome::PayeeNoShow,
            Outcome::Expired,
            Outcome::Cancelled,
            Outcome::Resolved,
            Outcome::DisputeTimeout,
        ];
        for pen in [Penalty::Forfeit, Penalty::Refund] {
            for oc in [OnComplete::ToPayee, OnComplete::ToPayer] {
                for o in outcomes {
                    for bps in [0u16, 1, 3_333, 5_000, 9_999, 10_000] {
                        for (d, s) in [(1_234_567u64, 7_654_321u64), (5, 0)] {
                            let (b, x) = payout(pen, oc, o, d, s, bps).unwrap();
                            assert_eq!(b + x, expected_total(o, d, s).unwrap());
                        }
                    }
                }
            }
        }
    }
}
