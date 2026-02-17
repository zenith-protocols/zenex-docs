---
sidebar_position: 3
title: Risks & Rewards
---

# Risks & Rewards

Vault depositors earn yield by acting as the counterparty to all trades on Zenex. This comes with both rewards and risks. Understanding both is essential before depositing.

### How the Vault Earns

The vault accrues value from three sources:

- **Trading fees**: A [base fee and price impact fee](../trading/fees.md) are charged on every trade open and close. These fees flow directly to the vault.
- **Interest spread**: The dominant side of the market (longs or shorts) pays an [hourly interest rate](../trading/interest.md). 80% of this interest is rebated to the minority side, while the remaining **20% accrues to the vault** as yield.
- **Trader losses**: When traders close positions at a loss, their collateral is absorbed by the vault. In aggregate, if traders are net unprofitable, the vault grows.

### How the Vault Can Lose

- **Trader profitability**: When traders close positions at a profit, the vault pays out. If traders are net profitable over a period, the vault's total assets decrease and the share price drops.
- **Market volatility**: Sharp, directional price movements can cause large payouts to traders, especially when open interest is concentrated on one side of the market.

### Risk Mitigation

The protocol includes several mechanisms designed to protect vault depositors:

- **Dynamic interest rates**: When long or short positions become heavily imbalanced, interest rates adjust to incentivize the minority side, naturally rebalancing the market. See [Interest](../trading/interest.md).
- **Price impact fees**: Larger positions incur higher fees, discouraging oversized trades that would concentrate risk. See [Fees](../trading/fees.md).
- **Max utilization limits**: The vault enforces limits on how much of its total assets can be borrowed, preventing over-leveraging.
- **Maintenance margins and liquidations**: Positions that fall below the maintenance margin are [liquidated](../trading/liquidation.md) before they can accumulate bad debt.
- **Max payout cap**: Individual position payouts are capped to protect the vault against extreme scenarios.

### Summary

Vault depositors earn yield in exchange for taking on counterparty risk. Historically, across similar perpetual DEX designs, traders tend to be net unprofitable in aggregate, meaning the vault generally accrues value over time. However, past performance is not indicative of future results, and depositors should understand that short-term losses are possible during periods of strong directional trading.
