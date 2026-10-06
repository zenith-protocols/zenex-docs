---
sidebar_position: 3
title: Config
description: All market configuration fields, validation rules, change effects, and protocol constants.
---

# Config

`Config` is the singleton that holds every tunable parameter of one market. It lives in instance storage under the `Config` key of `DataKey`. `__constructor` stores it, `set_config` replaces it whole, and `get_config` returns it. This page covers the two entry points and their gate order. It then covers the 34 fields, the 20 validation rules, and the protocol constants that bound them.

Ratios and rates are 18-decimal fixed point (`SCALAR_18`, where `10^18` is 100%). Amounts are in settlement-token decimals (token-dec). Locks are durations in seconds. The field table gives the time dimension of each rate.

## The owner replaces the whole Config in one call {#entry-points}

```rust
fn set_config(e: Env, config: Config);
fn get_config(e: Env) -> Config;
```

`set_config` is owner only (`#[only_owner]`), so the owner must authorize the call. If ownership is renounced, the call traps `OwnableError::OwnerNotSet` (2100) before the body runs. Any account can call `get_config`. It reads the singleton and does not extend the instance TTL.

`set_config` first extends the instance time-to-live (TTL). The extension does nothing while the remaining TTL is at least `LEDGER_THRESHOLD_INSTANCE` (518,400 ledgers, 30 days at 17,280 ledgers per day). Otherwise the TTL grows to `LEDGER_BUMP_INSTANCE` (535,680 ledgers, 31 days). A trap in a later check reverts the extension with the rest of the call.

The call then runs three checks in order and traps on the first failure.

| Step | Error | Condition |
| --- | --- | --- |
| 1 | `NegativeValueNotAllowed` (710) | Rule 1 of `Config::check_valid` fails. |
| 2 | `InvalidConfig` (700) | Any of rules 2 to 20 of `Config::check_valid` fails. |
| 3 | `MarketNotAccrued` (703) | A borrowing or funding parameter differs from the stored value, the status is not `Frozen`, and `MarketData.accrued_at` is not the current ledger timestamp. |

The borrowing parameters are `target_util`, `borrow_rate`, `increased_borrow_rate`, and `max_util_open`. The funding parameters are `funding_increase`, `funding_decrease`, `threshold_stable_funding`, `threshold_decrease_funding`, `funding_min`, and `funding_max`. A change to any other field skips step 3. Only `Frozen` waives step 3.

The call reads `Config` after the validation. It reads `Status` only when a borrowing or funding parameter changed, and it reads `MarketData` only when that status is not `Frozen`. The `MarketData` read extends its TTL. Then the call writes `Config` and emits `ConfigUpdate` under the event name `config_update`, with no other topic. The event data is a map that holds the new struct under the key `config`. The [Events](./events.md) page gives the payload.

### A rate change needs an accrual in the same ledger {#accrual-before-a-rate-change}

A rate change must not reprice interest that has not yet accrued. Step 3 therefore lets a borrowing or funding change land only in a ledger that already accrued. The interval before the change is then priced at the old rates.

`Market::load` sets `MarketData.accrued_at` to the ledger timestamp on its working copy, and `Market::store` writes that copy back. Six entries load and store the copy, and each one stamps the current timestamp: `accrue`, `execute_order`, `execute_vault_order`, `execute_liquidation`, `execute_adl`, and `update_adl_state`.

`Market::load` traps `MarketFrozen` (704) on a `Frozen` market and on a `Retired` one, so neither status accrues. On a `Frozen` market the first accrual after the market leaves `Frozen` prices the whole frozen window at the new rates. That is why `Frozen` waives step 3.

`Retired` is final and accrual has stopped for good. Step 3 still applies, because the status is not `Frozen`, and retirement leaves `accrued_at` unchanged. A borrowing or funding change on a `Retired` market lands only in a ledger whose timestamp equals `accrued_at`, and every later ledger traps it. The [Borrowing rate](./borrowing-rate.md) and [Funding rate](./funding-rate.md) pages give the accrual formulas.

## Config holds 34 fields with a unit each {#fields}

