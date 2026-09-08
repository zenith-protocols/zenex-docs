---
sidebar_position: 8
title: Margin and leverage
---

# Margin and leverage

Every position carries two margin lines. `init_margin` holds the posted margin against the size. `maintenance_margin` holds the settled equity against the same size. Both are `SCALAR_18` fractions of the row's `notional`, both live in `Config`, and validation keeps `init_margin` above `maintenance_margin`.

Units on this page: token-dec is the settlement token's decimals. base-dec is the `tokens` scale. `SCALAR_18` is `1_000_000_000_000_000_000`, the scale of every rate and ratio. Every formula names the symbol that computes it.

## The two margin lines

| Line | `Config` field | Measured against | Checked in |
| --- | --- | --- | --- |
| Initial margin | `init_margin` | `Position.margin`, free of PnL | `Position::require_valid` |
| Maintenance margin | `maintenance_margin` | The settled equity of the whole row | `Position::is_liquidatable` |

Both checks size their requirement through one helper:

```rust
fn margin_requirement(&self, e: &Env, margin_ratio: i128) -> i128;
```

`Position::margin_requirement` returns `ceil(notional * margin_ratio / SCALAR_18)` (token-dec) through `math::apply_factor_ceil`. `notional` is the row's size (token-dec). `margin_ratio` is `init_margin` or `maintenance_margin` (`SCALAR_18`). The rounding is up, so a requirement is never understated.

The initial line reads `Position.margin`. That value is the posted margin after the debits the two paths apply. `Position::increase` subtracts the whole `Fees::debit`. `Position::decrease` pays the fees out of the realized profit first and subtracts only the uncovered rest. The realized loss and any withdrawal it paid out also come off. `Position::decrease` floors the stored margin at zero and books the shortfall past zero as bad debt. On an increase, check 3 rejects a row whose debits outrun its margin. Unrealized PnL does not count toward it. The maintenance line reads settled equity, which does count PnL. That difference in what each line measures is the reason the protocol carries both.

## Settled equity

```rust
fn settle(&mut self, e: &Env, market: &mut Market, user: &Address, is_long: bool) -> Settled;
```

`Position::settle` prices the whole row as if it closed at the call's price, and returns `Settled { fees, pnl, equity }`. `is_long` selects the side, which fixes the accrual indices, the exit side of the price, and the sign of the PnL. `user` is the account credited with any funding the row earns. It banks the funding and borrowing accruals through `Position::settle_accruals`. It reads the full-close trade fees from `Market::trade_fees` at `-notional` (token-dec) and `-tokens` (base-dec), then passes the raw PnL through `Market::haircut_pnl`. The equity is:

$$
\text{equity} = \text{margin} - \text{debit} + \text{pnl}
$$

Every term is token-dec. `margin` is `Position.margin` as stored at the call. `Position::settle_accruals` does not change it. The borrowing accrual and any funding the row pays reach the equity through `debit`. Earned funding does not. It becomes claimable credit. `fees` carries the four costs itemized, and `debit` is `Fees::debit` over them, `base + impact + borrowing + max(funding, 0)`. Each of those four is token-dec, and [Position lifecycle](./position-lifecycle.md) documents what each one charges. `pnl` is the post-haircut PnL of the full size, marked at the exit side of the call's price. [PnL and the profit cap](./pnl-calculation.md) carries the marks. Equity is signed. A row whose costs outrun its margin settles negative, and the shortfall becomes bad debt on a close.

A repeat settle inside one call banks nothing, because the row's index snapshots already equal the market indices. The second settle re-prices the current state.

```rust
fn is_liquidatable(&self, e: &Env, market: &Market, settled: &Settled) -> bool;
```

`Position::is_liquidatable` returns `settled.equity < ceil(notional * maintenance_margin / SCALAR_18)`. A row exactly at the requirement is not liquidatable. [Liquidation](./liquidation.md) documents the entry that acts on this predicate.

## Post-action validity

```rust
fn require_valid(&mut self, e: &Env, market: &mut Market, user: &Address, is_long: bool, is_adl: bool);
```

`Position::require_valid` runs on the row an action leaves behind. `user` and `is_long` address the row and reach `Position::settle` in check 4. `Position::increase` runs it with `is_adl` false. `Position::decrease` runs it on a partial survivor with the caller's `is_adl`, and a margin-only withdrawal is such a survivor. A full close never runs it, because no row remains. `min_position_notional` and `max_position_notional` are token-dec bounds on the row's notional. The check traps on the first violation, in this order:

| Order | Condition | Error |
| --- | --- | --- |
| 1 | `notional < min_position_notional` | `NotionalBelowMinimum` (711) |
| 2 | `notional > max_position_notional` | `NotionalAboveMaximum` (712) |
| 3 | `!is_adl` and `margin < ceil(notional * init_margin / SCALAR_18)` | `InsufficientMargin` (713) |
| 4 | settled equity `< ceil(notional * maintenance_margin / SCALAR_18)` | `PositionLiquidatable` (723) |

