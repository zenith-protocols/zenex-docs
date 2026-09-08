---
title: Constructor and dependencies
sidebar_position: 2
---

# Constructor and dependencies

The constructor binds one market to a settlement token, a strategy vault, an oracle, a treasury, and one price stream id. This page holds `__constructor`, the views that return those bindings, and the three client interfaces the market calls on its dependencies.

## Constructor

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

The host runs the constructor once, at deploy, and it runs unauthenticated.

| Argument | Meaning |
| --- | --- |
| `owner` | The address stored as the `Ownable` owner. It signs every owner-only entry. |
| `token` | The settlement token. Every notional, margin, fee, and payout is in its decimals (token-dec). |
| `vault` | The strategy vault that backs the market. `Factory::deploy` deploys the vault first, with the market address as its registered strategy. |
| `oracle` | The oracle contract that turns a submitted price report into a `PriceData`. |
| `treasury` | The protocol fee sink. The market reads its rate at every settlement. |
| `feed_id` | The 32-byte price stream id, immutable after deploy. Byte 0 must be `0x00` and byte 1 must be `0x03`, the V3 stream prefix. |
| `config` | The full `Config` singleton. |

The constructor checks in this order and traps on the first failure:

| Step | Error | Condition |
| --- | --- | --- |
| 1 | `InvalidConfig` (700) | `feed_id` byte 0 is not `0x00`, or byte 1 is not `0x03`. |
| 2 | `NegativeValueNotAllowed` (710) | Rule 1 of `Config::check_valid` fails. |
| 3 | `InvalidConfig` (700) | Any of rules 2 to 20 of `Config::check_valid` fails. |

`Config::require_valid` runs steps 2 and 3 and traps with the first violated rule. The [Config page](./config.md) numbers the rules and gives every field bound.

The constructor then calls `ownable::set_owner` with `owner` and `upgradeable::set_schema_version` with 1, which write keys owned by the OpenZeppelin libraries. It writes the instance keys `Token`, `Vault`, `Oracle`, `Treasury`, `FeedId`, and `Config`. It writes the persistent `MarketData` singleton as its `Default`, with `accrued_at` set to the ledger timestamp (seconds). The accrual clock starts at deploy. It sets `Status` to `Active` (0) last, then extends the instance TTL. The `MarketData` write extends that key's own TTL into the shared persistent tier. The constructor emits no event.

The [Storage page](./storage.md) gives the key table and the TTL tiers. The [Market status page](./status.md) gives the `Status` values.

## Dependency views

Each view is a permissionless read of one instance key, and it returns the constructor argument as stored.

| Signature | Returns |
| --- | --- |
| `fn get_token(e: Env) -> Address` | The settlement token. |
| `fn get_vault(e: Env) -> Address` | The strategy vault. |
| `fn get_treasury(e: Env) -> Address` | The treasury. |
| `fn get_oracle(e: Env) -> Address` | The oracle. |
| `fn get_feed(e: Env) -> BytesN<32>` | The price stream id. |

## Client interfaces

The market declares three dependency traits. The `contractclient` macro generates one client from each trait, and the market calls the dependency through that client. The three clients are `OracleClient`, `TreasuryClient`, and `VaultClient`. The market calls the settlement token through the SDK `TokenClient`.

### Oracle

```rust
fn verify_price(env: Env, report: Bytes, feed_id: BytesN<32>, protective: bool) -> PriceData;
```

`OracleClient` is generated from the `Oracle` trait. `report` is the serialized price report the caller submitted. `feed_id` is the market's stored stream id. `protective` widens the backward staleness window. `true` applies the oracle's wider close window to the age of the observation, and `false` applies the strict trade window. The forward allowance is the trade window for both values. The call traps on every rejection. A report the Chainlink verifier rejects traps inside the verifier, with the verifier's own error. The oracle's checks on the decoded report raise an `OracleError` code.

The working set makes the call once per price-bearing entry, in `Market::load`, and skips it while a terminal price is stored. The [Pricing page](./pricing.md) gives the `PriceData` type and the value of `protective` per entry. The [price verification page](../oracle/verify-price.md) gives the two windows, the report shape, and the oracle's errors.

### Treasury

```rust
fn get_rate(e: Env) -> i128;
```

`TreasuryClient` is generated from the `TreasuryInterface` trait. The return is the treasury's share of every protocol fee (`SCALAR_18`). The call extends the treasury's instance TTL, then reads the `Rate` instance key. An unset key reads as `0`, so the call raises no error code. The market reads it once per settlement, so `execute_order`, `execute_liquidation`, `execute_adl`, and `execute_vault_order` each make the call. The [Fees and settlement page](./fee-system.md) gives the legs the rate splits. The [fee rate page](../treasury/fee-rate.md) gives the bound the treasury holds the rate to.

### Vault

