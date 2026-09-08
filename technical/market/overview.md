---
sidebar_position: 1
title: Market contract
---

# Market contract

One market contract is one market. It is anchored to an immutable `feed_id`, and it is wired at deployment to one token, one vault, one oracle, and one treasury. A trader enters through price-free calls that the trader's own account signs. A keeper enters through permissionless calls that carry a signed price report. The oracle checks each report against the market's `feed_id`. Under a stored terminal price the market prices flat at that price, and the submitted bytes are never verified. On the keeper calls that pay a reward, the `keeper` argument names the recipient and never an authorizer. The owner sets the config, the status, and the terminal price. The market, oracle, factory, treasury, and governance contracts share one ownership surface. The [ownership and upgrade page](../ownership.md) covers the owner check, the two-step transfer, and `upgrade`. The pages below hold the contract surface.

| Page | What it holds |
| --- | --- |
| [Constructor and dependencies](./dependencies.md) | `__constructor`, the dependency views, the oracle, treasury, and vault interfaces the market calls, and the types the contract exports. |
| [Config](./config.md) | The `Config` struct, its validation rules in order, `set_config`, and the protocol constants. |
| [Market status](./status.md) | The `Status` values, the transition matrix, `set_status`, `set_terminal_price`, and the status gate on each entry. |
| [Pricing](./pricing.md) | How a signed report becomes the price a call executes at, the price cache, the accrual clock, and `accrue`. |
| [Orders](./orders.md) | `OrderKind`, the `Order` row, `create_order`, `cancel_order`, `execute_order`, and the trigger and bound rules. |
| [Position lifecycle](./position-lifecycle.md) | The `Position` row, the increase and decrease paths, the decrease lock, and the closure sweep. |
| [Margin and leverage](./margin-and-leverage.md) | The two margin lines, settled equity, post-action validity, the leverage ceiling, the open interest cap, and the cap on each side's reserve against the vault. |
| [PnL and the profit cap](./pnl-calculation.md) | The math helpers, the PnL marks, the per-side haircut, and the net PnL mark that the vault uses to price shares. |
| [Fees and settlement](./fee-system.md) | Base and impact fees, the execution fee, the settlement legs, keeper payouts, and how a failed payout parks into the credit balance. |
| [Funding rate](./funding-rate.md) | The velocity model, the funding indices, the credit pool, and `claim_credit`, which pays that balance out. |
| [Borrowing rate](./borrowing-rate.md) | Reserved liquidity, the kink curve over a side's own reserve utilization, and which side accrues. |
| [Liquidation](./liquidation.md) | `execute_liquidation`, the eligibility waiver past the delist deadline, and the liquidation fee. |
| [Auto-deleveraging](./auto-deleveraging.md) | `AdlState`, the flag update, and the forced close of a winner on a flagged side. |
| [Vault orders](./vault-orders.md) | The `VaultOrder` row, the deposit and redeem paths, the fill gates, and the instant redeem on a retired market. |
| [Storage](./storage.md) | The `DataKey` table, the time-to-live tiers, and the `MarketData` singleton. |
| [Events](./events.md) | Each market event with its topics and its data layout, the reserved ids, and the order of emission. |
| [Errors](./errors.md) | The `MarketError` catalog and the other failures reachable through the contract. |