`Config` is a `#[contracttype]` struct. It is the last argument of `__constructor`, the `set_config` argument, the `get_config` return, and the `ConfigUpdate` payload. The table names the error that a breach raises where a field gates a call.

| Field | Type | Unit | Meaning |
| --- | --- | --- | --- |
| `keeper_rate` | `i128` | `SCALAR_18` | Keeper share of the base trade fee plus the impact fee, of the liquidation fee, and of the `deposit_fee` or `redeem_fee` on a vault fill. |
| `min_position_notional` | `i128` | token-dec | Minimum notional of an open position, checked after an increase (`NotionalBelowMinimum`, 711). A partial close that would leave a notional below this value becomes a full close. |
| `max_position_notional` | `i128` | token-dec | Maximum notional of an open position (`NotionalAboveMaximum`, 712). Also the notional ceiling on an increase order. |
| `max_open_interest` | `i128` | token-dec | Per-side open-interest ceiling, checked after an increase that adds notional (`OpenInterestExceeded`, 715). |
| `min_order_notional` | `i128` | token-dec | Minimum notional per order, checked when the order moves notional (`InvalidOrder`, 732). Also the smallest `execute_adl` slice. |
| `min_order_margin` | `i128` | token-dec | Minimum margin magnitude per order, checked whenever the order moves margin (`InvalidOrder`, 732). An increase posts that margin and a decrease withdraws it. |
| `exec_fee` | `i128` | token-dec | Flat keeper execution fee. Every order and vault order copies it at creation and escrows it, and a cancel refunds it. A redeem on a `Retired` market fills at creation and escrows none. |
| `fee_dom` | `i128` | `SCALAR_18` | Trade fee rate on the leg of a fill that widens the skew. |
| `fee_non_dom` | `i128` | `SCALAR_18` | Trade fee rate on the leg of a fill that narrows the skew. |
| `impact_scalar` | `i128` | token-dec | Denominator of the size-quadratic impact fee. A larger value means a smaller fee. The [Fee system](./fee-system.md) page gives the formula. |
| `max_util_open` | `i128` | `SCALAR_18` | Utilization cap checked after an increase fill that adds notional, on the increased side's reserved value against half the vault balance (`UtilizationExceeded`, 714). The opposite side is not checked. Also each side's capacity factor for the borrow reserve, on the same measure. |
| `max_util_withdraw` | `i128` | `SCALAR_18` | Utilization cap checked on both sides after a redeem fill, on each side's reserved value against half the vault balance (`UtilizationExceeded`, 714). |
| `init_margin` | `i128` | `SCALAR_18` | Initial margin rate, the reciprocal of the maximum leverage. Margin below the rate times the notional, rounded up, traps `InsufficientMargin` (713). An auto-deleveraging (ADL) close skips the check. |
| `maintenance_margin` | `i128` | `SCALAR_18` | Liquidation line, as a rate on the position notional. Settled equity below the line makes the position liquidatable. |
| `liq_fee` | `i128` | `SCALAR_18` | Liquidation fee rate on the closed notional, rounded up and capped at the settled equity floored at zero. |
| `notional_lock` | `u64` | seconds | Decrease lock on newly added notional. A fill that adds notional sets the position's `unlocks_at` to the fill time plus this value. A close of locked notional traps `NotionalLocked` (721). |
| `target_util` | `i128` | `SCALAR_18` | Kink utilization of the borrowing curve. |
| `borrow_rate` | `i128` | `SCALAR_18` per second | Borrowing-rate slope below the kink. |
| `increased_borrow_rate` | `i128` | `SCALAR_18` per second | Borrowing rate at full utilization. |
| `funding_increase` | `i128` | `SCALAR_18` per second squared | Funding acceleration at full skew. |
| `funding_decrease` | `i128` | `SCALAR_18` per second squared | Flat decay speed of the funding rate. |
| `threshold_stable_funding` | `i128` | `SCALAR_18` | Skew above which a same-direction rate keeps accelerating. |
| `threshold_decrease_funding` | `i128` | `SCALAR_18` | Skew below which a same-direction rate decays. |
| `funding_min` | `i128` | `SCALAR_18` per second | Floor on the charged rate magnitude. It applies while the stored rate is nonzero. The stored rate is `MarketData.funding_rate`, which is not floored and can decay through this floor. |
| `funding_max` | `i128` | `SCALAR_18` per second | Cap on the stored rate magnitude. |
| `adl_max_pnl` | `i128` | `SCALAR_18` | ADL trigger, as a factor of half the vault balance. `update_adl_state` arms a side whose pending profit and loss (PnL) exceeds it. |
| `adl_clear_target` | `i128` | `SCALAR_18` | ADL clear target, as a factor of half the vault balance. An armed side stays armed while its pending PnL exceeds it. `execute_adl` traps `AdlNotTriggered` (770) at or below it and `AdlOvershoot` (771) if the close ends below it. |
| `max_pnl_trader` | `i128` | `SCALAR_18` | Realized-profit haircut threshold, as a factor of half the vault balance. While a side's pending PnL exceeds it, close payouts scale down pro rata. Also the per-side profit cap in the PnL that prices vault shares. |
| `max_pnl_withdraw` | `i128` | `SCALAR_18` | Redeem gate as a factor of half the vault balance, read against the post-redeem balance. A redeem fill traps `PendingPnlExceeded` (754) while either side's pending PnL exceeds it. |
| `redeem_lock` | `u64` | seconds | Redeem cooldown from the vault order's `created_at`. A redeem fill inside the cooldown traps `VaultOrderLocked` (751). A value of `0` leaves no cooldown, and a fill still needs a ledger later than `created_at`. |
| `deposit_fee` | `i128` | `SCALAR_18` | Deposit fill fee rate on the vault order's `amount`, rounded down, not on the escrowed `exec_fee`. The depositor mints shares on the rest. The vault keeps the fee net of the keeper and treasury cuts. |
| `redeem_fee` | `i128` | `SCALAR_18` | Redeem fill fee rate on the assets the burn produced, rounded down. The redeemer receives the remainder. |
| `min_deposit` | `i128` | token-dec | Minimum amount on a deposit vault order (`InvalidOrder`, 732). A redeem order carries no minimum. |
| `max_vault_balance` | `i128` | token-dec | Vault balance ceiling, checked after a deposit fill on the settled balance, fee donation included (`VaultBalanceExceeded`, 753). |

