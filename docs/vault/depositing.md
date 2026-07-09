---
sidebar_position: 2
title: Depositing & Withdrawing
---

# Depositing & Withdrawing

Providing and withdrawing liquidity happens through **vault orders**. You create an order that escrows your assets or shares in the trading contract, and a permissionless [keeper](../keepers/overview.md) fills it later. The fill happens at whatever share value holds at the moment the keeper executes, rather than when you submit the order, and the keeper's verified oracle price is used to check the protective gates at that moment, not to price the conversion.

### Depositing

To provide liquidity you create a **deposit vault order** for an amount of the underlying token (e.g., USDC). At creation, that amount is escrowed inside the trading contract. When a keeper fills the order, the vault mints **shares** to you: it takes the vault fill fee off the top, then converts what is left into shares at the vault's share value at the moment of the fill (its total assets divided by its total shares).

For example, say you deposit 10,000 USDC and the vault fee on this fill is 0.1%. The fee comes to 10 USDC, leaving 9,990 USDC to convert. At a share value of 1.00 USDC per share, you receive 9,990 shares. If share value were instead 1.08 USDC per share, you would receive 9,990 / 1.08 = 9,250 shares.

Both deposits and redeems must clear a minimum size (`min_deposit`, set per market by governance): a deposit's assets and the asset value of a redeem each have to be at least the minimum, at creation and on every fill. The vault also enforces a maximum balance cap, so a fill that would push the vault above `max_vault_balance` is rejected until capacity frees up.

### Redeeming

To exit, you create a **redeem vault order** for a number of shares. Those shares are escrowed at creation. When a keeper fills the order, the vault burns the shares and pays you the underlying assets net of the vault fill fee, valued at the share value at the moment of the fill.

You can cancel a resting vault order at any time before it fills, unless the market is frozen. While a market is frozen, cancels are halted along with fills, and the escrow stays in place until the freeze lifts. Cancelling refunds the escrowed assets (for a deposit) or shares (for a redeem) in full.

### Cooldowns

Vault orders carry a cooldown deadline stamped at creation. The order becomes fillable only once the cooldown elapses. Two locks apply, both set per market by governance:

- **`redeem_lock`**: the cooldown a redeem order must wait before a keeper can fill it. It runs from the order's creation time and cannot be extended once stamped. A later governance change to the lock can only pull a queued order's deadline earlier, never later.
- **`deposit_lock`**: the cooldown a deposit order must wait. This lock is conditionally waived. When the pending trader losses that would make shares a bargain are within the `instant_deposit_pnl` tolerance of the vault balance, there is nothing for a depositor to snipe, so the deposit can fill immediately (the instant-deposit waiver). Otherwise the deposit must wait out `deposit_lock` before it becomes fillable.

### Per-Order Adverse-PnL Bound

Every vault order carries an optional `max_adverse_pnl` bound that you set. It is your own opt-in protection against filling at a mispriced share value: as a depositor it declines to overpay while shares are overpriced beyond your tolerance, and as a redeemer it declines to exit below fair value beyond your tolerance. Set it to zero to leave the order unbounded. This is distinct from the protocol's own gates described in [Risks & Rewards](./risks-and-rewards.md).

### Partial Fills

A keeper can fill a vault order partially. When that happens, the remainder stays pending under the **same order** with its original creation time intact, so a redeem's cooldown does not restart and the rest can be filled by a later keeper transaction. Any remainder must itself stay large enough to be fillable (at least `min_deposit`).

### Retired-Market Direct Redeem

Once a market reaches the **Retired** status (its final, defunct state after wind-down), the keeper flow no longer applies to redeems. Creating a redeem order forwards straight to the vault and pays out immediately, with no keeper and no cooldown. Deposits are rejected in a Retired market. This gives liquidity providers a direct exit once the market has been fully wound down. For the full status lifecycle, see the trading documentation.

### Share Value

Share value is the vault's total assets divided by the total supply of shares. It moves when value settles into or out of the vault: fees, interest, and realized trader PnL. Continuing the earlier example, a vault holding 1,040,000 USDC against 1,000,000 shares is worth 1.04 USDC per share, and a 40,000 USDC trader loss settling into the vault lifts it to 1.08 USDC per share. The unrealized PnL of open positions is not yet in the share price.

As the vault earns [fees](../trading/fees.md) and [borrowing interest](../trading/borrowing-interest.md), or absorbs trader losses, share value rises. When traders close in profit, the vault pays out and share value falls. For how the protocol handles the gap between share value and fair value while trader PnL is pending, see [Risks & Rewards](./risks-and-rewards.md).
