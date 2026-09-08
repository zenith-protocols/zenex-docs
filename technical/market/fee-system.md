---
sidebar_position: 10
title: Fees and settlement
---

# Fees and settlement

Every fill settles into four legs: the trader, the vault, the keeper, and the treasury. `Market::trade_fees` computes the two fees a size change pays. `Settlement` holds one action's legs and names the treasury recipient. Four builders shape those legs, and `Settlement::fee_split` builds the fee legs that three of them share. `Settlement::settle` transfers the legs. This page gives those computations, the execution fee, the keeper payout, and the credit that catches a failed payout.

The funding and borrowing accruals reach a settlement inside the `Fees` struct, on [Position lifecycle](./position-lifecycle.md). Their rates are on [Funding rate](./funding-rate.md) and [Borrowing rate](./borrowing-rate.md). The liquidation fee is on [Liquidation](./liquidation.md). The profit haircut that sets a decrease's `pnl` is on [PnL and the profit cap](./pnl-calculation.md). Each `Config` field named below has its bound on [Config](./config.md).

Units on this page: token-dec is the settlement token's decimals, and base-dec is the scale of a base size. `SCALAR_18` is `1_000_000_000_000_000_000`, and a rate below is a ratio in that scale unless the line says otherwise. An amount is token-dec unless the line says otherwise.

## Trade fees

```rust
fn trade_fees(&self, e: &Env, is_long: bool, signed_notional: i128, signed_tokens: i128) -> (i128, i128);
```

`Market::trade_fees` returns `(base_fee, impact_fee)`, both token-dec. `is_long` names the side the fill touches. `signed_notional` (token-dec) and `signed_tokens` (base-dec) carry the direction of the fill. A positive pair is an increase and a negative pair is a decrease. `Position::increase` passes the added size. A partial `Position::decrease` passes the closed fraction negated, and `Position::settle` passes the whole position negated.

The variables are `notional = |signed_notional|` (token-dec) and `delta_tokens = |signed_tokens|` (base-dec). `split` is the `SkewSplit` that `MarketData::skew_split` returns for the same side and the same token change. `fee_dom` and `fee_non_dom` are `Config` rates. `impact_scalar` is a `Config` amount in token-dec. `MAX_IMPACT_RATE` is `SCALAR_18 / 10`, a ceiling of 10% of the notional. `worsening_notional` and `improving_notional` are the two parts of the notional (token-dec). `worsening_notional` maps the base-dec `split.worsening` onto the notional pro-rata, and `improving_notional` is the remainder.

```text
worsening_notional = ceil(notional * split.worsening / delta_tokens)
improving_notional = notional - worsening_notional
base_fee   = ceil(worsening_notional * fee_dom / SCALAR_18) + ceil(improving_notional * fee_non_dom / SCALAR_18)
impact_fee = min(ceil(notional * notional / impact_scalar), ceil(notional * MAX_IMPACT_RATE / SCALAR_18))
```

`worsening_notional` is `0` when `delta_tokens` is `0`, and the whole notional then pays the `fee_non_dom` rate. `math::apply_factor_ceil` computes each base leg and `math::impact_fee` computes the impact fee, so both roundings move up. `worsening_notional` rounds up and `improving_notional` takes the exact remainder, so the two legs sum to `notional`. `Config::check_valid` holds `fee_dom` at or above `fee_non_dom`, so the rounded-up part carries the higher rate and the base fee errs high. A margin-only fill passes `0` for both signed arguments and pays neither fee.

### The skew split

```rust
fn skew_split(&self, is_long: bool, signed_tokens: i128) -> SkewSplit;
```

`MarketData::skew_split` divides the token change by its effect on the book's imbalance. `SkewSplit` carries `worsening` and `improving`, both base-dec and never negative. They sum to the magnitude of `signed_tokens`.