```rust
fn total_assets(e: Env) -> i128;
fn strategy_deposit(e: Env, assets: i128, receiver: Address, from: Address, net_pnl: i128) -> i128;
fn strategy_redeem(e: Env, shares: i128, receiver: Address, owner: Address, net_pnl: i128) -> i128;
fn preview_redeem(e: Env, shares: i128, net_pnl: i128) -> i128;
fn balance(e: Env, account: Address) -> i128;
fn transfer(e: Env, from: Address, to: Address, amount: i128);
fn strategy_withdraw(e: Env, amount: i128);
```

`VaultClient` is generated from the `VaultInterface` trait, and the block above is the market's own declaration. The `total_assets` return, `assets`, `amount` on `strategy_withdraw`, and `net_pnl` are token-dec, and `net_pnl` is signed. `shares`, the `balance` return, and `amount` on `transfer` are in share decimals. `strategy_deposit` returns the shares minted. `strategy_redeem` and `preview_redeem` return assets in token-dec. The market types `to` on `transfer` as an `Address`. The vault's own share token entry takes a `MuxedAddress`, and an `Address` is a valid value for it. The vault accepts `strategy_deposit`, `strategy_redeem`, and `strategy_withdraw` from its registered strategy only, which is the market.

The market passes itself as `from` on `strategy_deposit` and as `owner` on `strategy_redeem`, which is the case the codes below cover. `strategy_deposit` traps `InvalidAmount` (800) on a non-positive `assets`. `strategy_redeem` traps the same code on a non-positive `shares`, and `preview_redeem` traps it on a negative `shares`. All three trap `PnlExceedsAssets` (801) when `net_pnl` is above `total_assets`. `strategy_deposit` also raises the asset token's own error when `from` cannot cover `assets`. `strategy_redeem` burns the shares from `owner` before it pays, so it raises `InsufficientBalance` (100) when `owner` holds fewer shares than `shares`. It then raises the asset token's own error when the vault balance is short of the assets it pays. `strategy_withdraw` traps `InvalidAmount` (800) on a non-positive `amount`, and the asset token's own error when the vault balance is short. `transfer` traps `InsufficientBalance` (100) when `from` holds fewer shares than `amount`, and `LessThanZero` (103) on a negative `amount`. `total_assets` and `balance` raise no error code. A call to one of the three strategy entries without the market's authorization fails at the host as an authorization error.

| Function | Where the market calls it |
| --- | --- |
| `total_assets` | `Market::load` on the working set, once per price-bearing entry. The return is the raw asset balance (token-dec) before any pending-PnL mark, and the call tracks it as `vault_balance`. |
| `strategy_deposit` | `execute_vault_order` on a deposit fill. `from` is the market and `receiver` is the depositor. |
| `strategy_redeem` | `execute_vault_order` on a redeem fill, with `receiver` and `owner` both the market. `create_vault_order` on a `Retired` market, with `receiver` the redeemer, `owner` the market, and `net_pnl` 0. |
| `strategy_withdraw` | `execute_order` on a decrease fill, `execute_liquidation`, and `execute_adl`, each when the settled vault leg is negative. The call moves the amount from the vault to the market and lowers `total_assets`. |
| `transfer` | `create_vault_order` on a redeem, for the share escrow and for the instant redeem on a `Retired` market. `cancel_vault_order` on a redeem, for the share refund. `from` authorizes the transfer. |
| `preview_redeem` | The interface declares it. No market entry calls it. |
| `balance` | The interface declares it. No market entry calls it. |

Before `strategy_deposit`, the market authorizes exactly one sub-invocation as the current contract: `transfer` on the settlement token, from the market to the vault. The amount is the assets that reach the vault, the order amount less the deposit fee. The vault pulls the assets inside its own frame, where invoker authorization does not reach.

The [Vault orders page](./vault-orders.md) gives the market side of each fill. The [share pricing page](../vault/share-pricing.md) gives the exchange rate that `net_pnl` marks, and the full error table of the two strategy entries. That table covers the allowance path an `owner` other than the strategy takes, and the share-mint overflow. The [strategy withdraw page](../vault/strategy-withdraw.md) gives the vault side of `strategy_withdraw`.

## Ownership and upgrade

The market implements `Ownable` from stellar-access and exposes the two-step surface: `get_owner`, `transfer_ownership`, `accept_ownership`, and `renounce_ownership`. It implements `Upgradeable` from stellar-contract-utils and exposes `upgrade`, gated with `#[only_owner]`. The [Ownership and upgrade page](../ownership.md) gives the signatures, the error codes, and the events.

## Crate root re-exports

The crate root re-exports its contract module in full. That covers `MarketContract`, the `Market` trait, `MarketClient`, and the client and argument types the macros generate from them. The root also re-exports `AdlState`, `Config`, `MarketData`, `SidePair`, `Order`, `OrderKind`, `Position`, `Status`, `VaultOrder`, `VaultOrderKind`, and `MarketError`. It makes the `engine`, `events`, and `storage` modules public.
