---
sidebar_position: 3
title: Risks & Rewards
---

# Risks & Rewards

Vault depositors earn yield by acting as the counterparty to all trades on Zenex. This comes with both rewards and risks. Understanding both is essential before depositing.

### How the Vault Earns

The vault accrues value from three sources.

**Trading fees.** A [base fee and price impact fee](../trading/fees.md) are charged on every position open and close. The vault receives the portion of these fees not allocated to the treasury or keepers.

**Borrowing interest.** Traders holding leveraged positions pay continuous [borrowing interest](../trading/fees.md) that scales with vault and market utilization. This compensates liquidity providers for the risk of their capital being used as leverage. Borrowing interest is the primary source of yield for the vault.

**Trader losses.** When traders close positions at a loss, their collateral is absorbed by the vault. In aggregate, if traders are net unprofitable, the vault grows.

### How the Vault Can Lose

- **Trader profitability**: When traders close positions at a profit, the vault pays out. If traders are net profitable over a period, the vault's total assets decrease and the share price drops.
- **Market volatility**: Sharp, directional price movements can cause large payouts to traders, especially when open interest is concentrated on one side of the market.

### Risk Mitigation

The protocol includes several mechanisms designed to protect vault depositors:

**Dynamic funding rates.** When long or short positions become heavily imbalanced, funding rates adjust to incentivize the minority side, naturally rebalancing the market. See [Funding Rate](../trading/funding-rate.md).

**Borrowing interest.** As utilization increases, borrowing costs rise exponentially, discouraging excessive leverage and compensating the vault for higher risk. See [Fees](../trading/fees.md).

**Price impact fees.** Larger positions incur higher fees, discouraging oversized trades that would concentrate risk.

**Utilization limits.** The vault enforces caps on how much of its total assets can be committed, both globally and per market.

**Liquidations.** Positions that fall below their liquidation threshold are [liquidated](../trading/liquidation.md) before they can accumulate bad debt.

**Auto-deleveraging.** In extreme scenarios where net trader PnL approaches the vault balance, [auto-deleveraging](../trading/adl.md) proportionally reduces winning positions to protect the vault from insolvency.

### Summary

Vault depositors earn yield in exchange for taking on counterparty risk. Historically, across similar perpetual DEX designs, traders tend to be net unprofitable in aggregate, meaning the vault generally accrues value over time. However, past performance is not indicative of future results, and depositors should understand that short-term losses are possible during periods of strong directional trading.
