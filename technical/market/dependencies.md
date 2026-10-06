---
title: Constructor and dependencies
description: Market constructor bindings, dependency interfaces, ownership, and upgrades.
sidebar_position: 2
---

# Constructor and dependencies

The constructor binds one market to a settlement token, a strategy vault, an oracle, a treasury, and one price stream id. This page holds `__constructor`, the views that return those bindings, and the three client interfaces the market calls on its dependencies. It also gives the `Ownable` and `Upgradeable` surface and the public exports of the crate root.

## The constructor validates, then writes

```rust
pub fn __constructor(
    e: Env,
    owner: Address,
    token: Address,
    vault: Address,
    oracle: Address,
    treasury: Address,
    feed_id: BytesN<32>,
    config: Config,
)
```

The host runs the constructor once, at deploy, and it needs no signature. `Factory::deploy` deploys the vault first, with the market address as its registered strategy, and then deploys the market. The constructor stores the vault address without calling it.

| Argument | Meaning |
| --- | --- |
| `owner` | The address stored as the `Ownable` owner. It signs every owner-only entry. |
| `token` | The settlement token. Every notional, margin, fee, and payout is in its decimals (token-dec). |
| `vault` | The strategy vault that backs the market. |
| `oracle` | The oracle contract that turns a submitted price report into a `PriceData`. |
| `treasury` | The protocol fee sink. The market reads its rate at every settlement. |
| `feed_id` | The 32-byte price stream id, fixed at deploy. Byte 0 must be `0x00` and byte 1 must be `0x03`. That `0x0003` prefix marks a V3 stream, the only report shape the oracle decodes. |
| `config` | The full `Config` singleton. |

The constructor checks in this order and traps on the first failure.

| Step | Error | Condition |
| --- | --- | --- |
| 1 | `InvalidConfig` (700) | `feed_id` byte 0 is not `0x00`, or byte 1 is not `0x03`. |
| 2 | `NegativeValueNotAllowed` (710) | Rule 1 of `Config::check_valid` fails. |
| 3 | `InvalidConfig` (700) | Any of rules 2 to 20 of `Config::check_valid` fails. |

`Config::require_valid` runs steps 2 and 3 and traps with the first violated rule. The [Config page](./config.md) numbers the rules and gives every field bound.

After the checks the constructor writes in this order:

1. `ownable::set_owner` stores `owner`. It traps `OwnerAlreadySet` (2102) if the owner key exists, which a fresh instance never meets.
2. `upgradeable::set_schema_version` stores `1`. Both keys belong to the OpenZeppelin libraries.
3. The instance keys `Token`, `Vault`, `Oracle`, `Treasury`, `FeedId`, and `Config` receive their arguments.
4. The persistent `MarketData` singleton is written as its `Default`, with `accrued_at` set to the ledger timestamp (seconds). The accrual clock therefore starts at deploy. This write extends the key's time-to-live (TTL) into the shared tier.
5. `Status` is set to `Active` (0), and the instance TTL is extended.

The constructor publishes no event. The [Storage page](./storage.md) gives the key table and the TTL tiers. The [Market status page](./status.md) gives the `Status` values.

## Five views return the stored bindings

Each view is a permissionless read of one instance key. It returns the constructor argument as stored and does not extend a TTL.

| Signature | Returns |
| --- | --- |
| `fn get_token(e: Env) -> Address` | The settlement token. |
| `fn get_vault(e: Env) -> Address` | The strategy vault. |
| `fn get_treasury(e: Env) -> Address` | The treasury. |
| `fn get_oracle(e: Env) -> Address` | The oracle. |
| `fn get_feed(e: Env) -> BytesN<32>` | The price stream id. |

## The market calls three dependency interfaces

The market declares one trait per dependency. The `contractclient` macro generates a client from each trait, and the market reaches the dependency only through that client. The three clients are `OracleClient`, `TreasuryClient`, and `VaultClient`. The market calls the settlement token through the Soroban `TokenClient`.

### The oracle verifies each price report

```rust
fn verify_price(env: Env, report: Bytes, feed_id: BytesN<32>, protective: bool) -> PriceData;
```

