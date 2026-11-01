//! BillSettle Demo Dollar (BSDD) — mock NEP-141 fungible token for the
//! BillSettle demo on NEAR TESTNET. Built on near-contract-standards 5.30.0
//! (manual trait impls — the impl_fungible_token_* macros are deprecated).
//! NOT real USDC, NOT mainnet, demo only. The owner (shop) can mint.

use near_contract_standards::fungible_token::core::FungibleTokenCore;
use near_contract_standards::fungible_token::metadata::{
    FT_METADATA_SPEC, FungibleTokenMetadata, FungibleTokenMetadataProvider,
};
use near_contract_standards::fungible_token::resolver::FungibleTokenResolver;
use near_contract_standards::fungible_token::FungibleToken;
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::json_types::U128;
use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault, PromiseOrValue};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct TokenContract {
    pub owner: AccountId,
    pub token: FungibleToken,
    pub metadata: FungibleTokenMetadata,
}

#[near]
impl TokenContract {
    #[init]
    pub fn new(owner_id: AccountId, total_supply: U128) -> Self {
        let mut token = FungibleToken::new(b"t");
        token.internal_register_account(&owner_id);
        token.internal_deposit(&owner_id, total_supply.0);
        Self {
            owner: owner_id,
            token,
            metadata: FungibleTokenMetadata {
                spec: FT_METADATA_SPEC.to_string(),
                name: "BillSettle Demo Dollar".to_string(),
                symbol: "BSDD".to_string(),
                icon: None,
                reference: None,
                reference_hash: None,
                decimals: 6,
            },
        }
    }

    /// Owner-only mint (demo setup). Registers the account first if needed.
    pub fn mint(&mut self, account_id: AccountId, amount: U128) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner,
            "only the owner can mint"
        );
        if self.token.accounts.get(&account_id).is_none() {
            self.token.internal_register_account(&account_id);
        }
        self.token.internal_deposit(&account_id, amount.0);
    }
}

#[near]
impl FungibleTokenCore for TokenContract {
    #[payable]
    fn ft_transfer(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
    ) {
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for TokenContract {
    #[private]
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        // #[private] IS correct here: this is a callback the token contract
        // makes to itself, so predecessor == current account.
        let (used_amount, _burned) =
            self.token.internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        used_amount.into()
    }
}

#[near]
impl StorageManagement for TokenContract {
    #[payable]
    fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        self.token.internal_storage_unregister(force).is_some()
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for TokenContract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.clone()
    }
}
