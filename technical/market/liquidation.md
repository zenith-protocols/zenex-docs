---
sidebar_position: 13
title: Liquidation
---

# Liquidation

A liquidation force-closes one whole position at the market's effective price. `execute_liquidation` is the entry, and any account may call it. The call closes a position whose settled equity has fallen below its maintenance line. After the delist deadline it closes any position. This page holds the entry signature and its gate order, the wind-down waiver, `Position::liquidate`, the liquidation fee, and the two settlement legs this path builds.

The maintenance line and the settled equity it measures are on [Margin and leverage](./margin-and-leverage.md). The `Position` row, the full-close arithmetic in `Position::close_settled`, and the closure sweep in `Position::store` are on [Position lifecycle](./position-lifecycle.md). The fee split that the liquidation fee shares with a trade fee is on [Fees and settlement](./fee-system.md). The `liquidation` payload is on [Events](./events.md).

Units on this page follow the [units page](../units.md). Token-dec is the settlement token's decimals, and base-dec is the scale of `tokens`. `SCALAR_18` is `1_000_000_000_000_000_000`, the scale of every rate and ratio. A price is in feed precision. Time values are unix seconds. PnL means profit and loss. Every formula names the symbol that computes it.

Two timestamps differ by price source. `publish_time` and the row's `priced_at` carry the oracle report's observation time. Under a stored terminal price, `publish_time` is the ledger timestamp. `Market.now` and the delist deadline read the ledger timestamp.

## `execute_liquidation`

```rust
fn execute_liquidation(e: Env, keeper: Address, user: Address, is_long: bool, price: Bytes) -> i128;
```

| Argument | Meaning |
| --- | --- |
| `keeper` | The reward recipient. The call never authenticates it. |
| `user` | The owner of the position row. |
| `is_long` | The side of the row. Long and short rows of one `user` are independent positions. |
| `price` | The serialized oracle report. |

The return is the keeper payout (token-dec). The entry makes no `require_auth` call, so the caller signs nothing beyond the transaction. It runs in the `Active`, `OnIce`, and `Delisted` statuses.

`Market::load` runs with `newest_price` and `protective` both set to `true`. Without a stored terminal price, `protective` makes the oracle judge the report's age against `close_staleness`. The forward allowance stays at `trade_staleness`. `newest_price` prices the call at the cached mark when its `publish_time` is strictly newer than the report's. A report older than the trade window and inside the close window is accepted for a liquidation. The wide window lets a liquidation land through a feed gap or one ledger late. The `priced_at` floor bounds what an in-window report can price. [Pricing](./pricing.md) documents the price resolution and the cache. [Price verification](../oracle/verify-price.md) documents the report check and its errors.

### Gate order

The call runs seven steps in this order.

1. `Market::load` reads the status first. If the status is `Frozen` or `Retired`, it traps `MarketFrozen` (704) before any oracle call. Without a stored terminal price, the oracle then checks the report and traps on its own rejection. The load reads `vault_balance` from the vault's `total_assets` (token-dec), and each settlement then adjusts it. The load advances the funding and borrowing indices to the ledger timestamp last.
2. `Position::load` reads the row. A missing row loads as the zeroed row and writes nothing. If the effective `publish_time` is below the row's `priced_at`, `Position::require_price_not_stale` traps `StalePrice` (740). Equality passes.
3. The call computes `force` from the status and `deadline_passed`.
4. `Position::liquidate` closes the row. It traps `PositionNotFound` (720) or `NotLiquidatable` (722).
5. `Position::store` sweeps the row's pending decrease order ids first, then persists `Position::zeroed`. It returns the summed escrow refund (token-dec). The row lists at most `MAX_ORDERS_PER_SIDE` (8) ids, which bounds the sweep. If a listed order has no stored row, the sweep traps `OrderNotFound` (730).
6. The `liquidation` receipt publishes, with `price` set to the exit side of the effective price (feed precision).
7. `Settlement::compute_liquidation` builds the legs and `Settlement::settle` moves the tokens. If the vault draw exceeds `vault_balance`, the settlement traps `VaultInsolvent` (755). `Market::store` writes `MarketData`, and the call returns the keeper payout.

