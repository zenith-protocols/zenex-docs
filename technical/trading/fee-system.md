---
sidebar_position: 5
title: Fee System
---

# Fee System

Four itemized costs settle on every fill and close: the **base fee**, **impact**, **funding**, and **borrowing**. They are computed gross and deducted from the position's collateral or the trader's proceeds. The base and impact fees together form the **trade fee**, which splits between the vault, the treasury, and the keeper. Borrowing splits between the vault and the treasury, and funding moves through the internal pool. On top of these, a flat **execution fee** escrowed with every order pays the keeper at fill. The proportional rates are `SCALAR_18` fractions. The per-market ones live in the market's config, and the treasury's share is stored on the treasury contract. The execution fee is a flat amount in the settlement token.

## Base Fee (Skew-Split)

The base fee is split by the fill's effect on market **skew**, the imbalance between long and short base tokens. The token-size change of the fill is decomposed into a worsening part (moving the book further from balance) and an improving part (moving it toward balance), then mapped pro-rata onto the fill's notional:

- The **worsening** leg pays `fee_dom`, the dominant-side rate.
- The **improving** leg pays `fee_non_dom`, the non-dominant rate.

"Dominant" is decided by **token imbalance**, not notional. All rounding moves toward the higher fee. Config validation enforces `fee_dom >= fee_non_dom` and caps both at `MAX_FEE_RATE` (`SCALAR_18 / 100`, 1%).

## Impact Fee

$$
\text{impact} = \left\lceil \frac{\text{worsening\_notional} \times \text{SCALAR\_18}}{\text{impact\_divisor}} \right\rceil
$$

The impact fee is charged on the **worsening leg only**. A trade that pushes the book further out of balance pays it, while a balancing trade does not. `impact_divisor` is a `SCALAR_18` fixed-point config value floored at `MIN_IMPACT` (`10 * SCALAR_18`), and the division rounds up, toward a higher fee.

The base fee and the impact fee together form the trade fee that the keeper and treasury cuts apply to.

## Borrowing Fee

The borrowing fee compensates the vault for the liquidity that open positions reserve. It follows a kink (piecewise-linear) utilization model and is charged **per second** via a cumulative index. The side holding the greater base-token exposure pays, at a kink rate computed from that side's own utilization against `max_util_open` of half the vault balance. The smaller side accrues nothing, and a token tie charges both sides, each at the rate from its own utilization. See [Borrowing Rate](./borrowing-rate.md). Borrowing revenue splits between the vault and the treasury.

## Funding

Funding is a peer-to-peer transfer between longs and shorts, following a velocity model with an internal pool and per-user claimable balances. It carries no protocol cut. A position that owes funding pays it from collateral at settlement, while a position owed funding has the amount credited to its claimable balance, redeemed later through `claim_funding`. See [Funding Rate](./funding-rate.md).

## Execution Fee

Every order escrows the flat execution fee (`exec_fee`, a non-negative `Config` amount in the settlement token) at creation: an increase order escrows `collateral + exec_fee`, a decrease order escrows the `exec_fee` alone, and a vault order escrows `exec_fee` on top of its principal (assets for a deposit, shares for a redeem). The fee is copied onto the order row, so a later config change never touches a resting order. At fill it is paid to the keeper. Cancelling the order refunds it, and when a position fully closes, the escrows of its auto-cancelled resting decrease orders are folded into the trader's payout. Liquidation and ADL carry no order and pay no execution fee.

## The Fee Split

Settlement is gross-basis. From the four itemized costs:

- The **keeper** takes its `keeper_rate` cut of the trade fee (base plus impact), plus the order's escrowed `exec_fee` on order fills. Liquidation and ADL carry no order, so they pay the trade-fee cut only. This is the reward for the permissionless fill.
- The **treasury** takes its rate (read live from the treasury contract via `get_rate`) of the trade fee, the borrowing fee, and any forfeit.
- The **vault** banks all remainders, funds realized PnL through `strategy_withdraw`, and absorbs `bad_debt`.

Vault-order fills carry their own fee leg. A deposit fill charges the config's `deposit_fee` rate on the deposited assets, a redeem fill the `redeem_fee` rate on the redeemed proceeds (each capped at `MAX_FEE_RATE`, 1%), with floor rounding in the depositor's or redeemer's favor. From that vault fee the keeper receives `floor(fee * keeper_rate)` plus the order's escrowed `exec_fee`, the treasury takes `floor(fee * treasury_rate)`, and the remainder stays in the vault.

Collateral is escrowed into the trading contract when the order is created, and fees are deducted from it at fill. A fill whose fees erode the collateral below the margin floors rejects with `InsufficientMargin`. A failed direct payout to a trader falls back to a pull allowance (`pay_trader`), so a third-party keeper fill never stalls on the receiver.

## Realized-Profit Haircut

While a side's pending PnL exceeds `max_pnl_trader` of half the vault balance, a closing profit on that side is scaled by `allowance / side_PnL`, cutting every close during the overhang by the same live factor. The withheld share stays with the vault. A loss passes through unchanged.

Slicing a close across many fills partially escapes the haircut, because each fill re-reads a relieved ratio. The same overhang arms [auto-deleveraging](./auto-deleveraging.md), which bounds what slicing can extract.

## Liquidation Fee

Liquidation adds its own cost, the liquidation fee `ceil(liq_fee * notional)`, which decides the [two-tier liquidation](./liquidation.md) outcome. On the soft tier no liquidation fee is charged and the remaining equity is returned to the trader. On the hard tier the remaining equity no longer covers the fee, and all of it is forfeited to the vault. The treasury takes its rate of the forfeit.

## Treasury Rate Is Read Live

The treasury's rate is fetched from the treasury contract on every settlement via `get_rate`. The treasury contract bounds its own rate to at most 50% (`SCALAR_18 / 2`). This lets the protocol's fee share be retuned on the treasury contract without redeploying or reconfiguring the trading contract. See [Treasury](../treasury/overview).
