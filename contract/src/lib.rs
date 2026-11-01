//! BillSettle — bill registry for the NEAR Hackathon (Real-World Money track).
//! Slice 2: near-sdk 5.x (5.30.0). The 4.x line could not resolve — a crate it
//! needs, parity-secp256k1 0.7.0, is yanked from crates.io, so any fresh
//! 4.1.1 build fails at dependency resolution. 5.30.0 resolves cleanly.
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

use near_sdk::json_types::U128;
use near_sdk::store::IterableMap;
use near_sdk::{env, near, AccountId, PanicOnDefault, PromiseOrValue};

#[near(serializers = [borsh, json])]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BillStatus {
    Unpaid,
    Paid,
}

#[near(serializers = [borsh, json])]
#[derive(Debug, Clone)]
pub struct BillItem {
    pub name: String,
    /// Smallest units, 6 decimals for a USDC-like token.
    pub amount: U128,
}

#[near(serializers = [borsh, json])]
#[derive(Debug, Clone)]
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

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct BillSettle {
    pub shop: AccountId,
    pub ft_contract: AccountId,
    pub bills: IterableMap<String, Bill>,
}

#[near]
impl BillSettle {
    #[init]
    pub fn new(shop: AccountId, ft_contract: AccountId) -> Self {
        Self {
            shop,
            ft_contract,
            bills: IterableMap::new(b"b"),
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
        assert!(!self.bills.contains_key(&id), "bill id already exists");
        let sum: u128 = items.iter().map(|i| i.amount.0).sum();
        assert_eq!(sum, total.0, "total must equal the sum of items");
        self.bills.insert(
            id.clone(),
            Bill {
                id,
                shop: self.shop.clone(),
                items,
                total,
                status: BillStatus::Unpaid,
                payer: None,
                paid_at: None,
            },
        );
        env::log_str("bill created");
    }

    pub fn get_bill(&self, id: String) -> Option<Bill> {
        self.bills.get(&id).cloned()
    }

    /// List bills, optionally filtered by status. Paginated for the dashboard.
    /// Key order is arbitrary (trie order), not insertion order.
    pub fn list_bills(
        &self,
        status: Option<BillStatus>,
        from_index: u64,
        limit: u64,
    ) -> Vec<Bill> {
        let mut out = Vec::new();
        let mut skipped: u64 = 0;
        for key in self.bills.keys() {
            if skipped < from_index {
                skipped += 1;
                continue;
            }
            if (out.len() as u64) >= limit {
                break;
            }
            if let Some(bill) = self.bills.get(key) {
                if status.is_none() || status.as_ref() == Some(&bill.status) {
                    out.push(bill.clone());
                }
            }
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
        let bill = self.bills.get_mut(&msg).expect("bill not found");
        assert_eq!(bill.status, BillStatus::Unpaid, "bill already paid");
        assert_eq!(
            bill.total.0, amount.0,
            "payment must equal the bill total exactly"
        );
        bill.status = BillStatus::Paid;
        bill.payer = Some(sender_id);
        bill.paid_at = Some(env::block_timestamp());
        env::log_str("bill paid");
        PromiseOrValue::Value(U128(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::{testing_env, VMContext};

    fn shop() -> AccountId {
        "shop.testnet".parse().unwrap()
    }

    fn ft_contract() -> AccountId {
        "usdc-mock.testnet".parse().unwrap()
    }

    fn customer() -> AccountId {
        "customer.testnet".parse().unwrap()
    }

    fn ctx(predecessor: AccountId) -> VMContext {
        VMContextBuilder::new()
            .predecessor_account_id(predecessor)
            .build()
    }

    fn sample_items() -> Vec<BillItem> {
        vec![
            BillItem {
                name: "rice 5kg".to_string(),
                amount: U128(500),
            },
            BillItem {
                name: "fish sauce".to_string(),
                amount: U128(120),
            },
        ]
    }

    #[test]
    fn create_then_get_bill() {
        testing_env!(ctx(shop()));
        let mut c = BillSettle::new(shop(), ft_contract());
        c.create_bill("B1".to_string(), sample_items(), U128(620));
        let bill = c.get_bill("B1".to_string()).expect("bill must exist");
        assert_eq!(bill.status, BillStatus::Unpaid);
        assert_eq!(bill.total.0, 620);
        assert_eq!(bill.payer, None);
    }

    #[test]
    fn list_bills_filters_by_status() {
        testing_env!(ctx(shop()));
        let mut c = BillSettle::new(shop(), ft_contract());
        c.create_bill("B1".to_string(), sample_items(), U128(620));
        c.create_bill("B2".to_string(), sample_items(), U128(620));
        assert_eq!(c.list_bills(None, 0, 10).len(), 2);
        assert_eq!(c.list_bills(Some(BillStatus::Unpaid), 0, 10).len(), 2);
        assert_eq!(c.list_bills(Some(BillStatus::Paid), 0, 10).len(), 0);
    }

    #[test]
    fn exact_payment_flips_bill_to_paid() {
        testing_env!(ctx(shop()));
        let mut c = BillSettle::new(shop(), ft_contract());
        c.create_bill("B1".to_string(), sample_items(), U128(620));
        // Payment arrives from the stablecoin contract, not from the shop.
        testing_env!(ctx(ft_contract()));
        let refund = c.ft_on_transfer(customer(), U128(620), "B1".to_string());
        // PromiseOrValue has no PartialEq/Debug — match instead of assert_eq.
        match refund {
            PromiseOrValue::Value(v) => assert_eq!(v.0, 0),
            PromiseOrValue::Promise(_) => panic!("expected a value, not a promise"),
        }
        let bill = c.get_bill("B1".to_string()).unwrap();
        assert_eq!(bill.status, BillStatus::Paid);
        assert_eq!(bill.payer, Some(customer()));
        assert!(bill.paid_at.is_some());
    }

    #[test]
    #[should_panic(expected = "payment must equal the bill total exactly")]
    fn wrong_amount_is_rejected() {
        testing_env!(ctx(shop()));
        let mut c = BillSettle::new(shop(), ft_contract());
        c.create_bill("B1".to_string(), sample_items(), U128(620));
        testing_env!(ctx(ft_contract()));
        let _ = c.ft_on_transfer(customer(), U128(619), "B1".to_string());
    }

    #[test]
    #[should_panic(expected = "only the configured stablecoin contract can pay bills")]
    fn only_ft_contract_can_trigger_payment() {
        testing_env!(ctx(shop()));
        let mut c = BillSettle::new(shop(), ft_contract());
        c.create_bill("B1".to_string(), sample_items(), U128(620));
        // Attacker calls ft_on_transfer directly — predecessor is not the FT contract.
        testing_env!(ctx(customer()));
        let _ = c.ft_on_transfer(customer(), U128(620), "B1".to_string());
    }
}
