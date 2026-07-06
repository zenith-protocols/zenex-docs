---
sidebar_position: 8
title: Liquidation
---

# Liquidation

Liquidation protects the vault from positions whose losses outrun their margin. A keeper force-closes the whole position with `execute_liquidation(keeper, user, is_long, price)` at a verified price. Unlike a trader's Decrease order, liquidation is not the owner's intent; it is triggered by anyone once the position becomes eligible.

## Eligibility

A position is liquidatable when its **equity** (collateral plus unrealized PnL) falls below the maintenance margin:

$$
\text{equity} < \text{maintenance\_margin} \times \text{notional}
$$

A position can cross this line purely from fee accrual (funding and borrowing eat into equity), even with a flat price. Because equity includes unrealized PnL while the initial-margin floor did not, the [gap between the two margin lines](./margin-and-leverage.md) is the buffer that must erode first.

There is one further trigger: the **wind-down waiver**. Once a `Delisted` market's 7-day delist deadline (`DELIST_DEADLINE`) has passed, any remaining position can be force-closed regardless of health, so the market can be wound down. A healthy position hit this way flows through the soft tier and keeps its full equity.

A healthy position with no waiver in effect raises `NotLiquidatable` (722).

## Two Tiers

The outcome is decided by the **liquidation margin** `ceil(liq_fee * notional)`, compared against the position's equity at liquidation time:

| Tier | Condition | Liquidation fee | Remainder |
|---|---|---|---|
| **Soft** | Equity still covers the liquidation margin | Not charged | Returned to the trader |
| **Hard** | Equity below the liquidation margin | Charged | Forfeited to the vault (trader gets zero) |

On the soft tier the position is close to the line but not underwater on the protocol's terms, so no penalty is levied and the post-fee remainder (equity) is returned to the trader. On the hard tier the liquidation fee `ceil(liq_fee * notional)` is charged and the post-fee remainder is forfeited to the vault. `liq_fee` is a `SCALAR_18` config value capped at `MAX_LIQ_FEE` (25%).

Any shortfall past the freed margin is `bad_debt`, absorbed by the vault. The keeper receives the `keeper_rate` cut of the close's trade fee. The call emits a `liquidation` receipt (with `liq_fee = 0` marking the soft tier, `> 0` the hard tier, and the remainder on `returned` for soft or `forfeit` for hard) plus a zeroed `position_update`.

## Vault Drawdown, Not Insolvency

Zenex is a synthetic perp: the vault holds only the settlement token (USDC), never the underlying that positions reference. A trader's downside is capped at their posted margin, and the vault has no debt beyond paying PnL from its own balance, so there is no classic insolvency.

What can still occur is a per-position drawdown. If a fast move drives a loss past the margin before a keeper liquidates, the vault recovers only the freed margin and eats the rest as `bad_debt`. The maintenance-margin buffer and the leverage cap keep this rare, but gaps on volatile feeds can produce it. In aggregate the protocol bounds the vault's exposure to winning traders through [auto-deleveraging](./auto-deleveraging.md), which caps how much a winning side can extract while its pending PnL overhangs the vault. Timely, permissionless liquidation is what keeps individual drawdowns small.