`OracleClient` is generated from the `Oracle` trait. The argument `report` is the serialized price report the caller submitted, and `feed_id` is the market's stored stream id. The flag `protective` selects the backward staleness window. A value of `true` applies the oracle's wider close window to the age of the observation, and `false` applies the strict trade window. The forward allowance is the trade window for both values.

The call traps on every rejection. A report that the Chainlink verifier rejects traps inside the verifier with the verifier's own error. The oracle's checks on the decoded report raise an `OracleError` code.

`Market::load` makes the call once per price-bearing entry. It skips the call while a terminal price is stored. The [Pricing page](./pricing.md) gives the `PriceData` type and the value of `protective` per entry. The [price verification page](../oracle/verify-price.md) gives the two windows, the report shape, and the oracle errors.

### The treasury supplies the fee rate

```rust
fn get_rate(e: Env) -> i128;
```

`TreasuryClient` is generated from the `TreasuryInterface` trait. The return is the treasury's share of every protocol fee (`SCALAR_18`). The call extends the treasury's instance TTL, then reads the `Rate` instance key. An unset key reads as `0`, so the call raises no error code.

The market reads the rate once per settlement. `Settlement::fee_split` makes the call for `execute_order` on an increase or a decrease, for `execute_liquidation`, and for `execute_adl`. `Settlement::compute_vault_order` makes it for each `execute_vault_order`, including a rejected order. The [Fees and settlement page](./fee-system.md) gives the legs the rate splits. The [fee rate page](../treasury/fee-rate.md) gives the bound the treasury holds the rate to.

### The vault prices shares and funds payouts

```rust
fn total_assets(e: Env) -> i128;
fn strategy_deposit(e: Env, assets: i128, receiver: Address, from: Address, net_pnl: i128) -> i128;
fn strategy_redeem(e: Env, shares: i128, receiver: Address, owner: Address, net_pnl: i128) -> i128;
fn preview_deposit(e: Env, assets: i128, net_pnl: i128) -> i128;
fn preview_redeem(e: Env, shares: i128, net_pnl: i128) -> i128;
fn balance(e: Env, account: Address) -> i128;
fn transfer(e: Env, from: Address, to: Address, amount: i128);
fn strategy_withdraw(e: Env, amount: i128);
```

`VaultClient` is generated from the `VaultInterface` trait, and the block above is the market's own declaration. The units are these.

| Value | Unit |
| --- | --- |
| `assets`, `amount` on `strategy_withdraw`, and the `total_assets` return | token-dec |
| `net_pnl` | token-dec, signed. A positive value is trader profit the vault still owes. |
| `strategy_redeem` and `preview_redeem` returns | token-dec |
| `shares`, `amount` on `transfer`, and the `balance` return | share-dec, the decimals of the vault share token |
| `strategy_deposit` and `preview_deposit` returns | share-dec |

The `total_assets` return is the raw asset balance before any mark for pending profit and loss (PnL). The previews return exactly what the matching strategy entry pays or mints at the same `net_pnl`.

The market types `to` on `transfer` as an `Address`. The share token's own entry takes a `MuxedAddress`, and an `Address` is a valid value for it. The vault runs `require_auth` on its registered strategy before `strategy_deposit`, `strategy_redeem`, and `strategy_withdraw`. That strategy is the market. A call without the market's authorization fails at the host and carries no contract error code. `transfer` needs the authorization of `from`. `total_assets`, `balance`, and the two previews need none.

The market passes itself as `from` on `strategy_deposit` and as `owner` on `strategy_redeem`. The vault therefore pulls with a direct transfer and spends no allowance. The vault raises these errors.