`imb_pre = tokens.long - tokens.short` is the signed imbalance before the change (base-dec). `MarketData` holds the two token totals. A positive `imb_pre` means longs are dominant. `imb_post` is `imb_pre + signed_tokens` for a long change and `imb_pre - signed_tokens` for a short change.

| Case | Condition | `worsening` | `improving` |
| --- | --- | --- | --- |
| Flip | `imb_pre` and `imb_post` are both nonzero and their signs differ | The magnitude of `imb_post` | The magnitude of `imb_pre` |
| Widen | `imb_post` sits further from zero than `imb_pre` | The whole change | `0` |
| Narrow | Neither row above | `0` | The whole change |

The whole change is the magnitude of `signed_tokens`. Dominance follows the base-token imbalance and never the notional imbalance, so a price move alone does not change the split. On a flip the run down to zero improves and the overshoot past zero worsens. A change with an exact zero at either end is not a flip. The widen row and the narrow row then decide it. A change out of a balanced book takes the widen row. A change that lands on zero takes the narrow row.

### The impact fee

`math::impact_fee` applies to the fill's full notional on every fill, whichever way the fill moves the skew. The quadratic term prices the notional at the fraction `notional / impact_scalar`, a ratio of two token-dec amounts and not a `SCALAR_18` rate. That fraction grows with the fill size. It meets the ceiling at `notional == impact_scalar / 10`, and the `MAX_IMPACT_RATE` term binds above that point on the `SCALAR_18` scale. The [Config](./config.md) page holds `impact_scalar` positive and bounds it from below.

## The execution fee

`Config.exec_fee` is a flat keeper fee in the settlement token. Every order copies the live value at creation into `Order.exec_fee` or `VaultOrder.exec_fee`, so a later `set_config` leaves a resting order's fee alone. The creation escrow carries the fee in the settlement token, on top of whatever principal the order posts. [Orders](./orders.md) and [Vault orders](./vault-orders.md) give each escrow in full.

An escrowed fee leaves the market by a fill or by a cancel, and a decrease order has a third route. A fill adds the fee to the keeper leg. `cancel_order` and `cancel_vault_order` return it to `user`. The closure sweep in `Position::store` folds each swept decrease order's escrow into the trader leg. `execute_liquidation` and `execute_adl` consume no order, so they pay no execution fee. A redeem on a `Retired` market runs inside `create_vault_order` through `instant_redeem`. That path moves the user's shares to the market and burns them at once. It escrows no execution fee, stores no order, and pays no keeper.

## The settlement legs

`Settlement` is the struct that holds one action's legs. Every amount is token-dec.

| Field | Type | Meaning |
| --- | --- | --- |
| `trader` | `i128` | Paid to `user`. |
| `vault` | `i128` | A positive leg is paid to the vault. A negative leg is drawn from the vault. |
| `keeper` | `i128` | Paid to the `keeper` address the caller named. |
| `treasury` | `i128` | Paid to `treasury_address`. |
| `treasury_address` | `Address` | The `Treasury` address from instance storage. |

```rust
fn fee_split(e: &Env, market: &Market, fees: &Fees, liq_fee: i128) -> Self;
```

`Settlement::fee_split` builds the three fee legs and leaves `trader` at `0`. `market` carries the `Config` the split reads. `fees` is the `Fees` struct that `Position::increase`, `Position::decrease`, or `Position::liquidate` returned in its outcome. `fees.base` and `fees.impact` are the pair `Market::trade_fees` returned, both token-dec. `fees.borrowing` is the borrowing accrual (token-dec), and it is never negative. `liq_fee` is the liquidation fee (token-dec), and it is `0` on every path but a liquidation. `keeper_rate` is `Config.keeper_rate`, a `SCALAR_18` ratio. `t_rate` is the treasury's rate, a `SCALAR_18` ratio read live once per settlement through `TreasuryClient::get_rate`.

```text
split_fee = fees.base + fees.impact + liq_fee
keeper    = floor(split_fee * keeper_rate / SCALAR_18)
treasury  = floor(split_fee * t_rate / SCALAR_18) + floor(fees.borrowing * t_rate / SCALAR_18)
vault     = split_fee + fees.borrowing - keeper - treasury
```