Each mechanism has its own page: [Fee system](./fee-system.md), [Margin and leverage](./margin-and-leverage.md), [Liquidation](./liquidation.md), [Borrowing rate](./borrowing-rate.md), [Funding rate](./funding-rate.md), [Auto-deleveraging](./auto-deleveraging.md), and [Vault orders](./vault-orders.md).

## A change applies at the next use of each field {#what-a-change-reaches}

Two fields are copied into a stored row. `exec_fee` is copied into each `Order` and `VaultOrder` at creation, so a resting order keeps the fee it escrowed. `notional_lock` sets the `unlocks_at` deadline of a position on each fill that adds notional, so an existing deadline keeps its length.

The market reads every other field when it uses it. That includes `redeem_lock`, which is measured from `created_at` at fill time and not fixed at creation. A change to such a field applies to every open position and resting order at its next fill, accrual, or check.

:::warning Most parameters apply to existing state
The market reads most settings when an action executes. A change can affect open positions and resting orders.
:::

## Twenty rules validate every Config {#validation-rules}

`Config::check_valid` evaluates the rules in the order below and returns the first failure. `Config::require_valid` runs it from both `set_config` and `__constructor`. Every comparison uses the raw integer in the unit the field table gives. The constants section gives the value, unit, and scale of every bound a rule names.

Rule 1 raises `NegativeValueNotAllowed` (710). Rules 2 to 20 raise `InvalidConfig` (700). The [Constructor and dependencies](./dependencies.md) page gives the constructor check order, including the `feed_id` check that runs before these rules.

