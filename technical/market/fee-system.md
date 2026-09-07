---
sidebar_position: 5
title: Fee System
---

# Fee System

Four itemized costs settle on every fill and close: the **base fee**, **impact**, **funding**, and **borrowing**. They are computed gross and deducted from the position's margin or the trader's proceeds. The base and impact fees together form the **trade fee**, which splits between the vault, the treasury, and the keeper. Borrowing splits between the vault and the treasury, and funding moves through the internal pool. On top of these, a flat **execution fee** escrowed with every order pays the keeper at fill, and a liquidation adds the **liquidation fee**, which splits like a trade fee. The proportional rates are `SCALAR_18` fractions. The per-market ones live in the market's config, and the treasury's share is stored on the treasury contract. The execution fee is a flat amount in the settlement token.

## Base Fee (Skew-Split)

The base fee is split by the fill's effect on market **skew**, the imbalance between long and short base tokens. The token-size change of the fill is decomposed into a worsening part (moving the book further from balance) and an improving part (moving it toward balance), then mapped pro-rata onto the fill's notional:

$$
\text{base} = \left\lceil \frac{\text{worsening} \times \text{fee\_dom}}{\text{SCALAR\_18}} \right\rceil + \left\lceil \frac{\text{improving} \times \text{fee\_non\_dom}}{\text{SCALAR\_18}} \right\rceil
$$

The worsening notional is `ceil(|notional| * worsening_tokens / |tokens|)` and the improving notional is the exact remainder, so the two legs sum to the fill. "Dominant" is decided by **token imbalance**, not notional, and a fill that crosses through balance splits at the crossing: the run to zero improves and the overshoot worsens. All rounding moves toward the higher fee. Config validation enforces `fee_dom >= fee_non_dom` and caps both at `MAX_FEE_RATE` (`SCALAR_18 / 100`, 1%).

## Impact Fee

$$
\text{impact} = \min\left(\left\lceil \frac{\text{notional}^2}{\text{impact\_scalar}} \right\rceil,\ \left\lceil \frac{\text{notional} \times \text{MAX\_IMPACT\_RATE}}{\text{SCALAR\_18}} \right\rceil\right)
$$

The impact fee is **size-quadratic on the fill's full notional**, charged on every fill regardless of skew direction. The effective fee rate is `notional / impact_scalar`, growing linearly with the fill size until it meets the `MAX_IMPACT_RATE` ceiling (`SCALAR_18 / 10`, 10%), which the quadratic term reaches at `notional = impact_scalar / 10`. `impact_scalar` is a token-dec config value validated strictly positive, and all rounding moves up, toward a higher fee.

The base fee and the impact fee together form the trade fee that the keeper and treasury cuts apply to.

## Borrowing Fee

The borrowing fee compensates the vault for the liquidity that open positions reserve. It follows a kink (piecewise-linear) utilization model and is charged **per second** via a cumulative index. The side holding the greater base-token exposure pays, at a kink rate computed from that side's own utilization against `max_util_open` of half the vault balance. The smaller side accrues nothing, and a token tie charges both sides, each at the rate from its own utilization. See [Borrowing Rate](./borrowing-rate.md). Borrowing revenue splits between the vault and the treasury.

## Funding

Funding is a peer-to-peer transfer between longs and shorts, following a velocity model with an internal pool and per-user claimable balances. It carries no protocol cut. A position that owes funding pays it from margin at settlement, while a position owed funding has the amount credited to its claimable balance, redeemed later through `claim_credit`. See [Funding Rate](./funding-rate.md).

## Execution Fee

Every order escrows the flat execution fee (`exec_fee`, a non-negative `Config` amount in the settlement token) at creation: an increase order escrows `margin + exec_fee`, a decrease order escrows the `exec_fee` alone, and a vault order escrows `exec_fee` on top of its principal (assets for a deposit, shares for a redeem). The fee is copied onto the order row, so a later config change never touches a resting order. At fill it is paid to the keeper. Cancelling the order refunds it, and when a position fully closes, the escrows of its auto-cancelled resting decrease orders are folded into the trader's payout. Liquidation and ADL carry no order and pay no execution fee.

## The Fee Split

Settlement is gross-basis. From the four itemized costs:

- The **keeper** takes its `keeper_rate` cut of the trade fee (base plus impact, plus the liquidation fee on a liquidation), plus the order's escrowed `exec_fee` on order fills. Liquidation and ADL carry no order, so they pay the trade-fee cut only. This is the reward for the permissionless fill.
- The **treasury** takes its rate (read live from the treasury contract via `get_rate`) of that same trade-fee total and, separately floored, of the borrowing fee.
- The **vault** banks all remainders, funds realized PnL through `strategy_withdraw`, and absorbs `bad_debt`.

Vault-order fills carry their own fee leg. A deposit fill charges the config's `deposit_fee` rate on the deposited assets, a redeem fill the `redeem_fee` rate on the redeemed proceeds (each capped at `MAX_FEE_RATE`, 1%), with floor rounding in the depositor's or redeemer's favor. From that vault fee the keeper receives `floor(fee * keeper_rate)` plus the order's escrowed `exec_fee`, the treasury takes `floor(fee * treasury_rate)`, and the remainder stays in the vault.

Margin is escrowed into the market contract when the order is created, and fees are deducted from it at fill. A fill whose fees erode the margin below the margin floors rejects with `InsufficientMargin`. A failed direct payout to a trader is parked as the trader's claimable credit, redeemable through `claim_credit`, so a third-party keeper fill never stalls on the receiver.

## Realized-Profit Haircut

While a side's pending PnL exceeds `max_pnl_trader` of half the vault balance, a closing profit on that side is scaled by `allowance / side_PnL`, cutting every close during the overhang by the same live factor. The withheld share stays with the vault. A loss passes through unchanged.

Slicing a close across many fills partially escapes the haircut, because each fill re-reads a relieved ratio. The same overhang arms [auto-deleveraging](./auto-deleveraging.md), which bounds what slicing can extract.

## Liquidation Fee

A [liquidation](./liquidation.md) charges one further cost on the whole force-closed notional:

$$
\text{fee} = \min\left(\text{equity},\ \left\lceil \frac{\text{liq\_fee} \times \text{notional}}{\text{SCALAR\_18}} \right\rceil\right)
$$

`equity` is the close's post-fee equity floored at zero. The fee is charged on every liquidation, and the trader is paid `equity - fee`. The cap keeps the fee from minting bad debt or making a self-liquidation profitable: once equity falls under the rated amount the fee takes the whole remainder and the payout saturates at zero. The fee joins base and impact in the split total, so it lands the same way, `keeper_rate` to the keeper, the treasury's live rate to the treasury, and the remainder to the vault. `liq_fee` is a `SCALAR_18` config rate capped at `MAX_LIQ_FEE` (`SCALAR_18 / 4`, 25%) and validated strictly below `maintenance_margin`.

## Treasury Rate Is Read Live

The treasury's rate is fetched from the treasury contract on every settlement via `get_rate`. The treasury contract bounds its own rate to at most 50% (`SCALAR_18 / 2`). This lets the protocol's fee share be retuned on the treasury contract without redeploying or reconfiguring the market contract. See [Treasury](../treasury/overview).