`math::apply_factor_floor` computes each cut, so both cuts round down and the vault banks the remainder. The treasury's cut on borrowing floors apart from its cut on the trade fee, so the two roundings do not merge. The keeper takes no share of borrowing. `fees.funding` enters no leg at all. Paid funding stays on the contract in `credit_pool`, and earned funding becomes a claimable credit, as [Funding rate](./funding-rate.md) documents.

## The legs per path

```rust
fn compute_increase_order(e: &Env, market: &Market, increase: &Increase, exec_fee: i128) -> Self;
fn compute_decrease_order(e: &Env, market: &Market, decrease: &Decrease, refund: i128, exec_fee: i128) -> Self;
fn compute_liquidation(e: &Env, market: &Market, liquidation: &Liquidation, refund: i128) -> Self;
fn compute_vault_order(e: &Env, market: &Market, vault_fee: i128, trader: i128, exec_fee: i128) -> Self;
```

Three of the four builders take an outcome struct, and `compute_vault_order` takes plain amounts. Six settled paths reach them, because two builders each serve two paths. The `refund` argument is the return of `Position::store`, the escrow of every decrease order the closure sweep cancelled.

| Function | Called by | Legs on top of `fee_split` |
| --- | --- | --- |
| `compute_increase_order` | `fill_increase` | `keeper += exec_fee`. The escrowed margin stays posted on the position. |
| `compute_decrease_order` | `fill_decrease`, `execute_adl` | `trader = decrease.returned + refund`. `vault -= decrease.pnl + decrease.bad_debt`. `keeper += exec_fee`, which `execute_adl` passes as `0`. |
| `compute_liquidation` | `execute_liquidation` | `fee_split` runs with the `liq_fee`. `trader = liquidation.returned + refund`. `vault -= liquidation.pnl + liquidation.bad_debt`. `compute_liquidation` pays no `exec_fee`, because a liquidation consumes no order. |
| `compute_vault_order` | `fill_deposit`, `fill_redeem` | It splits `vault_fee` on its own, below. |

`compute_vault_order` does not call `fee_split`. It takes the fill's `vault_fee` (token-dec), the `trader` amount, and the order's `exec_fee`. `keeper_rate` is `Config.keeper_rate` and `t_rate` is the treasury's live rate, both `SCALAR_18` ratios:

```text
keeper_cut = floor(vault_fee * keeper_rate / SCALAR_18)
treasury   = floor(vault_fee * t_rate / SCALAR_18)
vault      = vault_fee - keeper_cut - treasury
keeper     = keeper_cut + exec_fee
```

`trader` is `0` on a deposit, because the depositor is paid in shares. On a redeem it is the redeemer's proceeds net of `vault_fee`. [Vault orders](./vault-orders.md) gives `vault_fee` for each path.

## `Settlement::settle`

```rust
fn settle(&self, e: &Env, market: &mut Market, keeper: &Address, user: &Address) -> i128;
```

`Settlement::settle` moves the legs and returns the `keeper` leg, which is the return of the keeper entry. The draw below is the magnitude of a negative `vault` leg. The steps run in this order.

| Step | Condition | Action |
| --- | --- | --- |
| 1 | The `vault` leg is negative and the draw exceeds `market.vault_balance` | Traps `VaultInsolvent` (755). |
| 2 | The `vault` leg is negative | `VaultClient::strategy_withdraw` moves the draw from the vault to the market. |
| 3 | The `vault` leg is above `0` | Transfers it to the `Vault` address. |
| 4 | The `keeper` leg is above `0` | Transfers it to the `keeper` address. |
| 5 | The `treasury` leg is above `0` | Transfers it to `treasury_address`. |
| 6 | The `trader` leg is above `0` | Runs `pay_trader`. |
| 7 | Always | Adds the `vault` leg to `market.vault_balance`. |