| # | Rule (must hold) | Reason |
| --- | --- | --- |
| 1 | None of `keeper_rate`, `fee_dom`, `fee_non_dom`, `init_margin`, `maintenance_margin`, `liq_fee`, `borrow_rate`, `increased_borrow_rate`, `target_util`, `funding_increase`, `funding_decrease`, `threshold_stable_funding`, `threshold_decrease_funding`, `funding_min`, `funding_max`, `adl_max_pnl`, `adl_clear_target`, `deposit_fee`, `redeem_fee`, `min_order_margin`, `min_deposit`, `max_pnl_trader`, `max_pnl_withdraw`, `exec_fee` is `< 0`. | The check runs first, so a negative value reports 710 and never a bound failure. |
| 2 | `keeper_rate <= MAX_KEEPER_RATE`, `fee_dom <= MAX_FEE_RATE`, `fee_non_dom <= MAX_FEE_RATE`, `max_util_open <= MAX_UTIL`, `max_util_withdraw <= MAX_UTIL`, `init_margin <= MAX_MARGIN`, `liq_fee <= MAX_LIQ_FEE`, `notional_lock <= MAX_NOTIONAL_LOCK`, `redeem_lock <= MAX_REDEEM_LOCK`. | Each cap is a protocol constant that no `Config` can exceed. |
| 3 | `init_margin >= MIN_MARGIN` and `impact_scalar > 0`. | `MIN_MARGIN` caps leverage at 1000x. A positive `impact_scalar` keeps the impact fee denominator nonzero. |
| 4 | `notional_lock >= MIN_NOTIONAL_LOCK`. | The lock must outlast the oracle's trade staleness window. Otherwise one accepted stale price could open and then close the same size. |
| 5 | `min_position_notional > 0` and `max_position_notional > min_position_notional`. | Position size stays inside a band of positive width. |
| 6 | `max_open_interest >= max_position_notional`. | The per-side ceiling must admit at least one maximum-size position. |
| 7 | `min_order_notional > 0`, `min_order_margin > 0`, and `min_order_notional <= min_position_notional`. | Both dust floors are positive. An order sized to a minimum position must not fall under the notional floor. |
| 8 | `exec_fee <= min_order_margin`. | A larger fee would make dust orders net-negative escrow. |
| 9 | `min_deposit > 0`. | The deposit floor keeps dust fills out. |
| 10 | `deposit_fee <= MAX_FEE_RATE` and `redeem_fee <= MAX_FEE_RATE`. | Vault fill fee rates share the trade fee cap. |
| 11 | `max_util_open > 0` and `max_util_withdraw >= max_util_open`. | The open cap is positive. The buffer between the two caps serves withdrawals only. |
| 12 | `fee_dom >= fee_non_dom`. | The leg that widens the skew pays at least as much as the leg that narrows it. |
| 13 | `target_util < SCALAR_18`, `increased_borrow_rate >= borrow_rate`, and `increased_borrow_rate <= MAX_BORROW_RATE`. | The kink sits below full utilization. The rate at full utilization is bounded and at least the base slope. |
| 14 | `threshold_stable_funding <= SCALAR_18`, `threshold_decrease_funding <= threshold_stable_funding`, `funding_min <= funding_max`, `funding_max <= MAX_FUNDING_RATE`, `funding_increase <= MAX_FUNDING_RATE`, and `funding_decrease <= MAX_FUNDING_RATE`. | The decay band sits inside the stable band, and the floor cannot exceed the cap. The shared rate bound keeps the rate times the elapsed seconds far from `i128` overflow. |
| 15 | `adl_max_pnl < SCALAR_18`, `adl_max_pnl >= MIN_ADL_TRIGGER`, `adl_clear_target <= adl_max_pnl`, `adl_clear_target >= MIN_ADL_CLEAR`, `max_pnl_trader < SCALAR_18`, `adl_max_pnl <= max_pnl_trader`, `max_pnl_withdraw > 0`, and `max_pnl_withdraw <= adl_clear_target`. | Every value is a factor on a side's pending PnL against half the vault balance. A clear target at or below the trigger gives hysteresis. A trigger at or below the haircut threshold makes ADL de-risk before the haircut engages. A redeem gate at or below the clear target leaves every side at or below the target after a permitted redeem. A redeem can then neither arm ADL nor hold an armed flag above its clear target. |
| 16 | `max_vault_balance > 0`. | The vault balance ceiling is positive. |
| 17 | `min_deposit` (token-dec) times `MIN_DEPOSIT_DIVISOR` fits in `i128`, and the product is at most `max_vault_balance` (token-dec). | The deposit floor stays a small fraction of the vault ceiling, so raising it cannot block every deposit fill. An overflowing product is rejected. |
| 18 | `maintenance_margin > liq_fee` and `init_margin > maintenance_margin`. A `liq_fee` of `0` is valid. | The strict inequalities keep an equity band in which a liquidation returns a remainder. |
| 19 | `init_margin > maintenance_margin + fee_non_dom + MIN_CHUNK_IMPACT_CAP`. | A position opened exactly at the `init_margin` line must clear maintenance after the worst unavoidable close fee. That fee is `fee_non_dom` plus the impact fee of a minimum-size chunk. |
| 20 | `min_position_notional` (token-dec) times `SCALAR_18 / MIN_CHUNK_IMPACT_CAP` fits in `i128`, and `impact_scalar` (token-dec) is at least that product. | A minimum-size fill pays an impact rate of at most `MIN_CHUNK_IMPACT_CAP`. An overflowing product is rejected. |

