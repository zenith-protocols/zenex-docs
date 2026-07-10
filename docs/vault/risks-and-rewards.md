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

**Deposit and redeem pricing.** Every deposit and redeem is priced against the vault's assets adjusted for the pending profit and loss of open positions, always at the valuation least favorable to the depositor or redeemer. The small spread between the two marks stays in the pool and accrues to existing depositors.

**Borrowing interest.** Positions on the larger side of the book pay continuous [borrowing interest](../trading/borrowing-interest.md) that scales with how much of the vault's capacity that side reserves. This compensates liquidity providers for their capital backing leverage, and it is a primary source of yield.

**Net trader losses.** When traders close at a loss, their collateral is absorbed by the vault. In aggregate, if traders are net unprofitable, the vault grows.

### How the Vault Can Lose

- **Trader profitability**: when traders close at a profit, the vault pays out. If traders are net profitable over a period, the vault's total assets fall and share value drops.
- **Market volatility**: sharp, directional moves can cause large payouts to traders, especially when open interest is concentrated on one side.
- **Bad debt**: if a position moves against a trader faster than it can be closed, any shortfall beyond the freed margin becomes bad debt that the vault absorbs.

### Risk Mitigation

The vault's strongest protection is a balanced book. When longs and shorts are roughly equal, profits on one side are offset by losses on the other and the vault's net exposure is small. The protocol pushes toward balance and, on top of that, applies pricing rules and gates that directly protect share value and vault solvency.

**Funding rate.** The [funding rate](../trading/funding-rate.md) is a continuous payment from the dominant side to the minority side, creating a financial incentive to take the less crowded position and pushing the book toward balance.

**Skew-split and impact fees.** The [trade fee](../trading/fees.md) charges the book-worsening leg more than the balancing leg, and a price impact fee falls on trades that push the book further out of balance. Both discourage the imbalance that exposes the vault.

**Borrowing interest.** [Borrowing interest](../trading/borrowing-interest.md) rises with the paying side's own utilization through a kink model, steepening past a target so depositors are rewarded proportionally as more of the vault's capacity is reserved.

**Deposit pricing.** A deposit mints shares against the vault's backing marked with pending trader PnL at the valuation least favorable to the depositor. A depositor cannot mint cheap shares while pending trader losses temporarily depress the pool, so existing depositors are never diluted by deposit timing.

**Redeem pricing and gate.** A redeem pays out against the vault's backing marked with pending trader PnL at the valuation least favorable to the redeemer, so a leaving depositor cannot cash out an unrealized spike at the expense of those who remain. A redeem is also blocked while either side's pending trader profit is too large relative to the vault that would remain after it, keeping enough backing in the pool to pay winners.

**Utilization cap.** A redeem will not fill if it would leave either side's reserved capacity above a per-market withdrawal cap. This retains a minimum level of liquidity so the vault can always cover its open positions.

**Realized-profit haircut.** While a winning side's pending profit exceeds a per-market cap on what the vault recognizes, each closing profit is scaled down by a live factor and the withheld share stays with the vault. This bounds how fast winners can extract value.

**Auto-deleveraging.** When a side's pending profit grows large relative to the vault, [auto-deleveraging](../trading/adl.md) lets keepers reduce winning positions on that side until the side's pending profit falls back to a safe level, bounding what winners can extract and protecting the vault from insolvency.

**Liquidations.** Positions whose equity falls below the maintenance floor are [liquidated](../trading/liquidation.md) before they accumulate bad debt.

Any bad debt that still occurs is absorbed by the vault, which is the residual risk depositors take on in exchange for the fees, interest, and net trader losses they earn.

### Emergency Freeze

Governance can freeze a market instantly in an emergency. A freeze is a full stop: order fills, new orders, liquidations, funding claims, and vault-order cancels all halt, for traders and depositors alike. Escrowed assets and shares stay exactly where they are, no balance is touched, and everything resumes once the freeze is lifted. For depositors this means a resting deposit or redeem can neither fill nor be cancelled while a freeze lasts. The freeze is part of the market lifecycle described in the [markets documentation](../markets/overview.md).