| Function | Error | Condition |
| --- | --- | --- |
| `strategy_deposit` | `InvalidAmount` (800) | `assets` is not positive. |
| `strategy_redeem` | `InvalidAmount` (800) | `shares` is not positive. |
| `strategy_withdraw` | `InvalidAmount` (800) | `amount` is not positive. |
| `preview_deposit` | `InvalidAmount` (800) | `assets` is negative. |
| `preview_redeem` | `InvalidAmount` (800) | `shares` is negative. |
| `strategy_deposit`, `strategy_redeem`, `preview_deposit`, `preview_redeem` | `PnlExceedsAssets` (801) | `net_pnl` is above `total_assets`. |
| `strategy_redeem` | `InsufficientBalance` (100) | `owner` holds fewer shares than `shares`. |
| `transfer` | `InsufficientBalance` (100) | `from` holds fewer shares than `amount`. |
| `transfer` | `LessThanZero` (103) | `amount` is negative. |

On `strategy_deposit` and `strategy_redeem`, code 800 is checked before code 801. `strategy_deposit` then raises the asset token's own error when `from` cannot cover `assets`. `strategy_redeem` burns the shares from `owner` before it pays, so code 100 comes first. The asset token's own error follows when the vault balance falls short of the assets. `strategy_withdraw` raises the asset token's own error when the vault balance falls short of `amount`. `total_assets` and `balance` raise no error code.

The `InsufficientBalance`, `LessThanZero`, `InsufficientAllowance` (101), and `MathOverflow` (104) codes are `FungibleTokenError` variants from stellar-tokens 0.7.2. The [share pricing page](../vault/share-pricing.md) gives the full error table of the two strategy entries. That table covers the allowance path that an `owner` other than the strategy takes and the share-mint overflow. The [share token page](../vault/share-token.md) gives the codes of `transfer`.

| Function | Where the market calls it |
| --- | --- |
| `total_assets` | `Market::load`, once per price-bearing entry. The market tracks the return as `vault_balance`. |
| `preview_deposit` | `execute_vault_order` on a deposit fill, only when the order's `min_out` is above 0. `assets` is the order amount less the deposit fee, and `net_pnl` is the capped net PnL marked adverse to the depositor. The call runs before the mint. |
| `strategy_deposit` | `execute_vault_order` on a deposit fill. `from` is the market and `receiver` is the depositor. |
| `preview_redeem` | `execute_vault_order` on a redeem fill, only when the order's `min_out` is above 0. `shares` is the order amount, and `net_pnl` is the capped net PnL marked adverse to the redeemer. The call runs before the burn. |
| `strategy_redeem` | `execute_vault_order` on a redeem fill, with `receiver` and `owner` both the market. `create_vault_order` on a `Retired` market, with `receiver` the redeemer, `owner` the market, and `net_pnl` 0. |
| `strategy_withdraw` | `execute_order` on a decrease fill, `execute_liquidation`, and `execute_adl`, each when the settled vault leg is negative. The call moves the amount from the vault to the market and lowers `total_assets`. |
| `transfer` | `create_vault_order` on a redeem, for the share escrow, and on a `Retired` market, for the shares of the instant redeem. `cancel_vault_order` on a redeem, for the share refund. `execute_vault_order` on a redeem that fails `min_out`, for the same refund. |
| `balance` | No market entry calls it. |

A fill whose quote falls below `min_out` does not reach the strategy entry. On a redeem, the market compares `min_out` with the vault's quote less the `redeem_fee` cut. On a deposit, it compares `min_out` with the quote in shares. The market then rejects the order and publishes `reject_vault_order`. It refunds the principal to the user, pays the escrowed `exec_fee` to the keeper, and removes the order. The [Vault orders page](./vault-orders.md) gives the market side of each fill, and the [events page](./events.md) gives the `reject_vault_order` payload.

Before `strategy_deposit`, the market authorizes exactly one sub-invocation as the current contract. It is `transfer` on the settlement token, from the market to the vault. The amount is the assets that reach the vault, which is the order amount less the deposit fee. The vault pulls the assets inside its own frame, where invoker authorization does not reach. The [strategy withdraw page](../vault/strategy-withdraw.md) gives the vault side of `strategy_withdraw`.

## Ownership passes in two steps and upgrade replaces code {#ownership-and-upgrade}

The market implements `Ownable` from stellar-access 0.7.2 and `Upgradeable` from stellar-contract-utils 0.7.2. The oracle, factory, treasury, and governance contracts carry the same `Ownable` surface, and the oracle and factory carry the same `upgrade`. This section is the home of both.