Read together, the rules imply four orderings:

- `0 <= liq_fee < maintenance_margin < init_margin <= MAX_MARGIN`, with `init_margin >= MIN_MARGIN`.
- `MIN_ADL_CLEAR <= adl_clear_target <= adl_max_pnl <= max_pnl_trader < SCALAR_18`, with `adl_max_pnl >= MIN_ADL_TRIGGER` and `0 < max_pnl_withdraw <= adl_clear_target`.
- `0 < max_util_open <= max_util_withdraw <= MAX_UTIL`.
- `0 < min_order_notional <= min_position_notional < max_position_notional <= max_open_interest`.

Eight `i128` fields sit outside rule 1. Each rejects a negative value through its own rule, which raises `InvalidConfig` (700).

| Field | Rule that catches a negative value |
| --- | --- |
| `impact_scalar` | 3 |
| `min_position_notional` | 5 |
| `max_position_notional` | 5 |
| `max_open_interest` | 6 |
| `min_order_notional` | 7 |
| `max_util_open` | 11 |
| `max_util_withdraw` | 11 |
| `max_vault_balance` | 16 |

`notional_lock` and `redeem_lock` are `u64` and cannot be negative. Rules 5 and 6 bound `max_position_notional` and `max_open_interest` from below only.

### Rule 20 sets a floor on the impact scalar {#impact-scalar-floor}

Rule 20 sets the smallest `impact_scalar` that a market accepts.

```text
min_impact_scalar = min_position_notional * (SCALAR_18 / MIN_CHUNK_IMPACT_CAP)
```

Here `min_position_notional` and the result are token-dec amounts. `SCALAR_18 / MIN_CHUNK_IMPACT_CAP` is the plain integer 1000. Before the `MAX_IMPACT_RATE` cap, the impact rate of a fill is its notional divided by `impact_scalar`. The floor therefore holds the rate of a minimum-size fill at or under 0.1%.

The rows below assume a settlement token with 7 decimals, so one unit is `10_000_000` token-dec.

| `min_position_notional` | In token-dec | Minimum `impact_scalar` | In units |
| --- | --- | --- | --- |
| 1 unit | `10_000_000` | `10_000_000_000` | 1,000 |
| 10 units | `100_000_000` | `100_000_000_000` | 10,000 |
| 100 units | `1_000_000_000` | `1_000_000_000_000` | 100,000 |

## The constants bound the Config and fix the wind-down windows {#constants}

The market's protocol-level constants bound every `Config` and time the wind-down. No value here is configurable. The time-to-live constants are on the [Storage](./storage.md) page, and the oracle crate holds the staleness ceilings. A percent label reads the value as a `SCALAR_18` fraction.