Check 4 runs `Position::settle` on the row, then `Position::is_liquidatable` on the result. Check 3 is the only one an ADL remainder skips. A forced reduction is not a restructure the owner chose. It is held to the notional band and the maintenance line. [Auto-deleveraging](./auto-deleveraging.md) documents that path. Checks 1, 2, and 4 run on every path, forced or not.

Check 3 reads the whole row an increase leaves behind, not the order alone. `Position::increase` adds the fill's notional to the row and adds the posted margin less `Fees::debit` to the row's margin. On the open of an empty side, margin posted at exactly `ceil(notional * init_margin / SCALAR_18)` therefore fails with `InsufficientMargin` (713). The fees came out of that posted margin. An increase onto a row that carries surplus margin can post the incremental requirement and still pass. A margin-only increase adds no size and pays no trade fee. It debits the borrowing accrual and any funding the row owes. Earned funding never leaves the margin. It becomes claimable credit. The requirement is unchanged, so the row clears check 3 when the margin left after the debit still meets it.

## Maximum leverage

Check 3 of `Position::require_valid` holds `Position.margin` at or above the `init_margin` requirement, so `init_margin` sets the leverage ceiling. An `init_margin` of `SCALAR_18 / 100` caps a row at 100x its margin. `Config::check_valid` rejects a negative `init_margin` with `NegativeValueNotAllowed` (710). It rejects an `init_margin` below `MIN_MARGIN` (`SCALAR_18 / 1000`, 0.1%) or above `MAX_MARGIN` (`SCALAR_18 / 2`, 50%) with `InvalidConfig` (700). A higher `init_margin` gives a lower ceiling, so `MAX_MARGIN` sets the lowest ceiling a market can carry at 2x. The gap rule below raises the true floor above `MIN_MARGIN`, so the 1000x that the constant alone would allow is not reachable.

`Config::check_valid` also sizes the gap between the two lines against the cost of an exit. Two rules must hold, and a breach of either raises `InvalidConfig` (700). The first is `init_margin > maintenance_margin + fee_non_dom + MIN_CHUNK_IMPACT_CAP`, where `fee_non_dom` is a `SCALAR_18` rate and `MIN_CHUNK_IMPACT_CAP` is `SCALAR_18 / 1000` (0.1%). The second is `impact_scalar >= min_position_notional * (SCALAR_18 / MIN_CHUNK_IMPACT_CAP)`, which holds the impact rate of a minimum-size chunk at or under `MIN_CHUNK_IMPACT_CAP`. `impact_scalar` and `min_position_notional` are both token-dec. The buffer covers one minimum-size close chunk at the `fee_non_dom` base rate, plus that chunk's impact fee. A close that moves the skew further from balance pays `fee_dom`, a `SCALAR_18` rate that `Config::check_valid` holds at or above `fee_non_dom`. [Config](./config.md) carries the full validation order.

## Open interest

An increase with `notional > 0` reads the side's `MarketData.notional` after `require_valid` passes. If that value is greater than `max_open_interest` (token-dec), the call traps `OpenInterestExceeded` (715). Equality passes. A margin-only increase adds no size and skips the check.

## Utilization

```rust
pub fn require_utilization(&self, e: &Env, cap: i128);
```

`Market::require_utilization` holds each side's reserved value inside `cap` of half the vault. `cap` is a `SCALAR_18` ratio. The allowance is `max_reserved`, which `math::half_factor` computes as `floor((vault_balance / 2) * cap / SCALAR_18)` (token-dec). The division by two truncates. `vault_balance` (token-dec) is the balance the `Market` working set tracks. `Market::load` reads it from the vault. Every settlement in the call moves it, and a vault-order fill moves it directly by the assets it mints or burns.

`MarketData::side_reserved` gives the value the vault stands behind on one side (token-dec). A long side reserves its base tokens marked at the ask and rounded up, through `math::to_notional_ceil`. A short side reserves `notional.short`, its entry notional. If either side's reserve is greater than `max_reserved`, the call traps `UtilizationExceeded` (714). Equality passes. A zero vault balance passes only when both sides reserve nothing.

Two callers pass two caps. `execute_order` passes `max_util_open` after a size-growing increase settles. `execute_vault_order` passes `max_util_withdraw` after a redeem settles. Both read the post-settlement balance. The increase gate counts the fee the fill banked, and the redeem gate counts only what stays in the vault. `max_util_open` is also the capacity factor for each side's borrow reserve, documented on [Borrowing rate](./borrowing-rate.md).

## One predicate, three uses

Liquidation eligibility, the gate on the front of every decrease, and check 4 of `require_valid` all call `Position::is_liquidatable` on the numbers from `Position::settle`. The three uses cannot disagree. No action may leave a liquidatable row behind, and a row under the maintenance line cannot be decreased. An increase reads no gate on the row it starts from. A trader under the line can post margin, and the fill passes once the resulting row clears both lines.
