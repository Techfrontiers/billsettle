//! BillSettle — bill registry for the NEAR Hackathon (Real-World Money track).
//! Slice 1 skeleton: bill creation + lookup + NEP-141 payment hook.
//! Demo scope: ONE bill flow, ONE stablecoin, testnet only.
//!
//! NOTE (read this before wiring the receipt UI): a contract CANNOT read its
//! own transaction hash — the receipt's tx hash comes from the CLIENT's
//! ft_transfer_call transaction. The frontend records that hash and shows it
//! on the receipt; the contract records payer + amount + paid timestamp.
//!
//! NOTE on ft_on_transfer: it must NOT carry #[private]. That attribute only
//! allows calls from the contract itself, but ft_on_transfer is called by the
//! stablecoin contract. Access control here is the assert below:
//! predecessor must be the configured ft_contract.

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, BorshStorageKey, PanicOnDefault, PromiseOrValue};

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq, Debug)]
#[serde(crate = "near_sdk::serde")]
pub enum BillStatus {
    Unpaid,
    Paid,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct BillItem {
    pub name: String,
    /// Smallest units, 6 decimals for a USDC-like token.
    pub amount: U128,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Bill {
    pub id: String,
    pub shop: AccountId,
    pub items: Vec<BillItem>,
    pub total: U128,
    pub status: BillStatus,
    pub payer: Option<AccountId>,
    /// Block timestamp (nanoseconds) when the bill was marked paid.
    pub paid_at: Option<u64>,
}

#[derive(BorshStorageKey, BorshSerialize)]
pub enum StorageKey {
    Bills,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct BillSettle {
    pub shop: AccountId,
    pub ft_contract: AccountId,
    pub bills: UnorderedMap<String, Bill>,
}

#[near_bindgen]
impl BillSettle {
    #[init]
    pub fn new(shop: AccountId, ft_contract: AccountId) -> Self {
        Self {
            shop,
            ft_contract,
            bills: UnorderedMap::new(StorageKey::Bills),
        }
    }

    /// Shop creates a bill. `total` must equal the sum of item amounts.
    pub fn create_bill(&mut self, id: String, items: Vec<BillItem>, total: U128) {
        assert_eq!(
            env::predecessor_account_id(),
            self.shop,
            "only the shop creates bills"
        );
        assert!(!id.is_empty(), "bill id must not be empty");
        assert!(!items.is_empty(), "a bill needs at least one item");
        assert!(self.bills.get(&id).is_none(), "bill id already exists");
        let sum: u128 = items.iter().map(|i| i.amount.0).sum();
        assert_eq!(sum, total.0, "total must equal the sum of items");
        self.bills.insert(
            &id,
            &Bill {
                id: id.clone(),
                shop: self.shop.clone(),
                items,
                total,
                status: BillStatus::Unpaid,
                payer: None,
                paid_at: None,
            },
        );
        env::log_str(&format!("bill created: {}", id));
    }

    pub fn get_bill(&self, id: String) -> Option<Bill> {
        self.bills.get(&id)
    }

    /// List bills, optionally filtered by status. Paginated for the dashboard.
    pub fn list_bills(
        &self,
        status: Option<BillStatus>,
        from_index: u64,
        limit: u64,
    ) -> Vec<Bill> {
        let keys = self.bills.keys_as_vector();
        let mut out = Vec::new();
        let mut i = from_index;
        while i < keys.len() && (out.len() as u64) < limit {
            if let Some(bill) = self.bills.get(&keys.get(i).unwrap()) {
                if status.is_none() || status.as_ref() == Some(&bill.status) {
                    out.push(bill);
                }
            }
            i += 1;
        }
        out
    }

    /// NEP-141 receiver: the stablecoin contract calls this on ft_transfer_call.
    /// `msg` must be the bill id. An exact payment flips the bill to Paid.
    /// Returns 0 = keep the whole transfer (no refund to the payer).
    /// Access control: predecessor MUST be the configured ft_contract.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        assert_eq!(
            env::predecessor_account_id(),
            self.ft_contract,
            "only the configured stablecoin contract can pay bills"
        );
        let mut bill = self.bills.get(&msg).expect("bill not found");
        assert_eq!(bill.status, BillStatus::Unpaid, "bill already paid");
        assert_eq!(
            bill.total.0, amount.0,
            "payment must equal the bill total exactly"
        );
        bill.status = BillStatus::Paid;
        bill.payer = Some(sender_id);
        bill.paid_at = Some(env::block_timestamp());
        self.bills.insert(&msg, &bill);
        env::log_str(&format!("bill paid: {} ({} units)", msg, amount.0));
        PromiseOrValue::Value(U128(0))
    }
}
