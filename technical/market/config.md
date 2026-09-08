---
sidebar_position: 3
title: Config
---

# Config

`Config` is the instance-storage singleton that carries every tunable market parameter. It covers fees, size caps, margins, locks, and the borrowing and funding curves. `__constructor` stores it in full, `set_config` replaces it in full, and `get_config` returns it. Ratios and rates are `SCALAR_18` fixed point, amounts are in settlement-token decimals (token-dec), and locks are seconds. The field table gives the time dimension of each rate.

## Entry points

```rust
fn set_config(e: Env, config: Config);
fn get_config(e: Env) -> Config;
```

`set_config` is owner only (`#[only_owner]`). The owner must authorize the call. If ownership is renounced, the call traps `OwnerNotSet` (2100) before the body runs. Any account may call `get_config`.

`set_config` runs three checks in order and traps on the first failure.

| Step | Error | Condition |
| --- | --- | --- |
| 1 | `NegativeValueNotAllowed` (710) | Rule 1 of `Config::check_valid` fails. |
| 2 | `InvalidConfig` (700) | Any of rules 2 to 20 of `Config::check_valid` fails. |
| 3 | `MarketNotAccrued` (703) | A borrowing or funding parameter differs from the stored value, the status is not `Frozen`, and `MarketData.accrued_at` is not the current ledger timestamp. |

The borrowing parameters are `target_util`, `borrow_rate`, `increased_borrow_rate`, and `max_util_open`. The funding parameters are `funding_increase`, `funding_decrease`, `threshold_stable_funding`, `threshold_decrease_funding`, `funding_min`, and `funding_max`. Every other field changes without step 3. Only `Frozen` waives step 3.

The call first extends the instance time-to-live (TTL). The extension is a no-op while the remaining TTL is at least `LEDGER_THRESHOLD_INSTANCE` ledgers. A trap in a later check reverts the extension with the rest of the call. The call then reads `Config`. It reads `Status` only when a borrowing or funding parameter changed, and it reads `MarketData` only when that status is not `Frozen`. The read of `MarketData` extends its TTL. The call writes `Config` and emits `ConfigUpdate` under the event name `config_update`, with no other topic. The data is a map that holds the new struct under the key `config`. The [Events](./events.md) page gives the payload.

### Accrual before a rate change

A borrowing or funding change lands only in a ledger that already accrued. `Market::load` sets `MarketData.accrued_at` to the ledger timestamp on its working copy. `Market::store` writes that copy back. So `accrue`, every fill, `execute_liquidation`, `execute_adl`, and `update_adl_state` set `accrued_at` to the current timestamp. The interval before the change is therefore priced at the old rates. `Market::load` traps `MarketFrozen` (704) on a `Frozen` market and on a `Retired` one, so neither status accrues. The first accrual after the market leaves `Frozen` prices the whole frozen window at the new rates. `Retired` is final. Step 3 still applies on a `Retired` market, and accrual has permanently stopped. Retirement leaves `accrued_at` unchanged, so a borrowing or funding change lands only in a ledger that stamped it before the market retired. Every later ledger traps. The [Borrowing rate](./borrowing-rate.md) and [Funding rate](./funding-rate.md) pages give the accrual formulas.

## Fields

`Config` is a `#[contracttype]` with 34 fields. It is the last argument of `__constructor`, the `set_config` argument, the `get_config` return, and the `ConfigUpdate` payload.