### Errors

The step column names the step above that raises each error.

| Step | Error | Condition |
| --- | --- | --- |
| 1 | `MarketFrozen` (704) | The status is `Frozen` or `Retired`. |
| 1 | `OracleError` | No terminal price is stored, and an oracle gate rejects the report against the market's `feed_id`. Codes 780, 781, 782, 784, 790, and 793 apply. |
| 1 | verifier error | No terminal price is stored, and the Chainlink verifier rejects the report. The verifier's own code surfaces. |
| 2 | `StalePrice` (740) | The effective `publish_time` is below the row's `priced_at`. |
| 4 | `PositionNotFound` (720) | The row's `notional` is `0`. |
| 4 | `NotLiquidatable` (722) | The settled equity covers the maintenance requirement and `force` is false. |
| 5 | `OrderNotFound` (730) | A swept decrease order id has no stored `Order` row. |
| 7 | `VaultInsolvent` (755) | The settlement's vault draw exceeds `vault_balance`. |
| 7 | token or vault error | A transfer to the keeper, the treasury, or the vault, or the vault's `strategy_withdraw`, fails. The callee's own code surfaces. |

Every trap reverts the whole transaction. The price cache write, the index accrual, the banked funding, and the sweep all revert with it. A `VaultInsolvent` trap therefore leaves the position and its resting decrease orders in place.

### Storage

The entry extends the instance TTL (time to live) before it runs. The call reads the instance keys `Status`, `TerminalPrice` (presence), `Config`, `Token`, `Vault`, and `Treasury`. It reads `DelistedAt` when the status is `Delisted`. Without a stored terminal price it also reads `Oracle` and `FeedId`, and it reads and may write the temporary `PriceCache`. It reads and writes `MarketData` in the shared tier. It reads and writes `Position(user, is_long)`, removes each swept `Order(user, id)`, and may raise `ClaimableCredit(user)` in the user tier. The [Storage page](./storage.md) gives the TTL of each tier.

## The delist deadline waives eligibility

`force` is `true` when the status is `Delisted` and `deadline_passed` returns `true`. `deadline_passed` is `now >= delisted_at + DELIST_DEADLINE` with saturating addition. `delisted_at` is the timestamp the first delist anchored (seconds). `DELIST_DEADLINE` is `604_800` seconds, which is 7 days. [Market status](./status.md) holds the anchor rule and the rest of the wind-down.

The waiver replaces the eligibility check and leaves every other gate in place. The liquidation fee is charged at the same rate, so a healthy position closed under the waiver keeps its equity net of that fee.

A stored terminal price runs on its own clock. `set_terminal_price` (owner only) unlocks once `DELIST_GRACE` passes after `delisted_at`. `DELIST_GRACE` is `86_400` seconds, which is 1 day. The waiver follows six days later. Between the two, a liquidation prices flat while `force` is `false`, so the eligibility gate still runs. While the price is stored, `Market::load` marks both `bid` and `ask` at it on every price-bearing entry. That branch replaces the oracle call, so the `price` argument is never read or checked.

## `Position::liquidate`

```rust
fn liquidate(&mut self, e: &Env, market: &mut Market, user: &Address, is_long: bool, force: bool) -> Liquidation;
```

`user` and `is_long` address the same row. `market` is the loaded working set. The path reads its price and its `Config`. It writes the banked funding and the freed notional, tokens, and margin back to `MarketData`. `user` receives earned funding as a claimable credit. `force` waives the eligibility gate alone. The return is the `Liquidation` outcome struct, which differs from the `liquidation` event that step 6 publishes.

`Position::liquidate` runs four steps in this order.

