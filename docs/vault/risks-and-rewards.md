---
sidebar_position: 3
title: Risks & Rewards
---

# Risks & Rewards

Vault depositors earn yield by acting as the counterparty to every trade in the market. This comes with both rewards and risks. Understanding both is essential before depositing.

### How the Vault Earns

The vault accrues value from several sources.

**Trading fees.** A skew-split [base fee and price impact fee](../trading/fees.md) are charged on every fill and close. The vault banks the portion of these fees not taken by the treasury or the keeper.

**Vault fill fees.** Each deposit and redeem pays a vault fee on the moved assets. That fee is split between the keeper, the treasury, and the vault, so existing depositors earn a cut of the flow in and out of the pool.

**Borrowing interest.** Traders holding leveraged positions pay continuous [borrowing interest](../trading/borrowing-interest.md) that scales with utilization. This compensates liquidity providers for their capital backing leverage, and it is a primary source of yield.

**Net trader losses.** When traders close at a loss, their collateral is absorbed by the vault. In aggregate, if traders are net unprofitable, the vault grows.

### How the Vault Can Lose

- **Trader profitability**: when traders close at a profit, the vault pays out. If traders are net profitable over a period, the vault's total assets fall and share value drops.
- **Market volatility**: sharp, directional moves can cause large payouts to traders, especially when open interest is concentrated on one side.
- **Bad debt**: if a position moves against a trader faster than it can be closed, any shortfall beyond the freed margin becomes bad debt that the vault absorbs.

### Risk Mitigation

The vault's strongest protection is a balanced book. When longs and shorts are roughly equal, profits on one side are offset by losses on the other and the vault's net exposure is small. The protocol pushes toward balance and, on top of that, applies gates that directly protect share value and vault solvency.

**Funding rate.** The [funding rate](../trading/funding-rate.md) is a continuous payment from the dominant side to the minority side, creating a financial incentive to take the less crowded position and pushing the book toward balance.

**Skew-split and impact fees.** The [trade fee](../trading/fees.md) charges the book-worsening leg more than the balancing leg, and a price impact fee falls on trades that push the book further out of balance. Both discourage the imbalance that exposes the vault.

**Borrowing interest.** [Borrowing interest](../trading/borrowing-interest.md) rises with utilization through a kink model, steepening past a target so depositors are rewarded proportionally as the vault takes on more exposure.

**Deposit snipe gate.** A deposit is blocked while the vault's share value is depressed by net pending trader losses beyond `max_pnl_deposit` (set per market by governance). This stops a new depositor from minting shares cheaply at a moment the pending PnL is about to swing back, diluting existing LPs.

**Withdraw gate.** A redeem is blocked while share value is inflated by net pending trader profit beyond `max_pnl_withdraw` (set per market by governance). This stops a redeemer from cashing out an unrealized spike at the expense of the LPs who remain.

**Utilization cap.** Withdrawals must leave the vault with enough liquidity to keep backing the reserved capacity, bounded by `max_util_withdraw` (which is at least the open-side cap `max_util_open`). This retains a minimum level of liquidity so the vault can always cover its open positions.

**Realized-profit haircut.** While a winning side's pending profit overhangs the vault (beyond `max_pnl_trader` of half the vault balance), each closing profit is scaled down by a live factor and the withheld share stays with the vault. This bounds how fast winners can extract value.

**Auto-deleveraging.** When a side's pending profit grows large relative to the vault, [auto-deleveraging](../trading/adl.md) lets keepers proportionally reduce winning positions on that side, bounding what winners can extract and protecting the vault from insolvency.

**Liquidations.** Positions whose equity falls below the maintenance floor are [liquidated](../trading/liquidation.md) before they accumulate bad debt.

Any bad debt that still occurs is absorbed by the vault, which is the residual risk depositors take on in exchange for the fees, interest, and net trader losses they earn.