| Field | Type | Unit | Meaning |
| --- | --- | --- | --- |
| `keeper_rate` | `i128` | `SCALAR_18` | Keeper share of the base trade fee plus the impact fee, of the liquidation fee, and of the `deposit_fee` or `redeem_fee` on a vault fill. |
| `min_position_notional` | `i128` | token-dec | Minimum notional of an open position, checked after an increase and after a partial close. A decrease that would leave a notional below this value clamps to a full close. |
| `max_position_notional` | `i128` | token-dec | Maximum notional of an open position. Also the notional ceiling on an increase order. |
| `max_open_interest` | `i128` | token-dec | Per-side open-interest ceiling, checked after an increase that adds notional. |
| `min_order_notional` | `i128` | token-dec | Minimum notional per order, checked when the order moves notional. Also the smallest `execute_adl` slice. |
| `min_order_margin` | `i128` | token-dec | Minimum margin magnitude per order, checked whenever the order moves margin. An increase posts that margin. A decrease withdraws it. |
| `exec_fee` | `i128` | token-dec | Flat keeper execution fee. Every stored order and vault order copies it at creation and escrows it. A vault order on a `Retired` market redeems at once and pays none. |
| `fee_dom` | `i128` | `SCALAR_18` | Trade fee rate on the leg of a fill that widens the skew. |
| `fee_non_dom` | `i128` | `SCALAR_18` | Trade fee rate on the leg of a fill that narrows the skew. |
| `impact_scalar` | `i128` | token-dec | Denominator of the size-quadratic impact fee. A larger value means a smaller fee. |
| `max_util_open` | `i128` | `SCALAR_18` | Utilization cap checked after an increase fill that adds notional, on each side's reserved value against half the vault balance. Also each side's capacity factor for the borrow reserve, on the same measure. |
| `max_util_withdraw` | `i128` | `SCALAR_18` | Utilization cap checked after a redeem fill, on each side's reserved value against half the vault balance. |
| `init_margin` | `i128` | `SCALAR_18` | Initial margin rate, the reciprocal of the maximum leverage. |
| `maintenance_margin` | `i128` | `SCALAR_18` | Liquidation line, as a rate on the position notional. |
| `liq_fee` | `i128` | `SCALAR_18` | Liquidation fee rate on the closed notional, capped at the settled equity floored at zero. |
| `notional_lock` | `u64` | seconds | Decrease lock on newly added notional. |
| `target_util` | `i128` | `SCALAR_18` | Kink utilization of the borrowing curve. |
| `borrow_rate` | `i128` | `SCALAR_18` per second | Borrowing-rate slope below the kink. |
| `increased_borrow_rate` | `i128` | `SCALAR_18` per second | Borrowing rate at full utilization. |
| `funding_increase` | `i128` | `SCALAR_18` per second squared | Funding acceleration at full skew. |
| `funding_decrease` | `i128` | `SCALAR_18` per second squared | Flat decay speed of the funding rate. |
| `threshold_stable_funding` | `i128` | `SCALAR_18` | Skew above which a same-direction rate keeps accelerating. |
| `threshold_decrease_funding` | `i128` | `SCALAR_18` | Skew below which a same-direction rate decays. |
| `funding_min` | `i128` | `SCALAR_18` per second | Floor on the charged rate magnitude. The stored rate is `MarketData.funding_rate`, which is not floored and can decay through this floor. |
| `funding_max` | `i128` | `SCALAR_18` per second | Cap on the stored rate magnitude. |
| `adl_max_pnl` | `i128` | `SCALAR_18` | Auto-deleveraging (ADL) trigger, as a factor of half the vault balance. |
| `adl_clear_target` | `i128` | `SCALAR_18` | ADL clear target, as a factor of half the vault balance. |
| `max_pnl_trader` | `i128` | `SCALAR_18` | Realized-profit haircut threshold, as a factor of half the vault balance. Also the per-side profit cap in the profit and loss (PnL) that prices vault shares. |
| `max_pnl_withdraw` | `i128` | `SCALAR_18` | Redeem gate as a factor of half the vault balance, read against the post-redeem balance. |
| `redeem_lock` | `u64` | seconds | Redeem cooldown from the vault order's `created_at`. A value of `0` leaves no cooldown, and a fill still needs a ledger later than `created_at`. |
| `deposit_fee` | `i128` | `SCALAR_18` | Deposit fill fee rate on the vault order's `amount`, not on the escrowed `exec_fee`. The depositor mints shares on the rest, and the vault keeps the fee net of the keeper and treasury cuts. |
| `redeem_fee` | `i128` | `SCALAR_18` | Redeem fill fee rate on the assets the burn produced. The redeemer receives the remainder. |
| `min_deposit` | `i128` | token-dec | Minimum amount on a deposit vault order. |
| `max_vault_balance` | `i128` | token-dec | Vault balance ceiling, checked after a deposit fill. |

Each mechanism has its own page: [Fee system](./fee-system.md), [Margin and leverage](./margin-and-leverage.md), [Liquidation](./liquidation.md), [Borrowing rate](./borrowing-rate.md), [Funding rate](./funding-rate.md), [Auto-deleveraging](./auto-deleveraging.md), and [Vault orders](./vault-orders.md).

## Validation rules

`Config::check_valid` runs from `set_config` and from `__constructor`. It evaluates the rules below in order and stops at the first failure. Every comparison is on the raw integer, in the unit the field table above gives. The constants section below gives the value, the unit, and the scale of every bound the rules name. Rule 1 raises `NegativeValueNotAllowed` (710). Rules 2 to 20 raise `InvalidConfig` (700). At construction the rules run after a `feed_id` check. That check raises `InvalidConfig` (700) unless `feed_id` carries the `0x0003` prefix of a V3 stream. Step 3 of the sequence above belongs to `set_config` alone. The [Constructor and dependencies](./dependencies.md) page gives the `__constructor` signature.

