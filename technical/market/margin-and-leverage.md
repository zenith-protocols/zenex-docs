---
sidebar_position: 8
title: Margin and leverage
description: Initial and maintenance requirements, settled equity, leverage, and capacity gates.
---

# Margin and leverage

This page covers the two margin lines and the settled equity that one of them measures. It covers the checks a changed row must pass and the leverage ceiling. It also covers the two caps that bound a side. Amounts follow [Units and scales](../units.md), and each value below carries its unit inline.

The functions on this page are internal to the `market`, so none has a signer of its own. `Position::increase` runs under `execute_order`. `Position::decrease` runs under `execute_order` and `execute_adl`. `Position::liquidate` runs under `execute_liquidation`. The `keeper` argument of each entry is a reward recipient and never an authorizer.

## Two margin lines measure different things {#the-two-margin-lines}

Every position row is held to an initial margin line and a maintenance margin line. Both are `SCALAR_18` fractions of the row's `notional`, and both are `Config` fields. Validation keeps `liq_fee` below `maintenance_margin` and `maintenance_margin` below `init_margin`.

| Line | `Config` field | Measured against | Checked in |
| --- | --- | --- | --- |
| Initial margin | `init_margin` | `Position.margin`, free of PnL | `Position::require_valid` |
| Maintenance margin | `maintenance_margin` | The settled equity of the whole row | `Position::is_liquidatable` |

Both lines size their requirement through one private helper.

```rust
fn margin_requirement(&self, e: &Env, margin_ratio: i128) -> i128;
```

`Position::margin_requirement` returns `ceil(notional * margin_ratio / SCALAR_18)` (token-dec) through `math::apply_factor_ceil`. `notional` is the row's size (token-dec). `margin_ratio` is `init_margin` or `maintenance_margin` (`SCALAR_18`). The result rounds up, so a requirement is never understated.

The initial line reads `Position.margin`, the margin that remains after the debits of the path that produced the row. [Position lifecycle](./position-lifecycle.md) documents those debits. Unrealized profit and loss (PnL) does not count toward this line, so a paper profit does not raise the size a row may carry.

The maintenance line reads settled equity, and equity does include PnL. The initial line asks whether the posted margin backs the size. The maintenance line asks whether the row can still pay its costs and its losses. The protocol carries both because the two questions have different answers on the same row.

## Settled equity is margin less debit plus PnL {#settled-equity}

```rust
fn settle(&mut self, e: &Env, market: &mut Market, user: &Address, is_long: bool) -> Settled;
```

`Position::settle` prices the whole row as if it closed at the call's price and returns `Settled { fees, pnl, equity }`. `is_long` selects the side. It fixes the accrual indices, the exit side of the price, and the sign of the PnL. The exit side is `bid` for a long and `ask` for a short. `user` is the account credited with any funding the row earns.

The call banks the funding and borrowing accruals first, through `Position::settle_accruals`. It then reads the full-close trade fees from `Market::trade_fees` at `-notional` (token-dec) and `-tokens` (base-dec). It passes the raw PnL through `Market::haircut_pnl`. The formula for the equity follows.

$$
\text{equity} = \text{margin} - \text{debit} + \text{pnl}
$$

Where:

- `margin` is `Position.margin` as stored at the call (token-dec). `Position::settle_accruals` does not change it.
- `debit` is `Fees::debit` over the itemized `fees` (token-dec). It equals `base + impact + borrowing + max(funding, 0)`. [Fees and settlement](./fee-system.md) documents `base` and `impact`. [Funding rate](./funding-rate.md) and [Borrowing rate](./borrowing-rate.md) document the two accruals.
- `pnl` is the post-haircut PnL of the full size, marked at the exit side of the call's price (token-dec). [PnL and the profit cap](./pnl-calculation.md) documents the marks and the haircut.

Equity is the amount the row would return if it closed at the call's price. The value is signed. A row whose costs outrun its margin settles negative, and the shortfall becomes bad debt on a close. Earned funding does not enter the equity, because it becomes claimable credit and never joins the margin.

The table shows a row of `1,000` notional on `100` margin, with a `debit` of `2` and a maintenance requirement of `50`, which is 5% of the notional. The values are whole settlement tokens and illustrate the formula only.

| `pnl` | `equity` | Requirement | `is_liquidatable` |
| --- | --- | --- | --- |
| +20 | 118 | 50 | false |
| -30 | 68 | 50 | false |
| -48 | 50 | 50 | false |
| -49 | 49 | 50 | true |

