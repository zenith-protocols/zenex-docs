---
sidebar_position: 4
title: Glossary
---

# Glossary

A reference of key terms used throughout the Zenex documentation.

| Term | Definition |
|------|-----------|
| **Perpetual futures (perps)** | Derivative contracts that let you speculate on an asset's price without expiry |
| **Oracle** | Off-chain price feed (Pyth Lazer) that provides real-time asset prices to the protocol |
| **Collateral** | Funds deposited to back a position and absorb losses |
| **Leverage** | Multiplier that amplifies exposure beyond deposited collateral |
| **Notional size** | The total value of a single position (collateral x leverage) |
| **Open interest (OI)** | The sum of all notional sizes on one side of a market. Long OI and short OI are tracked separately |
| **Margin** | The initial margin requirement that determines maximum leverage per market |
| **PnL** | Profit and Loss, the unrealized gain or loss on an open position |
| **Equity** | Collateral + PnL - Fees, determines position health |
| **Liquidation threshold (liq_fee)** | The equity level below which a position can be liquidated, configurable per market |
| **Liquidation** | Forced closure of a position when equity falls below the liquidation threshold |
| **Vault** | Liquidity pool that provides the funds for leveraged trading |
| **Vault shares** | Token representing proportional ownership of the vault's total assets |
| **Utilization** | Ratio of open interest to available vault capacity |
| **Funding rate** | Continuously accruing cost/credit between longs and shorts, recalculated hourly based on open interest imbalance, settled on position close |
| **Borrowing interest** | Time-based interest paid by positions, scales with vault and market utilization |
| **Keeper** | Permissionless actor that executes limit fills, liquidations, and trigger orders |
| **ADL (Auto-deleveraging)** | Safety mechanism that reduces winning positions when the vault nears insolvency |