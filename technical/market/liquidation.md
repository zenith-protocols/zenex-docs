---
sidebar_position: 13
title: Liquidation
---

# Liquidation

`execute_liquidation` force-closes one position at the market's effective price. The call is permissionless, and it closes the whole row at once. This page holds the entry, the sequence of its gates, the wind-down waiver, and `Position::liquidate`. It also holds the liquidation fee, the settlement legs the path builds, and the receipt.

The maintenance line and the settled equity it measures are on [Margin and leverage](./margin-and-leverage.md). The `Position` row, the full-close arithmetic in `Position::close_settled`, and the closure sweep in `Position::store` are on [Position lifecycle](./position-lifecycle.md). The fee split that the liquidation fee shares with a trade fee is on [Fees and settlement](./fee-system.md). The `Liquidation` payload is on [Events](./events.md).

Units on this page: token-dec is the settlement token's decimals. base-dec is the `tokens` scale. `SCALAR_18` is `1_000_000_000_000_000_000`, the scale of every rate and ratio. A price is in feed precision, the scale the [units page](../units.md) defines. Time values are unix seconds. `publish_time` and the row's `priced_at` carry the oracle report's observation time. Under a stored terminal price, `publish_time` is the ledger timestamp. `Market.now` and the delist deadline read the ledger timestamp. Every formula names the symbol that computes it.

## `execute_liquidation`

```rust
fn execute_liquidation(e: Env, keeper: Address, user: Address, is_long: bool, price: Bytes) -> i128;
```

Any account may submit the call. The call makes no `require_auth`, and `keeper` is the reward recipient and never an authorizer. `user` and `is_long` address the position row. `price` is the serialized oracle report. The return is the keeper payout (token-dec).

`Market::load` runs with `newest_price` set to `true` and `protective` set to `true`. When no terminal price is stored, the oracle checks the report's age against its wider `close_staleness` window. The cached price then substitutes for the payload when the cached `publish_time` is strictly newer than the submitted report's `publish_time`. A report older than the trade window and inside the close window therefore serves a liquidation, and not an order fill. [Pricing](./pricing.md) documents the price resolution and the cache. [Price verification](../oracle/verify-price.md) documents the report check and the errors it raises.

The call runs seven steps in this order:

1. `Market::load` reads the status first. When the status is `Frozen` or `Retired`, it traps `MarketFrozen` (704). The status check precedes the oracle call. When no terminal price is stored, the oracle does a check of the report and traps on its own rejection. The load then advances the funding and borrowing indices to the current timestamp.
2. `Position::load` reads the row. When the effective `publish_time` is below the row's `priced_at` (seconds), `require_price_not_stale` traps `StalePrice` (740). Equality passes.
3. `force` is computed from the status and `deadline_passed`.
4. `Position::liquidate` closes the row. It traps `PositionNotFound` (720) or `NotLiquidatable` (722).
5. `Position::store` persists `Position::zeroed` and runs the closure sweep over the row's pending decrease order ids. It returns the summed escrow refund (token-dec). If a listed order row is absent, the sweep traps `OrderNotFound` (730).
6. The `Liquidation` receipt publishes, with `price` set to the exit side of the effective price (feed precision).
7. `Settlement::compute_liquidation` builds the legs and `Settlement::settle` moves the tokens. When the vault draw is greater than `vault_balance`, the settlement traps `VaultInsolvent` (755). `Market::store` writes `MarketData`, and the call returns the keeper payout.

The errors the call can raise, in the order the gates run. The step column names the step above that raises each one:

| Step | Error | Condition |
| --- | --- | --- |
| 1 | `MarketFrozen` (704) | The status is `Frozen` or `Retired`. |
| 1 | oracle error | No terminal price is stored, and the oracle rejects the report against the market's `feed_id`. |
| 2 | `StalePrice` (740) | The effective `publish_time` is below the row's `priced_at`. |
| 4 | `PositionNotFound` (720) | The row's `notional` is `0`. |
| 4 | `NotLiquidatable` (722) | The settled equity covers the maintenance requirement and `force` is false. |
| 5 | `OrderNotFound` (730) | A swept decrease order id has no stored `Order` row. |
| 7 | `VaultInsolvent` (755) | The settlement's vault draw is greater than `vault_balance`. |