| # | Rule (must hold) |
| --- | --- |
| 1 | None of `keeper_rate`, `fee_dom`, `fee_non_dom`, `init_margin`, `maintenance_margin`, `liq_fee`, `borrow_rate`, `increased_borrow_rate`, `target_util`, `funding_increase`, `funding_decrease`, `threshold_stable_funding`, `threshold_decrease_funding`, `funding_min`, `funding_max`, `adl_max_pnl`, `adl_clear_target`, `deposit_fee`, `redeem_fee`, `min_order_margin`, `min_deposit`, `max_pnl_trader`, `max_pnl_withdraw`, `exec_fee` is `< 0`. |
| 2 | `keeper_rate <= MAX_KEEPER_RATE`, `fee_dom <= MAX_FEE_RATE`, `fee_non_dom <= MAX_FEE_RATE`, `max_util_open <= MAX_UTIL`, `max_util_withdraw <= MAX_UTIL`, `init_margin <= MAX_MARGIN`, `liq_fee <= MAX_LIQ_FEE`, `notional_lock <= MAX_NOTIONAL_LOCK`, `redeem_lock <= MAX_REDEEM_LOCK`. |
| 3 | `init_margin >= MIN_MARGIN` and `impact_scalar > 0`. |
| 4 | `notional_lock >= MIN_NOTIONAL_LOCK`. |
| 5 | `min_position_notional > 0` and `max_position_notional > min_position_notional`. |
| 6 | `max_open_interest >= max_position_notional`. |
| 7 | `min_order_notional > 0`, `min_order_margin > 0`, and `min_order_notional <= min_position_notional`. |
| 8 | `exec_fee <= min_order_margin`. |
| 9 | `min_deposit > 0`. |
| 10 | `deposit_fee <= MAX_FEE_RATE` and `redeem_fee <= MAX_FEE_RATE`. |
| 11 | `max_util_open > 0` and `max_util_withdraw >= max_util_open`. |
| 12 | `fee_dom >= fee_non_dom`. |
| 13 | `target_util < SCALAR_18`, `increased_borrow_rate >= borrow_rate`, and `increased_borrow_rate <= MAX_BORROW_RATE`. |
| 14 | `threshold_stable_funding <= SCALAR_18`, `threshold_decrease_funding <= threshold_stable_funding`, `funding_min <= funding_max`, `funding_max <= MAX_FUNDING_RATE`, `funding_increase <= MAX_FUNDING_RATE`, and `funding_decrease <= MAX_FUNDING_RATE`. |
| 15 | `adl_max_pnl < SCALAR_18`, `adl_max_pnl >= MIN_ADL_TRIGGER`, `adl_clear_target <= adl_max_pnl`, `adl_clear_target >= MIN_ADL_CLEAR`, `max_pnl_trader < SCALAR_18`, `adl_max_pnl <= max_pnl_trader`, `max_pnl_withdraw > 0`, and `max_pnl_withdraw <= adl_max_pnl`. |
| 16 | `max_vault_balance > 0`. |
| 17 | `min_deposit` (token-dec) times `MIN_DEPOSIT_DIVISOR` (the plain integer `100`) fits in `i128`, and the product is at most `max_vault_balance` (token-dec). |
| 18 | `maintenance_margin > liq_fee` and `init_margin > maintenance_margin`. A `liq_fee` of `0` is valid. |
| 19 | `init_margin > maintenance_margin + fee_non_dom + MIN_CHUNK_IMPACT_CAP`. |
| 20 | `min_position_notional` (token-dec) times `SCALAR_18 / MIN_CHUNK_IMPACT_CAP` fits in `i128`, and `impact_scalar` (token-dec) is at least that product. `SCALAR_18` is fixed-point one and `MIN_CHUNK_IMPACT_CAP` is `SCALAR_18 / 1000`, so the multiplier is 1000. A minimum-size fill therefore pays an impact rate of at most `MIN_CHUNK_IMPACT_CAP`. |

The rules compose into four ladders:

- `0 <= liq_fee < maintenance_margin < init_margin <= MAX_MARGIN`, with `init_margin >= MIN_MARGIN`.
- `MIN_ADL_CLEAR <= adl_clear_target <= adl_max_pnl <= max_pnl_trader < SCALAR_18`, with `adl_max_pnl >= MIN_ADL_TRIGGER` and `0 < max_pnl_withdraw <= adl_max_pnl`.
- `0 < max_util_open <= max_util_withdraw <= MAX_UTIL`.
- `0 < min_order_notional <= min_position_notional < max_position_notional <= max_open_interest`.

