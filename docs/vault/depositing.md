---
sidebar_position: 2
title: Depositing & Withdrawing
---

# Depositing & Withdrawing

In v2, providing and withdrawing liquidity happens through **vault orders**. You create an order that escrows your assets or shares in the trading contract, and a permissionless [keeper](../keepers/overview.md) fills it at a verified oracle price. The value you deposit or redeem is priced against the market's live price at the moment the keeper executes, rather than when you submit the order.

### Depositing

To provide liquidity you create a **deposit vault order** for an amount of the underlying token (e.g., USDC). At creation, that amount is escrowed inside the trading contract. When a keeper fills the order, the vault mints **shares** to you net of the vault fill fee, based on the share value at the fill price:

$$
sharesReceived = \frac{depositAmount - vaultFee}{sharePrice}
$$

A deposit fill must clear a minimum size (`min_deposit`, set per market by governance). The vault also enforces a maximum balance cap, so a fill that would push the vault above `max_vault_balance` is rejected until capacity frees up.

### Redeeming

To exit, you create a **redeem vault order** for a number of shares. Those shares are escrowed at creation. When a keeper fills the order, the vault burns the shares and pays you the underlying assets net of the vault fill fee, valued at the fill price.

You can cancel a resting vault order at any time before it fills. Cancelling refunds the escrowed assets (for a deposit) or shares (for a redeem) in full.

### Cooldowns

Vault orders carry a cooldown deadline stamped at creation. The order becomes fillable only once the cooldown elapses. Two locks apply, both set per market by governance:

- **`redeem_lock`**: the cooldown a redeem order must wait before a keeper can fill it. It runs from the order's creation time and cannot be extended once stamped. A later governance change to the lock can only pull a queued order's deadline earlier, never later.
- **`deposit_lock`**: the cooldown a deposit order must wait. This lock is conditionally waived. When the shares sit within `instant_deposit_pnl` of fair value there is nothing to snipe, so the deposit can fill immediately (the instant-deposit waiver). Otherwise the deposit must wait out `deposit_lock` before it becomes fillable.

### Per-Order Adverse-PnL Bound

Every vault order carries an optional `max_adverse_pnl` bound that you set. It is your own opt-in protection against filling at a mispriced share value: as a depositor it declines to overpay while shares are overpriced beyond your tolerance, and as a redeemer it declines to exit below fair value beyond your tolerance. Set it to zero to leave the order unbounded. This is distinct from the protocol's own gates described in [Risks & Rewards](./risks-and-rewards.md).

### Partial Fills

A keeper can fill a vault order partially. When that happens, the remainder stays pending under the **same order** with its original creation time intact, so a redeem's cooldown does not restart and the rest can be filled by a later keeper transaction. Any remainder must itself stay large enough to be fillable (at least `min_deposit`).

### Retired-Market Direct Redeem

Once a market reaches the **Retired** status (its final, defunct state after wind-down), the keeper flow no longer applies to redeems. Creating a redeem order forwards straight to the vault and pays out immediately, with no keeper and no cooldown. Deposits are rejected in a Retired market. This gives liquidity providers a direct exit once the market has been fully wound down. For the full status lifecycle, see the trading documentation.

### Share Value

Share value reflects the vault's total assets net of pending trader PnL, divided by the total supply of shares:

$$
sharePrice = \frac{totalAssets - pendingTraderPnl}{totalShares}
$$

As the vault earns [fees](../trading/fees.md) and [borrowing interest](../trading/borrowing-interest.md), or absorbs trader losses, share value rises. When traders are in profit, the vault owes payouts and share value falls. For what drives these movements and how the protocol protects depositors, see [Risks & Rewards](./risks-and-rewards.md).