1. If the row's `notional` is `0`, `Position::require_exists` traps `PositionNotFound` (720).
2. `Position::settle` prices the whole row at the call's price. It banks the funding and borrowing accruals, reads the full-close trade fees, applies the profit haircut, and returns `Settled { fees, pnl, equity }`.
3. If `force` is false and `Position::is_liquidatable` returns false, the call traps `NotLiquidatable` (722).
4. `Position::close_settled` closes the row against those numbers and returns a `Decrease`.

The predicate of step 3 is `settled.equity < ceil(notional * maintenance_margin / SCALAR_18)`. `settled.equity` is signed (token-dec), and `notional` is the row's size (token-dec). `maintenance_margin` is a `SCALAR_18` fraction from `Config`. `Position::margin_requirement` computes the right side through `math::apply_factor_ceil`. A row whose settled equity equals the requirement is healthy. Because `settled.equity` uses the haircut `pnl`, a winner can fall below the line while its side's profit is above the haircut allowance. `Position::decrease` and `Position::require_valid` apply the same predicate and trap `PositionLiquidatable` (723), so liquidation is the only legal transition for a row below the line.

The `Decrease` of step 4 carries `notional`, `tokens`, `margin` (gross), `pnl` (post-haircut), `bad_debt`, and `fees`. Its `returned` field is `max(settled.equity, 0)`. This page names that amount `equity`. `Position::liquidate` copies the other fields into the `Liquidation` outcome and sets `bad_debt` to `max(-settled.equity, 0)`. It computes `liq_fee` and sets the outcome's `returned` to `equity` less the fee.

### The fee is capped at equity

$$
\text{liq\_fee} = \min\left(\left\lceil \frac{\text{notional} \times \text{liq\_fee\_rate}}{\text{SCALAR\_18}} \right\rceil,\ \text{equity}\right)
$$

$$
\text{returned} = \text{equity} - \text{liq\_fee}
$$

Where:

- `notional` is the force-closed size from the `Decrease` of step 4 (token-dec).
- `liq_fee_rate` is `Config.liq_fee`, a `SCALAR_18` fraction. `Config::check_valid` bounds it at or below `MAX_LIQ_FEE` (`SCALAR_18 / 4`, 25%) and strictly below `maintenance_margin`.
- `equity` is the settled equity floored at zero (token-dec). It is net of `Fees::debit` and gross of `liq_fee`.
- `liq_fee` and `returned` are the two outcome fields this section computes (token-dec).

`Position::liquidate` rates the fee through `math::apply_factor_ceil`, which rounds up, and takes the minimum against `equity`. The fee is the configured share of the closed size, and it takes at most the equity that remains.

The cap makes the fee safe to charge on every path. `returned` never falls below zero, so the fee cannot mint bad debt and cannot make a self-liquidation profitable. If the rated amount reaches `equity`, the fee takes the whole remainder. A row that settles negative has an `equity` of `0`, so its fee is `0` and its shortfall lands on `bad_debt` alone.

Each row below closes a long of 100.0 notional and 10.0 margin, opened at a price of 10.0. `maintenance_margin` is 5%, so the requirement is 5.0. `liq_fee_rate` is 1%, so the rated fee is 1.0. The full-close base and impact fees total 0.4, and no funding or borrowing has accrued. Amounts are whole settlement tokens.

| Exit price | `pnl` | Settled equity | `liq_fee` | `returned` | `bad_debt` |
| --- | --- | --- | --- | --- | --- |
| 9.80 | -2.0 | 7.6 | 1.0 | 6.6 | 0 |
| 9.20 | -8.0 | 1.6 | 1.0 | 0.6 | 0 |
| 9.10 | -9.0 | 0.6 | 0.6 | 0 | 0 |
| 8.50 | -15.0 | -5.4 | 0 | 0 | 5.4 |

The first row has equity above the requirement, so only the waiver closes it. The other three fall below 5.0. In the third row the fee takes all 0.6 of equity, and the fourth row has no equity to charge.

