---
sidebar_position: 1
title: Market contract
description: Find each market interface and its reference for orders, positions, settlement, storage, and risk.
---

# Market contract

`MarketContract` holds one netted position per account and side. It owns margin, order escrow, credit, and the market's risk configuration.

The paired strategy vault holds liquidity. Each market has one immutable `feed_id`. Its constructor binds the vault, settlement token, oracle, treasury, and owner.

The owner can [upgrade market code](./dependencies.md#ownership-and-upgrade) while retaining the market address and its authority over the paired vault. The vault has no upgrade entry, so its fixed code still trusts the registered market's current behavior.

## Orders and positions

| Reference | What it defines |
| --- | --- |
| [Orders](./orders.md) | `create_order`, `cancel_order`, `execute_order`, `get_order`, `get_order_counter`, and all six order kinds. |
| [Position lifecycle](./position-lifecycle.md) | `get_position`, position fields, increases, decreases, size locks, and full-close sweeps. |
| [Margin and leverage](./margin-and-leverage.md) | Margin requirements, maintenance equity, and position validation. |
| [Profit and loss](./pnl-calculation.md) | Price marks, rounding, profit caps, and aggregate vault marks. |
| [Pricing](./pricing.md) | `accrue`, price selection, cache behavior, and the position price floor. |
| [Fees and settlement](./fee-system.md) | Trade and impact fees, escrowed execution fees, settlement legs, and payout fallback. |
| [Funding rate](./funding-rate.md) | Funding accrual, `claim_credit`, `get_claimable_credit`, and the credit pool. |
| [Borrowing rate](./borrowing-rate.md) | Utilization, the borrowing curve, and side reserves. |

## Forced closes and liquidity

| Reference | What it defines |
| --- | --- |
| [Liquidation](./liquidation.md) | `execute_liquidation`, eligibility, fees, bad debt, and delist deadlines. |
| [Auto-deleveraging](./auto-deleveraging.md) | `get_adl`, `update_adl_state`, `execute_adl`, side flags, and forced profit realization. |
| [Vault orders](./vault-orders.md) | `create_vault_order`, `cancel_vault_order`, `execute_vault_order`, `get_vault_order`, minimum output, and redeem locks. |

## Administration and shared references

| Reference | What it defines |
| --- | --- |
| [Constructor and dependencies](./dependencies.md) | `__constructor`, dependency views, ownership, and `upgrade`. |
| [Configuration](./config.md) | `set_config`, `get_config`, field units, validation bounds, and constants. |
| [Market status](./status.md) | `set_status`, `get_status`, `set_terminal_price`, `get_retirement`, transitions, and entry gates. |
| [Storage](./storage.md) | Every key, record, and storage time-to-live rule. |
| [Events](./events.md) | Topics, data fields, and receipt ordering. |
| [Errors](./errors.md) | Market and ownership error codes. |
| [Units and scales](../units.md) | Integer precision and rounding conventions. |

User actions authorize creation, cancellation, and credit claims. Price-bearing keeper entries are permissionless. A `keeper` argument names the reward recipient.

The [transaction reference](../router/overview.md) covers batch composition, fee forwarding, and session authorization. Live addresses and parameters appear in [Deployments](/deployments).