A second settle inside one call banks nothing, because the row's index snapshots already equal the market indices. The margin already carries the first settle's debits, so the second settle does not count them twice. It re-prices the trade fees and the PnL against the current state.

```rust
fn is_liquidatable(&self, e: &Env, market: &Market, settled: &Settled) -> bool;
```

`Position::is_liquidatable` returns `settled.equity < ceil(notional * maintenance_margin / SCALAR_18)`. A row exactly at the requirement is not liquidatable. [Liquidation](./liquidation.md) documents the entry that acts on this predicate.

## Four checks run on every row an action leaves behind {#post-action-validity}

```rust
fn require_valid(&mut self, e: &Env, market: &mut Market, user: &Address, is_long: bool, is_adl: bool);
```

`Position::require_valid` runs on the row an action leaves behind. `user` and `is_long` address the row and reach `Position::settle` in check 4. `Position::increase` runs it with `is_adl` false. `Position::decrease` runs it on a partial survivor with the caller's `is_adl`, and a margin-only withdrawal is such a survivor. A full close never runs it, because no row remains.

`min_position_notional` and `max_position_notional` are token-dec bounds on the row's notional. The function traps on the first violation. The order is below.

| Order | Condition | Error |
| --- | --- | --- |
| 1 | `notional < min_position_notional` | `NotionalBelowMinimum` (711) |
| 2 | `notional > max_position_notional` | `NotionalAboveMaximum` (712) |
| 3 | `!is_adl` and `margin < ceil(notional * init_margin / SCALAR_18)` | `InsufficientMargin` (713) |
| 4 | settled equity `< ceil(notional * maintenance_margin / SCALAR_18)` | `PositionLiquidatable` (723) |

Check 4 runs `Position::settle` on the row, then `Position::is_liquidatable` on the result. Check 1 cannot fail on a decrease. A request that leaves a survivor under `min_position_notional` clamps to a full close before `Position::require_valid` runs.

Check 3 is the only check that an auto-deleveraging (ADL) remainder skips. The owner did not choose the reduction, so the row is not held to the initial margin. It is still held to the notional band and the maintenance line. [Auto-deleveraging](./auto-deleveraging.md) documents that path.

Check 3 reads the whole row an increase leaves behind, and never the order alone. `Position::increase` adds the fill's notional to the row. It adds the posted margin less `Fees::debit` to the row's margin. The fees therefore come out of the margin that check 3 measures.

The table shows an open on an empty side with `1,000` notional, an `init_margin` of 10%, and a `debit` of `1.3`. The requirement is `100`.

| Posted margin | Row margin after the debit | Check 3 |
| --- | --- | --- |
| 100 | 98.7 | Traps `InsufficientMargin` (713) |
| 101.3 | 100 | Passes at equality |
| 102 | 100.7 | Passes |

An increase onto a row that carries surplus margin can post only the incremental requirement and still pass. A margin-only increase adds no size and pays no trade fee. It debits the borrowing accrual and any funding the row owes. The requirement is unchanged, so the row clears check 3 when the margin left after the debit still meets it.

## The initial margin line sets the leverage ceiling {#maximum-leverage}

Check 3 holds `Position.margin` at or above the `init_margin` requirement, so a row's leverage stays at or under `1 / init_margin`. A higher `init_margin` gives a lower ceiling. The check uses margin after fees and permits equality at the initial margin line.

`Config::check_valid` bounds `init_margin` from both sides.

- A negative `init_margin` traps `NegativeValueNotAllowed` (710).
- An `init_margin` below `MIN_MARGIN` or above `MAX_MARGIN` traps `InvalidConfig` (700).
- `MIN_MARGIN` is `SCALAR_18 / 1000`, which is 0.1% and a 1000x ceiling.
- `MAX_MARGIN` is `SCALAR_18 / 2`, which is 50% and a 2x ceiling.

| `init_margin` | Ceiling |
| --- | --- |
| 0.1% (`MIN_MARGIN`) | 1000x, not reachable |
| 1% | 100x |
| 5% | 20x |
| 10% | 10x |
| 50% (`MAX_MARGIN`) | 2x |

The 1000x row is not reachable, because the gap rules below hold `init_margin` strictly above `MIN_MARGIN`.

`Config::check_valid` also sizes the gap between the two lines against the cost of an exit. A breach of either rule traps `InvalidConfig` (700).