One invariant spans the outcome fields. Every term is token-dec. `margin` is the gross margin that `Position::close_settled` frees. `debit` is what `Fees::debit` returns over the same `fees`.

```text
returned + liq_fee + debit == margin + pnl + bad_debt
```

In the third row, 0 + 0.6 + 0.4 equals 10.0 - 9.0 + 0.

### A liquidation ignores the decrease lock

The decrease lock gates `Position::decrease`, and the auto-deleveraging path runs through that same function. `Position::liquidate` closes a row at any point in its `notional_lock` window. It reads neither `locked_notional` nor `unlocks_at`.

`Position::close_settled` zeroes both lock fields and leaves `priced_at` at its stored value. `Position::store` then persists `Position::zeroed`, so the closed row carries a `priced_at` of `0`. The next open on that side starts from that floor, which [Pricing](./pricing.md#the-position-price-floor) documents.

## Settlement legs

`Settlement::compute_liquidation` starts from `Settlement::fee_split` over the liquidation's `fees` and its `liq_fee`. The liquidation fee splits between the keeper, the treasury, and the vault like a trade fee. [Fees and settlement](./fee-system.md) holds that split, the treasury rate read through `TreasuryClient::get_rate`, and the transfer order. The funding accrual reaches no leg. `Position::settle` banks it at step 2 of `Position::liquidate`. Paid funding stays on the contract in `credit_pool`, and earned funding becomes a claimable credit for `user`.

Two legs are specific to this path.

| Leg | Value |
| --- | --- |
| `trader` | `liquidation.returned + refund` |
| `vault` | the split's vault cut, less `liquidation.pnl + liquidation.bad_debt` |

`refund` is the escrow that `Position::store` swept from the cancelled decrease orders (token-dec). A decrease order escrows its `exec_fee` alone, so the refund is the sum of those fees. One transfer carries the post-fee remainder and the refund together. Each `cancel_order` receipt itemizes its own refund. If the token rejects that transfer, the amount becomes a claimable credit, under the rule on [Fees and settlement](./fee-system.md).

The vault leg absorbs both the realized PnL and the shortfall. A profitable close draws `pnl` from the vault, a losing close pays it in, and `bad_debt` is always a draw. The vault draw runs before every payout. If a net draw exceeds the `vault_balance` that the working set tracks, `Settlement::settle` traps `VaultInsolvent` (755).

### The keeper payout

The keeper payout is the fee cut alone. A liquidation consumes no order, so no `exec_fee` joins it.

$$
\text{payout} = \left\lfloor \frac{(\text{base} + \text{impact} + \text{liq\_fee}) \times \text{keeper\_rate}}{\text{SCALAR\_18}} \right\rfloor
$$

Where:

- `base` and `impact` are the full-close trade fees that the `fees` struct carries (token-dec).
- `liq_fee` is the charged liquidation fee (token-dec).
- `keeper_rate` is `Config.keeper_rate`, a `SCALAR_18` fraction bounded at or below `MAX_KEEPER_RATE` (`SCALAR_18 / 2`, 50%).
- `payout` is token-dec. `Settlement::fee_split` computes it through `math::apply_factor_floor`, and `execute_liquidation` returns it.

The rate is flat, so the payout does not grow as equity falls. The rows below use a `keeper_rate` of 10% and the fees of the table above.

| Row | `base + impact + liq_fee` | Payout |
| --- | --- | --- |
| Exit price 9.20 | 1.4 | 0.14 |
| Exit price 9.10 | 1.0 | 0.10 |
| Exit price 8.50 | 0.4 | 0.04 |

The last row pays the keeper although `liq_fee` is `0`. The trade fees settle in full, and any part the margin cannot cover sits in `bad_debt`.

## Events

Each swept decrease order emits `cancel_order` before the `liquidation` receipt, and both publish before the settlement transfers run. [Events](./events.md) holds the full emission order and the payload layout.