## The wind-down waiver

`force` is `true` when the status is `Delisted` and `deadline_passed` returns `true`. `deadline_passed` is `now >= delisted_at + DELIST_DEADLINE` with saturating addition, where `delisted_at` is the seconds timestamp the first delist anchored. `DELIST_DEADLINE` is `604_800` seconds, which is 7 days. [Market status](./status.md) holds the anchor rule and the rest of the wind-down.

The waiver skips the eligibility check alone. Every other gate above still runs, and the liquidation fee is charged at the same rate. A healthy position closed under the waiver keeps its equity net of that fee.

A stored terminal price runs on its own clock and is not part of the waiver. `set_terminal_price` (owner only) unlocks once `DELIST_GRACE` passes after `delisted_at`, which is `86_400` seconds, or 1 day. The waiver follows six days later. A liquidation can therefore price flat while `force` is still false and the eligibility gate still runs. While the price is stored, `Market::load` marks both `bid` and `ask` at it on every price-bearing entry. That branch replaces the oracle call, so the `price` argument stands unread and unchecked.

## `Position::liquidate`

```rust
fn liquidate(&mut self, e: &Env, market: &mut Market, user: &Address, is_long: bool, force: bool) -> Liquidation;
```

`user` and `is_long` address the same position row. `market` is the loaded working set. The path reads its price and its `Config`. It writes the banked funding and the freed notional, tokens, and margin back to `MarketData`. `user` receives the earned funding as a claimable credit. `force` waives the eligibility gate alone.

`Position::liquidate` runs four steps in this order:

1. When the row's `notional` is `0`, `require_exists` traps `PositionNotFound` (720).
2. `Position::settle` prices the whole row at the call's price. It banks the funding and borrowing accruals, reads the full-close trade fees, and returns `Settled { fees, pnl, equity }`.
3. If `force` is false and `Position::is_liquidatable` returns false, the call traps `NotLiquidatable` (722). The predicate is `settled.equity < ceil(notional * maintenance_margin / SCALAR_18)`. `settled.equity` is the settled equity of step 2 (token-dec), and `notional` is the row's size (token-dec). `maintenance_margin` is a `SCALAR_18` fraction from `Config`. `Position::margin_requirement` computes the right side. A row exactly at the requirement is not liquidatable.
4. `Position::close_settled` closes the row against those numbers and returns a `Decrease`. That struct's `returned` field is `max(settled.equity, 0)` (token-dec). This page names that amount `equity`, and it keeps `returned` for the `Liquidation` field, which is `equity` less the fee.

The returned `Liquidation` carries `notional`, `tokens`, `margin`, `pnl`, and `fees` straight from the `Decrease` of step 4, plus the two fields the next section computes. `bad_debt` is `max(-settled.equity, 0)` and passes through unchanged.

### The liquidation fee

$$
\text{liq\_fee} = \min\left(\left\lceil \frac{\text{notional} \times \text{liq\_fee\_rate}}{\text{SCALAR\_18}} \right\rceil,\ \text{equity}\right)
$$

$$
\text{returned} = \text{equity} - \text{liq\_fee}
$$

`notional` is the force-closed size (token-dec), read from the `Decrease` of step 4. `liq_fee_rate` is `Config.liq_fee`, a `SCALAR_18` fraction bounded at or below `MAX_LIQ_FEE` (`SCALAR_18 / 4`, 25%) and validated strictly below `maintenance_margin`. `equity` is the pre-fee remainder of step 4 (token-dec), the settled equity floored at zero. It is net of `Fees::debit` and gross of `liq_fee`. `liq_fee` and `returned` are the two `Liquidation` fields this section computes, both token-dec. `Position::liquidate` computes the rated amount through `math::apply_factor_ceil`, which rounds up, and takes the minimum against `equity`.

