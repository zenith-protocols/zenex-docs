---
sidebar_position: 8
title: Liquidation
---

# Liquidation

Liquidation protects the vault from positions whose losses outrun their margin. A keeper force-closes the whole position with `execute_liquidation(keeper, user, is_long, price)` at a verified price. Unlike a trader's Decrease order, liquidation is not the owner's intent. It is triggered by anyone once the position becomes eligible. Liquidation executes on `Active`, `OnIce`, and `Delisted` markets. On a `Frozen` or `Retired` market the call is blocked with `MarketFrozen` (704), and if the user has no position on that side it raises `PositionNotFound` (720).

## Eligibility

A position is liquidatable when its **equity** (collateral plus unrealized PnL) falls below the maintenance margin:

$$
\text{equity} < \lceil \text{maintenance\_margin} \times \text{notional} \rceil
$$

The check runs on the settled close: equity here is the post-fee remainder, with the close's own trade fee, borrowing, and paid funding deducted, and a profit measured post-haircut. A position can also cross this line purely from fee accrual (funding and borrowing eat into equity), even with a flat price. Because equity includes unrealized PnL while the initial-margin floor did not, the [gap between the two margin lines](./margin-and-leverage.md) is the buffer that must erode first. The decrease lock that gates trader-initiated decreases is not checked here: liquidation calls the close path directly, so a position inside its `notional_lock` window is still liquidatable.

There is one further trigger: the **wind-down waiver**. Once a `Delisted` market's 7-day delist deadline (`DELIST_DEADLINE`) has passed, any remaining position can be force-closed regardless of health, so the market can be wound down. A healthy position hit this way flows through the soft tier and keeps its full equity. The close prices at the market's flat terminal price once one has been stored, and at a verified feed price until then.

A healthy position with no waiver in effect raises `NotLiquidatable` (722).

Before eligibility is evaluated, the verified price must be at least as new as the price the position was last marked against (`priced_at`, the `publish_time` stamped by the last fill), or the call aborts with `StalePrice` (740).

## Liquidation Price

The eligibility condition can be restated as a price level. With the entry price implied by the stored fields (`notional * SCALAR_18 / tokens`) and costs meaning the accrued borrowing plus paid funding, the position crosses the maintenance line at approximately:

$$
P_{\text{liq}} \approx P_{\text{entry}} \times \left(1 \pm \left(\text{maintenance\_margin} + \frac{\text{costs} - \text{collateral}}{\text{notional}}\right)\right)
$$

with plus for a long and minus for a short. In leverage terms, ignoring costs, a long at leverage L liquidates around:

$$
P_{\text{liq}} \approx P_{\text{entry}} \times \left(1 + \text{maintenance\_margin} - \frac{1}{L}\right)
$$

This is an approximation, and the exact trigger sits slightly closer to entry, for three reasons. Eligibility is judged on the settled close, so the close's own trade fee (base plus impact) is part of what equity must cover. The close prices at the exit side of the verified spread (`bid` for a long, `ask` for a short), not the mid. And a profit-side close during a haircut overhang measures post-haircut PnL. Because costs grow with accrued borrowing and funding, the level also drifts toward entry over time. Adding collateral moves it away.

## Two Tiers

The outcome is decided by the **liquidation margin** `ceil(liq_fee * notional)`, compared against the position's equity at liquidation time:

| Tier | Condition | Receipt `liq_fee` | Remainder |
|---|---|---|---|
| **Soft** | Equity still covers the liquidation margin | `0` | Returned to the trader |
| **Hard** | Equity below the liquidation margin | The full liquidation margin, as a tier marker | Entire equity forfeited (trader gets zero): the treasury takes its rate, the vault the rest |

On the soft tier the position is close to the line but not underwater on the protocol's terms, so no penalty is levied and the post-fee remainder (equity) is returned to the trader. On the hard tier the entire remaining equity is forfeited: the treasury takes its rate of the forfeit and the vault banks the rest. No separate fee amount is collected: the receipt's `liq_fee` field carries the full liquidation margin `ceil(liq_fee * notional)` as the tier marker, and it always exceeds the forfeited equity, which on this tier is by definition below the liquidation margin. `liq_fee` is a `SCALAR_18` config value capped at `MAX_LIQ_FEE` (25%).

Any shortfall past the freed margin is `bad_debt`, absorbed by the vault. The keeper receives the `keeper_rate` cut of the close's trade fee. Because liquidation fully closes the position, every pending decrease order still resting on that side is cancelled, one `cancel_order` event per id, and their escrowed execution fees are refunded to the trader on top of any soft-tier remainder. The call emits a `liquidation` receipt (with `liq_fee = 0` marking the soft tier, `> 0` the hard tier, and the remainder on `returned` for soft or `forfeit` for hard), and the removed position row lands in the transaction's ledger entry changes.

## Vault Drawdown, Not Insolvency

Zenex is a synthetic perp: the vault holds only the settlement token (USDC on the current testnet deployment), never the underlying that positions reference. A trader's downside is capped at their posted margin, and the vault has no debt beyond paying PnL from its own balance, so there is no classic insolvency.

What can still occur is a per-position drawdown. If a fast move drives a loss past the margin before a keeper liquidates, the vault recovers only the freed margin and eats the rest as `bad_debt`. The maintenance-margin buffer and the leverage cap keep this rare, but gaps on volatile feeds can produce it. In aggregate the protocol bounds the vault's exposure to winning traders through [auto-deleveraging](./auto-deleveraging.md), which caps how much a winning side can extract while its pending PnL overhangs the vault. Timely, permissionless liquidation is what keeps individual drawdowns small.