- `init_margin > maintenance_margin + fee_non_dom + MIN_CHUNK_IMPACT_CAP`. `fee_non_dom` is a `SCALAR_18` rate. `MIN_CHUNK_IMPACT_CAP` is `SCALAR_18 / 1000`, which is 0.1%.
- `impact_scalar >= min_position_notional * (SCALAR_18 / MIN_CHUNK_IMPACT_CAP)`. The multiplier is 1000. `impact_scalar` and `min_position_notional` are token-dec. The rule holds the impact rate of a minimum-size chunk at or under `MIN_CHUNK_IMPACT_CAP`. A product that overflows `i128` also traps.

A row opened exactly at the initial line then clears the maintenance line after two costs. The first is one minimum-size close chunk at the `fee_non_dom` rate. The second is that chunk's impact fee. A close leg that moves the skew further from balance pays `fee_dom`, a `SCALAR_18` rate that `Config::check_valid` holds at or above `fee_non_dom`. The gap rule sizes the buffer at `fee_non_dom`. [Config](./config.md) carries the full validation order.

## Open interest caps the notional of a side {#open-interest}

`max_open_interest` (token-dec) is a per-side cap that `Config::check_valid` holds at or above `max_position_notional`. An increase with `notional > 0` reads the side's `MarketData.notional` after `Position::require_valid` passes. If that value is greater than `max_open_interest`, the call traps `OpenInterestExceeded` (715). Equality passes.

A row that breaks a margin check traps on that check first. A margin-only increase adds no size and skips the cap. A side already above the cap can still receive a margin top-up.

## Utilization caps the reserve of one side {#utilization}

```rust
pub fn require_utilization(&self, e: &Env, cap: i128, is_long: bool);
```

`Market::require_utilization` checks one side's reserved value against `cap` of half the vault. `cap` is a `SCALAR_18` ratio, and `is_long` selects the side. The allowance follows.

$$
\text{max\_reserved} = \left\lfloor \frac{\lfloor \text{vault\_balance} / 2 \rfloor \cdot \text{cap}}{\text{SCALAR\_18}} \right\rfloor
$$

Where:

- `vault_balance` is the balance the `Market` working set tracks (token-dec). [Pricing](./pricing.md) documents how the call advances it.
- `cap` is `max_util_open` or `max_util_withdraw` (`SCALAR_18`). `math::half_factor` computes the allowance and truncates the division by two before it applies the factor.
- `max_reserved` is the allowance for the selected side (token-dec).

`MarketData::side_reserved` gives the value the vault stands behind on the selected side (token-dec). A long side reserves its base tokens marked at the `ask` and rounded up, through `math::to_notional_ceil`. A short side reserves `notional.short`, its entry notional. If the selected side's reserve is greater than `max_reserved`, the call traps `UtilizationExceeded` (714). Equality passes. A zero vault balance passes only when the selected side reserves nothing. The capacity rounds down and the long reserve rounds up, so both errors favor rejection.

The table shows a vault balance of `1,000` and a `cap` of 80%. The allowance is `400`.

| Selected side reserve | Result |
| --- | --- |
| 399 | Passes |
| 400 | Passes at equality |
| 401 | Traps `UtilizationExceeded` (714) |

Two entries call the function, and each reads the balance after its own settlement.

- `execute_order` calls it with `max_util_open` and `order.is_long` when a fill increases size. The increase checks its own side only. The opposite side may already sit above its cap after a price move or a config change, and that state does not block the fill. A margin-only increase reserves nothing and skips the call. The balance includes the fee the fill banked.
- `execute_vault_order` calls it twice on a redeem fill, once with `true` and once with `false`, both with `max_util_withdraw`. A redeem therefore checks both sides. The balance is the vault balance after the redeem, plus the vault's cut of the redeem fee.

`Config::check_valid` holds `max_util_open` above zero, `max_util_withdraw` at or above `max_util_open`, and both at or below `MAX_UTIL`, which is `10 * SCALAR_18`. A breach traps `InvalidConfig` (700). `max_util_open` is also the capacity factor for each side's borrow reserve, documented on [Borrowing rate](./borrowing-rate.md).

## One predicate serves three gates {#one-predicate-three-uses}

Liquidation eligibility, the gate on the front of every decrease, and check 4 of `Position::require_valid` all call `Position::is_liquidatable` on the numbers from `Position::settle`. The three uses cannot disagree. The only exception is the `force` argument of `Position::liquidate`, which waives eligibility on a delisted market after its deadline.

A successful increase or decrease leaves a row above the maintenance line, or exactly at it. A row below that line cannot be decreased.

An increase reads no eligibility gate on its starting row. It can add margin to a liquidatable position and pass once the result clears both lines.