| Symbol | Value | Unit | Used by |
| --- | --- | --- | --- |
| `SCALAR_18` | `1_000_000_000_000_000_000` | fixed-point one | Every ratio, rate, and cumulative index. |
| `MAX_KEEPER_RATE` | `SCALAR_18 / 2` (50%) | `SCALAR_18` | Rule 2, the cap on `keeper_rate`. |
| `MAX_FEE_RATE` | `SCALAR_18 / 100` (1%) | `SCALAR_18` | Rule 2, the cap on `fee_dom` and `fee_non_dom`. Rule 10, the cap on `deposit_fee` and `redeem_fee`. |
| `MAX_UTIL` | `10 * SCALAR_18` (1000%) | `SCALAR_18` | Rule 2, the cap on `max_util_open` and `max_util_withdraw`. |
| `MAX_IMPACT_RATE` | `SCALAR_18 / 10` (10%) | `SCALAR_18` | `math::impact_fee`, which caps a fill's impact fee at this rate on the filled notional. |
| `MIN_CHUNK_IMPACT_CAP` | `SCALAR_18 / 1000` (0.1%) | `SCALAR_18` | Rule 19 and rule 20, the ceiling on the impact rate of a minimum-size chunk. |
| `MAX_MARGIN` | `SCALAR_18 / 2` (50%, 2x leverage) | `SCALAR_18` | Rule 2, the cap on `init_margin`. |
| `MIN_MARGIN` | `SCALAR_18 / 1000` (0.1%, 1000x leverage) | `SCALAR_18` | Rule 3, the floor on `init_margin`. |
| `MAX_LIQ_FEE` | `SCALAR_18 / 4` (25%) | `SCALAR_18` | Rule 2, the cap on `liq_fee`. |
| `MIN_ADL_TRIGGER` | `45 * SCALAR_18 / 100` (45%) | `SCALAR_18` | Rule 15, the floor on `adl_max_pnl`. A change cannot arm ADL against modest open winners. |
| `MIN_ADL_CLEAR` | `40 * SCALAR_18 / 100` (40%) | `SCALAR_18` | Rule 15, the floor on `adl_clear_target`. It bounds how deep a change can let ADL cut. |
| `SECONDS_PER_YEAR` | `31_536_000` | seconds | The basis of `MAX_BORROW_RATE` and `MAX_FUNDING_RATE`. |
| `MAX_BORROW_RATE` | `10 * SCALAR_18 / SECONDS_PER_YEAR` = `317_097_919_837` (1000% per year) | `SCALAR_18` per second | Rule 13, the cap on `increased_borrow_rate`. |
| `MAX_FUNDING_RATE` | `10 * SCALAR_18 / SECONDS_PER_YEAR` = `317_097_919_837` (1000% per year) | `SCALAR_18` per second | Rule 14, the cap on `funding_max`, `funding_increase`, and `funding_decrease`. |
| `MIN_NOTIONAL_LOCK` | `15` | seconds | Rule 4, the floor on `notional_lock`. It equals the oracle's `MAX_TRADE_STALENESS_SECONDS`. The [Position lifecycle](./position-lifecycle.md#the-decrease-lock-stops-an-open-then-decrease-round-trip) page gives the reason. |
| `MAX_NOTIONAL_LOCK` | `86_400` (1 day) | seconds | Rule 2, the cap on `notional_lock`. |
| `DELIST_GRACE` | `86_400` (1 day) | seconds from `DelistedAt` | `set_status`, which blocks a return to a trading status once the window has elapsed. `set_terminal_price`, which unlocks after it. |
| `DELIST_DEADLINE` | `7 * 86_400` (7 days) | seconds from `DelistedAt` | `execute_liquidation`, which waives `NotLiquidatable` (722) on a `Delisted` market after the deadline. Any remaining position then closes whatever its margin health. |
| `MAX_REDEEM_LOCK` | `2_592_000` (30 days) | seconds | Rule 2, the cap on `redeem_lock`. |
| `MIN_DEPOSIT_DIVISOR` | `100` | plain integer | Rule 17, the multiplier on `min_deposit`. It holds the deposit floor at or under a hundredth of `max_vault_balance`. |
| `MAX_ORDERS_PER_SIDE` | `8` | count (`u32`) | `create_order`, which traps `TooManyOrders` (733) when a side already lists this many decrease orders. The cap bounds the sweep, with refunds, when a position closes. |

The [Market status](./status.md) page covers the delist windows.
