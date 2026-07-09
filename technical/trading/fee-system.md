---
sidebar_position: 5
title: Fee System
---

# Fee System

Four itemized costs settle on every fill and close: the **trade fee** (base), **impact**, **funding**, and **borrowing**. They are computed gross and deducted from the position's collateral or the trader's proceeds. The trade fee splits between the vault, the treasury, and the keeper. Borrowing splits between the vault and the treasury, and funding moves through the internal pool. All rates are `SCALAR_18` fractions set per market by governance.

## Trade Fee (Skew-Split)

The trade fee is split by the fill's effect on market **skew**, the imbalance between long and short base tokens. The token-size change of the fill is decomposed into a worsening part (moving the book further from balance) and an improving part (moving it toward balance), then mapped pro-rata onto the fill's notional:

- The **worsening** leg pays `fee_dom`, the dominant-side rate.
- The **improving** leg pays `fee_non_dom`, the non-dominant rate.

"Dominant" is decided by **token imbalance**, not notional. All rounding moves toward the higher fee. Config validation enforces `fee_dom >= fee_non_dom` and caps both at `MAX_FEE_RATE` (`SCALAR_18 / 100`, 1%).

## Impact Fee

$$
\text{impact} = \frac{\text{worsening\_notional}}{\text{impact\_divisor}}
$$

The impact fee is charged on the **worsening leg only**. A trade that pushes the book further out of balance pays it, while a balancing trade does not. `impact_divisor` is a `SCALAR_18` config value floored at `MIN_IMPACT` (`10 * SCALAR_18`).

The trade fee and the impact fee together are the "trade fee" that the keeper and treasury cuts apply to.

## Borrowing Fee

The borrowing fee compensates the vault for the liquidity that open positions reserve. It follows a kink (piecewise-linear) utilization model and is charged **per second** via a cumulative index. Both sides pay the same kink rate, since open interest on either side reserves vault capacity. See [Borrowing Rate](./borrowing-rate.md). Borrowing revenue splits between the vault and the treasury.

## Funding

Funding is a peer-to-peer transfer between longs and shorts, following a velocity model with an internal pool and per-user claimable balances. It carries no protocol cut. A position that owes funding pays it from collateral at settlement, while a position owed funding has the amount credited to its claimable balance, redeemed later through `claim_funding`. See [Funding Rate](./funding-rate.md).

## The Fee Split

Settlement is gross-basis. From the four itemized costs:

- The **keeper** takes its `keeper_rate` cut of the trade fee (base plus impact). This is the reward for the permissionless fill.
- The **treasury** takes its rate (read live from the treasury contract, clamped to `[0, MAX_KEEPER_RATE]`) of the trade fee, the borrowing fee, and any forfeit.
- The **vault** banks all remainders, funds realized PnL through `strategy_withdraw`, and absorbs `bad_debt`.

Fees are subtracted from the posted collateral at fill, so a later fee or rate increase cannot break an existing order allowance. A fill whose fees erode the collateral below the margin floors rejects with `InsufficientMargin` instead of over-drawing the allowance. A failed direct payout to a trader falls back to a pull allowance (`pay_trader`), so a third-party keeper fill never stalls on the receiver.

## Realized-Profit Haircut

While a side's pending PnL exceeds `max_pnl_trader` of half the vault balance, a closing profit on that side is scaled by `allowance / side_PnL`, cutting every close during the overhang by the same live factor. The withheld share stays with the vault. A loss passes through unchanged.

Slicing a close across many fills partially escapes the haircut, because each fill re-reads a relieved ratio. The same overhang arms [auto-deleveraging](./auto-deleveraging.md), which bounds what slicing can extract.

## Liquidation Fee

Liquidation adds a fifth cost, the liquidation fee `ceil(liq_fee * notional)`, which decides the [two-tier liquidation](./liquidation.md) outcome. On the soft tier no liquidation fee is charged and the remaining equity is returned to the trader. On the hard tier the remaining equity no longer covers the fee, and all of it is forfeited to the vault. The treasury takes its rate of the forfeit.

## Treasury Rate Is Read Live

The treasury's rate is fetched from the treasury contract on every settlement via `get_rate`, then clamped to `[0, MAX_KEEPER_RATE]`. This lets governance retune the protocol's fee share without redeploying or reconfiguring the trading contract. See [Treasury](../treasury/overview).
