---
sidebar_position: 8
title: Auto-Deleveraging (ADL)
---

# Auto-Deleveraging (ADL)

Auto-Deleveraging is a safety mechanism that protects the vault when winning positions threaten to exceed the vault's ability to pay. Rather than allowing the protocol to become insolvent, ADL proportionally reduces the notional size of profitable positions across the affected side of the market.

### When does ADL trigger?

ADL activates when the net unrealized PnL of all winning positions exceeds the vault's balance. Specifically:

1. **Circuit breaker (OnIce)**: When net PnL reaches 95% of the vault balance, the contract enters `OnIce` status. No new positions can be opened, but existing positions can still be managed and closed.
2. **ADL execution**: When net PnL exceeds 100% of the vault balance, ADL is triggered via the permissionless `update_status` function.
3. **Recovery**: When net PnL drops below 90% of the vault balance, the contract returns to `Active` status.

The 5% gap between the freeze threshold (95%) and the unfreeze threshold (90%) prevents rapid oscillation between states.

### How does ADL affect your position?

When ADL occurs, all positions on the winning side of the market have their effective notional size reduced proportionally. This means:

- Your position's profit potential is reduced
- Your risk exposure is also reduced
- Your collateral remains unchanged
- The reduction applies equally to all positions on the affected side

The reduction is tracked through an ADL index. Your position's effective notional is computed as:

$$
effectiveNotional = notional \times \frac{currentADLIndex}{entryADLIndex}
$$

For example, if the ADL index drops from 1.0 to 0.8, all affected positions have their effective notional reduced by 20%.

### What should you know?

- **ADL is rare**: It only triggers when the vault is near insolvency. Under normal market conditions, liquidations handle risk management.
- **No action required**: ADL is applied automatically. You do not need to do anything when it occurs.
- **Proportional and fair**: All positions on the winning side are reduced equally, based on their notional size.
- **Multiple events compound**: If ADL occurs more than once, the reductions multiply. An 80% index followed by another 80% results in a 64% effective notional.
- **Funding residual**: After ADL, there may be a small discrepancy in funding accrual. This is by design and the vault absorbs the residual as counterparty.
