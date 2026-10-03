use anchor_lang::prelude::*;

use crate::state::{LegalLabel, OnComplete, Outcome, Penalty};

#[event]
pub struct OfferCreated {
    pub deal: Pubkey,
    pub payee: Pubkey,
    pub platform: Pubkey,
    pub payer_amount: u64,
    pub payee_stake: u64,
    pub penalty: Penalty,
    pub on_complete: OnComplete,
    pub legal_label: LegalLabel,
    pub template: u8,
}

#[event]
pub struct OfferCancelled {
    pub deal: Pubkey,
}

#[event]
pub struct Reserved {
    pub deal: Pubkey,
    pub payer: Pubkey,
    pub complete_deadline: i64,
}

#[event]
pub struct Confirmed {
    pub deal: Pubkey,
    pub by: Pubkey,
}

#[event]
pub struct DisputeOpened {
    pub deal: Pubkey,
    pub by: Pubkey,
    pub evidence_hash: [u8; 32],
}

#[event]
pub struct Settled {
    pub deal: Pubkey,
    pub outcome: Outcome,
    pub to_payer: u64,
    pub to_payee: u64,
}