Eight `i128` fields are outside rule 1. Each one catches a negative value in its own rule, which raises `InvalidConfig` (700).

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

`notional_lock` and `redeem_lock` are `u64`. Rules 5 and 6 bound `max_position_notional` and `max_open_interest` from below only.

## Constants

`engine::constants` holds the market's protocol-level bounds and windows. No value here is configurable. The time-to-live constants sit outside it, and the staleness ceilings sit in the oracle. A percent label reads the value as a `SCALAR_18` fraction.

| Symbol | Value | Unit | Used by |
| --- | --- | --- | --- |
| `SCALAR_18` | `1_000_000_000_000_000_000` | fixed-point one | Every ratio, rate, and cumulative index. |
| `MAX_KEEPER_RATE` | `SCALAR_18 / 2` (50%) | `SCALAR_18` | Rule 2, the cap on `keeper_rate`. |
| `MAX_FEE_RATE` | `SCALAR_18 / 100` (1%) | `SCALAR_18` | Rule 2, the cap on `fee_dom` and `fee_non_dom`. Rule 10, the cap on `deposit_fee` and `redeem_fee`. |
| `MAX_UTIL` | `10 * SCALAR_18` (1000%) | `SCALAR_18` | Rule 2, the cap on `max_util_open` and `max_util_withdraw`. |
| `MAX_IMPACT_RATE` | `SCALAR_18 / 10` (10%) | `SCALAR_18` | `math::impact_fee`, which caps a fill's impact fee at this rate on the filled notional. |
| `MIN_CHUNK_IMPACT_CAP` | `SCALAR_18 / 1000` (0.1%) | `SCALAR_18` | Rule 19 and rule 20. |
| `MAX_MARGIN` | `SCALAR_18 / 2` (50%, 2x leverage) | `SCALAR_18` | Rule 2, the cap on `init_margin`. |
| `MIN_MARGIN` | `SCALAR_18 / 1000` (0.1%, 1000x leverage) | `SCALAR_18` | Rule 3, the floor on `init_margin`. |
| `MAX_LIQ_FEE` | `SCALAR_18 / 4` (25%) | `SCALAR_18` | Rule 2, the cap on `liq_fee`. |
| `MIN_ADL_TRIGGER` | `45 * SCALAR_18 / 100` (45%) | `SCALAR_18` | Rule 15, the floor on `adl_max_pnl`. |
| `MIN_ADL_CLEAR` | `40 * SCALAR_18 / 100` (40%) | `SCALAR_18` | Rule 15, the floor on `adl_clear_target`. |
| `SECONDS_PER_YEAR` | `31_536_000` | seconds | The basis of `MAX_BORROW_RATE` and `MAX_FUNDING_RATE`. |
| `MAX_BORROW_RATE` | `10 * SCALAR_18 / SECONDS_PER_YEAR` = `317_097_919_837` (1000% per year) | `SCALAR_18` per second | Rule 13, the cap on `increased_borrow_rate`. |
| `MAX_FUNDING_RATE` | `10 * SCALAR_18 / SECONDS_PER_YEAR` = `317_097_919_837` (1000% per year) | `SCALAR_18` per second | Rule 14, the cap on `funding_max`, `funding_increase`, and `funding_decrease`. |
| `MIN_NOTIONAL_LOCK` | `15` | seconds | Rule 4, the floor on `notional_lock`. It equals the oracle's `MAX_TRADE_STALENESS_SECONDS`, so one accepted price cannot open and then decrease the same notional. |
| `MAX_NOTIONAL_LOCK` | `86_400` (1 day) | seconds | Rule 2, the cap on `notional_lock`. |
| `DELIST_GRACE` | `86_400` (1 day) | seconds from `DelistedAt` | `set_status`, which blocks a return to a trading status after the window. `set_terminal_price`, which unlocks after it. |
| `DELIST_DEADLINE` | `7 * 86_400` (7 days) | seconds from `DelistedAt` | `execute_liquidation`, which waives `NotLiquidatable` (722) on a `Delisted` market after the deadline. |
| `MAX_REDEEM_LOCK` | `2_592_000` (30 days) | seconds | Rule 2, the cap on `redeem_lock`. |
| `MIN_DEPOSIT_DIVISOR` | `100` | plain integer | Rule 17, the multiplier on `min_deposit`. |
| `MAX_ORDERS_PER_SIDE` | `8` | count (`u32`) | `create_order`, which traps `TooManyOrders` (733) when a side already lists this many decrease orders. |

The [Market status](./status.md) page covers the delist windows, and the [Storage](./storage.md) page covers the TTL constants.
