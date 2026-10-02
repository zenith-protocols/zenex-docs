---
sidebar_position: 10
title: Fees and settlement
---

# Fees and settlement

Every keeper entry that moves funds ends in one settlement, and a settlement pays four legs: the trader, the vault, the keeper, and the treasury. `Market::trade_fees` computes the two fees that a change of size pays. `Settlement` holds one action's legs and names the treasury recipient. Four builders shape the legs, and `Settlement::fee_split` builds the fee legs that three of them share. `Settlement::settle` transfers the legs. This page gives those computations, the execution fee, the keeper payout, and the credit that catches a failed trader payout.

The funding and borrowing accruals reach a settlement inside the `Fees` struct, on [Position lifecycle](./position-lifecycle.md). Their rates are on [Funding rate](./funding-rate.md) and [Borrowing rate](./borrowing-rate.md). The liquidation fee is on [Liquidation](./liquidation.md). The profit haircut that sets a decrease's `pnl` is on [PnL and the profit cap](./pnl-calculation.md). Each `Config` field named below has its bound on [Config](./config.md).

Units on this page follow [Units and scales](../units.md). Here token-dec is the settlement token's decimals, and base-dec is the scale of a base size. `SCALAR_18` is `1_000_000_000_000_000_000`, and a rate below is a ratio in that scale unless the line says otherwise. An amount is token-dec unless the line says otherwise. Every entry that reaches a settlement is permissionless. `keeper` is a reward recipient the caller names, and the contract never treats it as a signer.

## The trade fee has a base part and an impact part

The base fee charges each part of a fill by its effect on the book's token imbalance. The impact fee charges the fill's size. Both round up, so the trader never underpays.

```rust
fn trade_fees(&self, e: &Env, is_long: bool, signed_notional: i128, signed_tokens: i128) -> (i128, i128);
```

`Market::trade_fees` returns `(base_fee, impact_fee)`, both token-dec. `is_long` names the side the fill touches. `signed_notional` (token-dec) and `signed_tokens` (base-dec) carry the direction of the fill. A positive pair is an increase and a negative pair is a decrease.

`Position::increase` passes the added notional and the added tokens. The added tokens round down for a long through `math::to_tokens_floor` and up for a short through `math::to_tokens_ceil`. A partial `Position::decrease` passes the closed notional and the closed tokens, both negated. `Position::settle` passes the whole position's notional and tokens negated. A full close and a liquidation pay that whole-position fee. A partial close discards it and prices the closed fraction alone, because the impact fee is quadratic in the fill size. A fill with zero notional passes `0` for both arguments and pays neither fee.

`trade_fees` raises no `MarketError`. Its only failure is an arithmetic trap. The division by `impact_scalar` in `math::impact_fee` traps on `0`, and `Config::check_valid` holds `impact_scalar` above `0`. The division by `delta_tokens` is skipped when `delta_tokens` is `0`.

```text
worsening_notional = ceil(notional * split.worsening / delta_tokens)
improving_notional = notional - worsening_notional
base_fee   = ceil(worsening_notional * fee_dom / SCALAR_18) + ceil(improving_notional * fee_non_dom / SCALAR_18)
impact_fee = min(ceil(notional * notional / impact_scalar), ceil(notional * MAX_IMPACT_RATE / SCALAR_18))
```

Where:

- `notional` is `|signed_notional|` (token-dec).
- `delta_tokens` is `|signed_tokens|` (base-dec).
- `split` is the `SkewSplit` that `MarketData::skew_split` returns for the same side and the same token change, as [the skew split](#the-skew-split-divides-a-fill-by-its-effect-on-the-imbalance) defines it.
- `fee_dom` and `fee_non_dom` are `Config` rates. The worsening part of a fill pays `fee_dom`, and the improving part pays `fee_non_dom`.
- `impact_scalar` is a `Config` amount (token-dec).
- `MAX_IMPACT_RATE` is `SCALAR_18 / 10`, a ceiling of 10% of the notional.
- `worsening_notional` and `improving_notional` are the two parts of the notional (token-dec). `worsening_notional` maps the base-dec `split.worsening` onto the notional pro-rata, and `improving_notional` is the remainder.

The part of a fill that pushes the token imbalance away from zero pays the higher base rate, and the part that pulls it toward zero pays the lower one. The impact fee grows with the square of the whole fill and stops at 10% of it.

`worsening_notional` is `0` when `delta_tokens` is `0`, and the whole notional then pays the `fee_non_dom` rate. `math::apply_factor_ceil` computes each base leg and `math::impact_fee` computes the impact fee, so every rounding moves up. `worsening_notional` rounds up and `improving_notional` takes the exact remainder, so the two legs sum to `notional`. `Config::check_valid` holds `fee_dom` at or above `fee_non_dom`, so the rounded-up part carries the higher rate and the base fee errs high.

The rows below use a settlement token with 7 decimals, `fee_dom` of 0.5%, `fee_non_dom` of 0.3%, and `impact_scalar` of `1_000_000_000_000`. A base unit is `10_000_000` base-dec, and every fill prices at 10 settlement tokens per base unit. The book holds 10 base units long and 12 short, so `imb_pre` is `-20_000_000` base-dec.

| Fill | Notional | Split (base-dec) | `base_fee` | `impact_fee` |
| --- | --- | --- | --- | --- |
| Long increase that flips the imbalance | `500_000_000` | `worsening` `30_000_000`, `improving` `20_000_000` | `1_500_000 + 600_000 = 2_100_000` | `250_000` |
| Short increase that widens the imbalance | `500_000_000` | `worsening` `50_000_000`, `improving` `0` | `2_500_000` | `250_000` |
| Long increase that narrows the imbalance | `100_000_000` | `worsening` `0`, `improving` `10_000_000` | `300_000` | `10_000` |
| Long increase on a balanced book | `200_000_000_000` | `worsening` equals the whole change | `1_000_000_000` | `20_000_000_000` |

In the last row the quadratic term is `40_000_000_000`, and the ceiling `20_000_000_000` binds. The first fill pays 0.21 in base fee and 0.025 in impact fee, in whole tokens.

### The skew split divides a fill by its effect on the imbalance

```rust
fn skew_split(&self, is_long: bool, signed_tokens: i128) -> SkewSplit;
```

`MarketData::skew_split` splits the token change into a part that worsens the book's imbalance and a part that improves it. The imbalance is the signed value `tokens.long - tokens.short`. The funding rate uses a different measure, the skew ratio, and the name `skew_split` does not refer to it. `SkewSplit` carries `worsening` and `improving`, both base-dec and never negative. They sum to the magnitude of `signed_tokens`. The function is pure and raises no error.

`imb_pre = tokens.long - tokens.short` is the signed imbalance before the change (base-dec). `MarketData` holds the two token totals. A positive `imb_pre` means longs are dominant. `imb_post` is `imb_pre + signed_tokens` for a long change and `imb_pre - signed_tokens` for a short change.

| Case | Condition | `worsening` | `improving` |
| --- | --- | --- | --- |
| Flip | `imb_pre` and `imb_post` are both nonzero and their signs differ | The magnitude of `imb_post` | The magnitude of `imb_pre` |
| Widen | `imb_post` sits further from zero than `imb_pre` | The whole change | `0` |
| Narrow | Neither row above | `0` | The whole change |

The whole change is the magnitude of `signed_tokens`. The split follows the base-token imbalance and never the notional imbalance, so a price move alone does not change it. On a flip the run down to zero improves and the overshoot past zero worsens. A change with an exact zero at either end is not a flip, so the widen row and the narrow row decide it. A change out of a balanced book takes the widen row. A change that lands on zero takes the narrow row.

### The impact fee grows with the square of the fill

`math::impact_fee` applies to the fill's full notional on every fill, whichever way the fill moves the imbalance. The quadratic term prices the notional at the fraction `notional / impact_scalar`, a ratio of two token-dec amounts and not a `SCALAR_18` rate. That fraction grows with the fill size. It meets the ceiling at `notional == impact_scalar / 10`, and the `MAX_IMPACT_RATE` term binds above that point. The [Config](./config.md) page bounds `impact_scalar` from below, so a minimum-size fill pays a small impact rate.

## The execution fee pays the keeper for an order

`Config.exec_fee` is a flat keeper fee in the settlement token. Every order copies the live value at creation into `Order.exec_fee` or `VaultOrder.exec_fee`, so a later `set_config` leaves a resting order's fee alone. The creation escrow carries the fee in the settlement token, on top of whatever principal the order posts. [Orders](./orders.md) and [Vault orders](./vault-orders.md) give each escrow in full.

An escrowed fee leaves the market by one of four routes.

| Route | Where the fee goes |
| --- | --- |
| A fill | Added to the keeper leg. |
| A cancel, by `cancel_order` or `cancel_vault_order` | Returned to `user` with the principal. |
| A decrease order's closure sweep in `Position::store` | Folded into the trader leg. |
| A vault-order rejection in `execute_vault_order` | Paid to the keeper as the only non-zero leg. The principal returns to `user`. |

A vault order is rejected when its quote falls below `min_out`. The `RejectVaultOrder` event carries the quote, and [Rejection](./vault-orders.md#rejection) gives the path. `execute_liquidation` and `execute_adl` consume no order, so they pay no execution fee. A redeem on a `Retired` market runs inside `create_vault_order` through `instant_redeem`. That path escrows no execution fee, stores no order, and pays no keeper.

## Four legs hold every settlement

`Settlement` is the struct that holds one action's legs. It is crate-internal and is no contract entry. Every amount is token-dec.

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

`Settlement::fee_split` builds the three fee legs and leaves `trader` at `0`. `market` carries the `Config` the split reads. `fees` is the `Fees` struct that `Position::increase`, `Position::decrease`, or `Position::liquidate` returned in its outcome. `fees.base` and `fees.impact` are the pair `Market::trade_fees` returned. `fees.borrowing` is the borrowing accrual, and it is never negative. `liq_fee` is the liquidation fee, and it is `0` on every path but a liquidation. `keeper_rate` is `Config.keeper_rate`. `t_rate` is the treasury's rate, read live once per settlement through `TreasuryClient::get_rate`.

```text
split_fee = fees.base + fees.impact + liq_fee
keeper    = floor(split_fee * keeper_rate / SCALAR_18)
treasury  = floor(split_fee * t_rate / SCALAR_18) + floor(fees.borrowing * t_rate / SCALAR_18)
vault     = split_fee + fees.borrowing - keeper - treasury
```

Where `keeper_rate` and `t_rate` are `SCALAR_18` ratios and every other term is token-dec. The keeper and the treasury each take a share of the trade fee and the liquidation fee. The treasury also takes a share of borrowing, and the vault banks the rest.

`math::apply_factor_floor` computes each cut, so both cuts round down and the vault banks the remainder. Both cuts read the same gross `split_fee`, so the keeper's cut does not dilute the treasury's. The treasury's cut on borrowing floors apart from its cut on the trade fee, so the two roundings do not merge. The keeper takes no share of borrowing. `fees.funding` enters no leg at all. Paid funding stays on the contract in `credit_pool`, and earned funding becomes a claimable credit, as [Funding rate](./funding-rate.md) documents.

`fee_split` raises no `MarketError`. It reads the treasury rate through a cross-contract call, and a failure in that call traps the settlement. The builder does not raise it.

The first fill above carries through. Its `fees.base` is `2_100_000` and its `fees.impact` is `250_000`, so `split_fee` is `2_350_000`. With `keeper_rate` and `t_rate` at 10% each and `fees.borrowing` at `100_000`, the keeper leg is `235_000`. The treasury leg is `235_000 + 10_000 = 245_000`. The vault leg is `2_350_000 + 100_000 - 235_000 - 245_000 = 1_970_000`.

## Each path builds its legs from one fill

```rust
fn compute_increase_order(e: &Env, market: &Market, increase: &Increase, exec_fee: i128) -> Self;
fn compute_decrease_order(e: &Env, market: &Market, decrease: &Decrease, refund: i128, exec_fee: i128) -> Self;
fn compute_liquidation(e: &Env, market: &Market, liquidation: &Liquidation, refund: i128) -> Self;
fn compute_vault_order(e: &Env, market: &Market, vault_fee: i128, trader: i128, exec_fee: i128) -> Self;
```

Three of the four builders take an outcome struct, and `compute_vault_order` takes plain amounts. Seven settled paths reach the four builders. `compute_decrease_order` serves two paths and `compute_vault_order` serves three. The `refund` argument is the return of `Position::store`, the escrow of every decrease order the closure sweep cancelled. No builder raises a `MarketError`. Each reads the treasury rate through a cross-contract call, as `fee_split` does.

| Function | Called by | Legs on top of `fee_split` |
| --- | --- | --- |
| `compute_increase_order` | `fill_increase` | `keeper += exec_fee`. The escrowed margin stays posted on the position. |
| `compute_decrease_order` | `fill_decrease`, `execute_adl` | `trader = decrease.returned + refund`. `vault -= decrease.pnl + decrease.bad_debt`. `keeper += exec_fee`, which `execute_adl` passes as `0`. |
| `compute_liquidation` | `execute_liquidation` | `fee_split` runs with the `liq_fee`. `trader = liquidation.returned + refund`. `vault -= liquidation.pnl + liquidation.bad_debt`. No `exec_fee`, because a liquidation consumes no order. |
| `compute_vault_order` | `fill_deposit`, `fill_redeem`, `reject` | It splits `vault_fee` itself, below. `reject` passes `vault_fee` and `trader` as `0`, so only the keeper leg, `exec_fee`, is non-zero. |

`compute_vault_order` takes the fill's `vault_fee` (token-dec), the `trader` amount, and the order's `exec_fee`. `keeper_rate` is `Config.keeper_rate` and `t_rate` is the treasury's live rate, both `SCALAR_18` ratios.

```text
keeper_cut = floor(vault_fee * keeper_rate / SCALAR_18)
treasury   = floor(vault_fee * t_rate / SCALAR_18)
vault      = vault_fee - keeper_cut - treasury
keeper     = keeper_cut + exec_fee
```

`trader` is `0` on a deposit, because the depositor is paid in shares. On a redeem it is the redeemer's proceeds net of `vault_fee`. [Vault orders](./vault-orders.md) gives `vault_fee` for each path.

## `Settlement::settle` moves the legs in a fixed order

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

The draw at step 2 precedes every payout, so the market holds the assets before it pays anyone. Step 1 raises a named error before an oversized draw reaches the vault. Every transfer in steps 3 to 5 traps with the token contract's own error on a failure. Step 6 alone has a fallback, in the next section.

`market.vault_balance` starts as the `VaultClient::total_assets` value that `Market::load` read, and step 7 adds each settlement's vault leg. A vault-order fill moves the tracked balance once more, before its settlement runs. `fill_deposit` adds the assets it deposited, which is the order principal net of `vault_fee`. `fill_redeem` subtracts the assets the vault paid out.

Each entry runs its capacity gates after the settlement and reads the tracked value without a fresh call to the vault. `fill_increase` runs `Market::require_utilization` for the increased side when the order's notional is above `0`. `fill_deposit` checks `max_vault_balance`. `fill_redeem` checks the utilization of both sides and then the pending profit against `max_pnl_withdraw`. [Orders](./orders.md) and [Vault orders](./vault-orders.md) give those gates.

Step 6 can change `market.data`, so each keeper entry stores the market after the settlement.

## A failed trader payout parks as a credit

```rust
fn pay_trader(e: &Env, token: &token::Client, data: &mut MarketData, user: &Address, amount: i128);
```

`pay_trader` calls `try_transfer` from the market to `user`. On a success the tokens leave the contract. On an error the amount stays on the contract and parks as a credit. `add_claimable_credit` raises `ClaimableCredit(user)` by `amount`, in persistent storage on the user tier, and extends its time to live (TTL). [Storage](./storage.md) gives the tier values. `MarketData.credit_owed` and `MarketData.credit_pool` each rise by the same `amount`.

The two counters rise together, so the pool surplus `credit_pool - credit_owed` does not move. The parked tokens stay on the contract, so the credit stays backed. The trader collects the credit through `claim_credit`, on [Funding rate](./funding-rate.md). A receiver can fail to take the transfer, for example after it drops its trustline. A fill or a liquidation that a third party submitted still completes.

`pay_trader` has two callers. `Settlement::settle` calls it for the trader leg. The rejection of a deposit order calls it for the refund of `order.amount`, so an unreceivable refund parks as a credit and the order is still removed. A rejected redeem returns shares on the share token and does not use `pay_trader`. `try_transfer` appears in `pay_trader` only. Every other transfer a settlement makes traps on a failure.

## Each keeper entry returns its keeper leg

Four entries pay a keeper, and each returns its `keeper` leg (token-dec). `base` and `impact` are the fill's `Fees` values, `liq_fee` is the liquidation fee, and `vault_fee` is the deposit or redeem fee. `keeper_rate` is `Config.keeper_rate`, a `SCALAR_18` ratio.

| Entry | Payout |
| --- | --- |
| `execute_order` | `floor((base + impact) * keeper_rate / SCALAR_18) + exec_fee` |
| `execute_liquidation` | `floor((base + impact + liq_fee) * keeper_rate / SCALAR_18)` |
| `execute_adl` | `floor((base + impact) * keeper_rate / SCALAR_18)` |
| `execute_vault_order` on a fill | `floor(vault_fee * keeper_rate / SCALAR_18) + exec_fee` |
| `execute_vault_order` on a `min_out` rejection | `exec_fee` |

`execute_order` pays the same formula on an increase fill and on a decrease fill. `accrue` pays no keeper and returns `MarketData`. On every entry above, `keeper` is the reward recipient the caller named. The contract never authenticates that address.

## The vault leg is the residual

The vault leg banks every fee inflow that the keeper and the treasury did not take. It also funds the position's realized `pnl` and absorbs its `bad_debt`. The trader's freed margin and the swept escrow ride the trader leg and never reduce the vault leg.

An increase fill settles fee income alone, so its vault leg is never negative and `VaultInsolvent` (755) cannot fire there. A decrease fill, a liquidation, and an auto-deleveraging fill net the `fee_split` legs against the position's `pnl` and `bad_debt`. See [Auto-deleveraging](./auto-deleveraging.md) for that path. `pnl` is signed. A realized loss raises the vault leg and a realized profit lowers it. A large enough profit turns the leg negative and draws from the vault. `bad_debt` is the part of the settled fees and the loss that the freed margin could not cover. It lowers the leg, so the vault banks the covered part only.

A vault-order fill splits `vault_fee` between three recipients. The keeper cut and the treasury cut each floor a share of that one amount, and the vault leg takes the exact remainder. `Config::check_valid` holds `keeper_rate` at or below `MAX_KEEPER_RATE`, which is 50%. The treasury holds its own rate at or below 50%, under the bound on the [fee rate](../treasury/fee-rate.md) page. Under both bounds the keeper cut and the treasury cut together never exceed the amount they split, so a vault-order leg is never negative either.

Two invariants span every settlement. The vault leg goes negative only on a decrease fill, a liquidation, or an auto-deleveraging fill. Only the trader payout can fail without reverting the entry.