The draw at step 2 precedes every payout, so the market holds the assets before it pays anyone. Step 1 raises a named error before an oversized draw reaches the vault. `market.vault_balance` starts as the `VaultClient::total_assets` value that `Market::load` read, and step 7 adds each settlement's vault leg. A vault-order fill moves the tracked balance once more, before its settlement runs. `fill_deposit` adds the assets it deposited, which is the order principal net of `vault_fee`. `fill_redeem` subtracts the assets the vault paid out. The vault size cap and the two redeem exit gates run after the settlement. Each reads the tracked value and makes no fresh call to the vault. [Vault orders](./vault-orders.md) gives those gates. Step 6 can change `market.data`, so the keeper entry stores the market after the settlement.

## Failed payouts

```rust
fn pay_trader(e: &Env, token: &token::Client, data: &mut MarketData, user: &Address, amount: i128);
```

`pay_trader` calls `try_transfer` from the market to `user`. On a success the tokens leave the contract. On an error the amount stays on the contract and parks as a credit. `add_claimable_credit` raises `ClaimableCredit(user)` by `amount`. `MarketData.credit_owed` and `MarketData.credit_pool` each rise by the same `amount`.

The two counters rise together, so the pool surplus `credit_pool - credit_owed` does not move. The parked tokens stay on the contract, so the credit stays backed. The trader collects the credit through `claim_credit`, on [Funding rate](./funding-rate.md). A receiver can fail to take the transfer, for example after it drops its trustline. A fill or a liquidation that a third party submitted still completes.

`try_transfer` appears on this path only. Every other transfer a settlement makes traps on a failure.

## Keeper payout

Four entries pay a keeper, and each returns its `keeper` leg (token-dec). `base` and `impact` are the fill's `Fees` values, `liq_fee` is the liquidation fee, and `vault_fee` is the deposit or redeem fee. `keeper_rate` is `Config.keeper_rate`, a `SCALAR_18` ratio.

| Entry | Payout |
| --- | --- |
| `execute_order` | `floor((base + impact) * keeper_rate / SCALAR_18) + exec_fee` |
| `execute_liquidation` | `floor((base + impact + liq_fee) * keeper_rate / SCALAR_18)` |
| `execute_adl` | `floor((base + impact) * keeper_rate / SCALAR_18)` |
| `execute_vault_order` | `floor(vault_fee * keeper_rate / SCALAR_18) + exec_fee` |

`execute_order` pays the same formula on an increase fill and on a decrease fill. `accrue` pays no keeper and returns `MarketData`. On every entry above, `keeper` is the reward recipient the caller named. The contract never authenticates that address and never treats it as a signer.

## The vault leg

The vault leg is the residual. It banks every fee inflow that the keeper and the treasury did not take, and it funds the position's realized `pnl` and absorbs its `bad_debt`. The trader's freed margin and the swept escrow ride the trader leg and never reduce it.

An increase fill settles fee income alone, so its vault leg is never negative and `VaultInsolvent` (755) cannot fire there. A decrease fill, a liquidation, and an auto-deleveraging fill net the `fee_split` legs against the position's `pnl` and `bad_debt`. See [Auto-deleveraging](./auto-deleveraging.md) for that path. `pnl` is signed. A realized loss raises the vault leg and a realized profit lowers it. A large enough profit turns the leg negative and draws from the vault. `bad_debt` is the part of the settled fees and the loss that the freed margin could not cover. It lowers the leg, so the vault banks the covered part only.

A vault-order fill splits `vault_fee` between three recipients. The keeper cut and the treasury cut each floor a share of that one amount, and the vault leg takes the exact remainder. `keeper_rate` is bounded on [Config](./config.md), and the treasury holds its own rate under the bound on the [fee rate](../treasury/fee-rate.md) page. Under both bounds the keeper cut and the treasury cut together never exceed the amount they split, so a vault-order leg is never negative either.
