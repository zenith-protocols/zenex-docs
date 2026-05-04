---
sidebar_position: 3
title: Risks & Rewards
---

# Risks & Rewards

Vault depositors earn yield by acting as the counterparty to all trades on Zenex. This comes with both rewards and risks. Understanding both is essential before depositing.

### How the Vault Earns

The vault accrues value from three sources.

**Trading fees.** A [base fee and price impact fee](../trading/fees.md) are charged on every position open and close. The vault receives the portion of these fees not allocated to the treasury or keepers.

**Borrowing interest.** Traders holding leveraged positions pay continuous [borrowing interest](../trading/borrowing-interest.md) that scales with vault and market utilization. This compensates liquidity providers for the risk of their capital being used as leverage. Borrowing interest is the primary source of yield for the vault.

**Trader losses.** When traders close positions at a loss, their collateral is absorbed by the vault. In aggregate, if traders are net unprofitable, the vault grows.

### How the Vault Can Lose

- **Trader profitability**: When traders close positions at a profit, the vault pays out. If traders are net profitable over a period, the vault's total assets decrease and the share price drops.
- **Market volatility**: Sharp, directional price movements can cause large payouts to traders, especially when open interest is concentrated on one side of the market.

### Risk Mitigation

The vault's primary protection comes from balanced markets. When longs and shorts are roughly equal, trader profits on one side are offset by losses on the other, and the vault's net exposure is minimal. The protocol actively encourages this balance through several mechanisms.

**Funding rate.** The [funding rate](../trading/funding-rate.md) is a continuous payment from the dominant side to the minority side. This creates a direct financial incentive for traders to take the less crowded position, naturally pushing markets toward balance. When markets are balanced, the vault bears significantly less directional risk.

**Borrowing interest.** [Borrowing interest](../trading/borrowing-interest.md) rises exponentially with utilization. When open interest is high relative to the vault's capacity, the risk of large payouts during price swings increases. Borrowing interest compensates the vault for that elevated risk, and the steep curve ensures depositors are rewarded proportionally as the vault takes on more exposure.

**Price impact fees.** Larger positions incur proportionally higher [fees](../trading/fees.md), discouraging oversized trades that would create imbalance.

**Utilization limits.** The vault enforces caps on how much of its total assets can be committed, both globally and per market.

**Liquidations.** Positions that fall below their liquidation threshold are [liquidated](../trading/liquidation.md) before they can accumulate bad debt.

**Auto-deleveraging.** In extreme scenarios where net trader PnL approaches the vault balance, [auto-deleveraging](../trading/adl.md) proportionally reduces winning positions to protect the vault from insolvency.