The cap is the whole reason the fee is safe to charge on every path. `returned` never falls below zero, so the fee cannot mint bad debt and cannot make a self-liquidation profitable. If the rated amount reaches `equity`, the fee takes the whole remainder and `returned` is `0`. A row that settles negative has an `equity` of `0`, so its fee is `0` and its shortfall lands on `bad_debt` alone.

One invariant spans the calls and ties the returned fields together. Every term is token-dec. `margin` is the gross margin `Position::close_settled` frees onto the `Liquidation`. `debit` is what `Fees::debit` returns over the same `fees`. `Position::liquidate` computes `returned` and `liq_fee`. `pnl` is the post-haircut profit and loss (PnL) of the full size, and `bad_debt` is `max(-settled.equity, 0)`:

```text
returned + liq_fee + debit == margin + pnl + bad_debt
```

### The lock and the price floor

The decrease lock gates `Position::decrease`, and the auto-deleveraging path runs through that same function. `Position::liquidate` closes a row at any point in its `notional_lock` window. It reads neither `locked_notional` nor `unlocks_at`.

`Position::close_settled` leaves `priced_at` at its stored value, and `Position::store` then persists `Position::zeroed`. The closed row therefore carries a `priced_at` of `0`, and the next open on that side starts from that floor.

## Settlement

`Settlement::compute_liquidation` starts from `Settlement::fee_split` over the liquidation's `fees` and its `liq_fee`. The split total is `fees.base + fees.impact + liq_fee` (token-dec). The keeper takes `keeper_rate` of that total. The treasury takes its own rate of that total, plus the same rate of `fees.borrowing`. That rate is read once per settlement from the treasury contract, through `TreasuryClient::get_rate`. The vault takes what is left of the total and of `fees.borrowing`, and the keeper takes no cut of the borrowing fee. `fees.funding` reaches no leg. `Position::settle` banks it at step 2, where paid funding stays on the contract in `credit_pool` and earned funding becomes a claimable credit for `user`. Two legs are specific to this path:

| Leg | Value |
| --- | --- |
| `trader` | `liquidation.returned + refund` |
| `vault` | the split's vault cut, less `liquidation.pnl + liquidation.bad_debt` |

`refund` is the escrow `Position::store` swept from the cancelled decrease orders (token-dec). A cancelled decrease order escrows its `exec_fee` alone, so the refund is the sum of those fees. One transfer carries the post-fee remainder and that refund together. Each accompanying `CancelOrder` event itemizes its own refund.

The vault leg absorbs both the realized PnL and the shortfall. A profitable close draws `pnl` from the vault, a losing close pays it in, and `bad_debt` is always a draw. When a net draw is greater than the `vault_balance` the working set tracks, `Settlement::settle` traps `VaultInsolvent` (755). A trader transfer that the token rejects becomes a claimable credit instead, under the rule on [Fees and settlement](./fee-system.md).

The keeper payout is the fee cut alone. An `exec_fee` reaches the keeper through an order, and this path settles the position directly:

$$
\text{payout} = \left\lfloor \frac{(\text{base} + \text{impact} + \text{liq\_fee}) \times \text{keeper\_rate}}{\text{SCALAR\_18}} \right\rfloor
$$

`base` and `impact` are the full-close trade fees the `fees` struct carries (token-dec). `liq_fee` is the charged fee (token-dec). `keeper_rate` is a `SCALAR_18` fraction from `Config`. The payout is token-dec, `Settlement::fee_split` computes it through `math::apply_factor_floor`, and `execute_liquidation` returns it. The rate is flat, so a keeper who waits for equity to fall earns no more.

## Events

The sweep publishes first. `Position::store` emits one `CancelOrder` per swept decrease order id at step 5, and the `Liquidation` receipt follows at step 6. Both land before the settlement transfers run. An indexer that reads a `Liquidation` therefore has already seen every cancellation folded into that call's trader payout.