```rust
fn get_owner(e: &Env) -> Option<Address>
fn transfer_ownership(e: &Env, new_owner: Address, live_until_ledger: u32)
fn accept_ownership(e: &Env)
fn renounce_ownership(e: &Env)
fn upgrade(e: &Env, new_wasm_hash: BytesN<32>, operator: Address)
```

Every entry marked `#[only_owner]` runs the owner check before its body. The check reads `OwnableStorageKey::Owner` and traps with `OwnerNotSet` (2100) when the key is absent. It then requires the stored owner's authorization. A call signed by any other account fails host authorization and carries no contract error code. The constructor writes the key once, and after deploy only `accept_ownership` writes it.

| Entry | Signer | Errors |
| --- | --- | --- |
| `get_owner` | none | none |
| `transfer_ownership` | the owner | `OwnerNotSet` (2100). With a non-zero `live_until_ledger`, `InvalidLiveUntilLedger` (2201). With `0`, `NoPendingTransfer` (2200) and `InvalidPendingAccount` (2202). |
| `accept_ownership` | the pending owner | `NoPendingTransfer` (2200), `TransferExpired` (2203). |
| `renounce_ownership` | the owner | `OwnerNotSet` (2100), `TransferInProgress` (2101). |
| `upgrade` | the owner | `OwnerNotSet` (2100), `UpgradeNotOwner` (600). |

The transfer has two steps, so a mistyped address never takes the key. A non-zero `transfer_ownership` stores `PendingTransfer { address: new_owner, live_until_ledger }` in temporary storage under `OwnableStorageKey::PendingOwner`. It extends that entry to live until `live_until_ledger`, and a second call overwrites it. The value must lie between the current ledger sequence and the highest sequence a temporary entry can live to, or the call traps `InvalidLiveUntilLedger`. The value is the last ledger sequence at which `accept_ownership` succeeds.

A value of `0` cancels the pending transfer. It succeeds only when `new_owner` equals the pending address. With no pending entry it traps `NoPendingTransfer`, and with another address it traps `InvalidPendingAccount`. The current owner keeps every privilege until `accept_ownership`, signed by the pending owner, moves the key.

`renounce_ownership` removes the key for good. It traps `TransferInProgress` while an unexpired pending transfer exists. From then on every `#[only_owner]` entry, `transfer_ownership`, and `renounce_ownership` trap with `OwnerNotSet` (2100), and `get_owner` returns `None`. Every entry without an owner check keeps working. The [Ownable codes](./errors.md#ownable-codes) table gives all seven library codes and the [ownership events](./events.md#ownership-events) section gives the three event payloads. The library's own reference is [OpenZeppelin `stellar-access`](https://docs.openzeppelin.com/stellar-contracts/access/ownable).

`upgrade` carries `#[only_owner]`, and `operator` must equal the stored owner or the call traps with `UpgradeNotOwner` (600). The argument `operator` carries no authority under `ownable`, so the market pins it to the owner. The call then extends the instance TTL and replaces the contract WebAssembly (WASM) with the blob whose hash is `new_wasm_hash`. That blob must already be uploaded to the ledger. The new code takes effect after the invocation completes. Every instance, persistent, and temporary entry survives as stored, and no migration runs. The constructor stamps `UpgradeableStorageKey::SchemaVersion` with `1`, `upgrade` leaves it at `1`, and no market entry returns it. The oracle and the factory write the same body, each raising its own `UpgradeNotOwner` at code 600.

Only the constructor writes the five bindings. No owner entry can point a deployed market at another token, vault, oracle, treasury, or price stream. Only `upgrade` changes what the market does, and it keeps every binding as stored.

## The crate root exports the public market types

The crate root re-exports its contract module in full. That covers `MarketContract`, the `Market` trait, `MarketClient`, and the client and argument types the macros generate from them. The root also re-exports `AdlState`, `Config`, `MarketData`, `SidePair`, `Order`, `OrderKind`, `Position`, `Status`, `VaultOrder`, `VaultOrderKind`, and `MarketError`. It makes the `engine`, `events`, and `storage` modules public.
