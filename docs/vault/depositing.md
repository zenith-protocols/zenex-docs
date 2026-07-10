---
sidebar_position: 2
title: Depositing & Withdrawing
---

# Depositing & Withdrawing

Providing and withdrawing liquidity happens through **vault orders**. You create an order that escrows your assets or shares in the trading contract, and a permissionless [keeper](../keepers/overview.md) fills it later, in full, in a single transaction. The fill happens at the share value holding at the moment the keeper executes, and the keeper's verified oracle price feeds directly into that value: the vault prices shares against its assets adjusted for the pending profit and loss of open positions at that price, marked conservatively against you (see [Share Value](#share-value) below).

### Depositing

To provide liquidity you create a **deposit vault order** for an amount of the underlying token (e.g., USDC). At creation, that amount plus a small flat execution fee is escrowed inside the trading contract. The execution fee is a per-market parameter, paid in the settlement token: it goes to the keeper who fills the order and is refunded in full if you cancel. When a keeper fills the order, the vault mints **shares** to you: it takes the vault fill fee off the top, then converts what is left into shares at the fill-time share value, with the pending PnL of open positions marked against you.

For example, say you deposit 10,000 USDC and the vault fee on this fill is 0.1%. The fee comes to 10 USDC, leaving 9,990 USDC to convert. At a fill-time share value of 1.00 USDC per share, you receive 9,990 shares. If share value were instead 1.08 USDC per share, you would receive 9,990 / 1.08 = 9,250 shares.

A deposit must be at least the market's minimum size (`min_deposit`, a per-market parameter), checked when you create the order. Redeems have no minimum beyond a positive number of shares. The vault also enforces a maximum balance cap, so a fill that would push the vault above `max_vault_balance` is rejected until capacity frees up.

### Redeeming

To exit, you create a **redeem vault order** for a number of shares. Those shares are escrowed at creation, along with the same flat execution fee in the settlement token. When a keeper fills the order, the vault burns the shares and pays you the underlying assets net of the vault fill fee, valued at the fill-time share value with pending PnL marked against you.

You can cancel a resting vault order at any time before it fills, unless the market is frozen. While a market is frozen, vault-order cancels are halted along with fills, and the escrow stays in place until the freeze lifts. Cancelling refunds the escrowed assets (for a deposit) or shares (for a redeem) in full, along with the escrowed execution fee.

### Redeem Cooldown

Deposits have no cooldown. A deposit order becomes fillable as soon as a keeper holds a verified price published after the order was created.

A redeem order must wait out `redeem_lock` seconds before a keeper can fill it. The cooldown runs from the order's creation time, and the lock length is a per-market parameter read at fill time, so a [parameter change](../governance/parameter-changes.md) to `redeem_lock` also moves the deadline of orders already in the queue, in either direction. The lock applies to the order only: shares you still hold outside the order remain freely transferable.

### Per-Order Minimum Received

Every vault order carries an optional `min_out` bound that you set: the fewest shares you will accept for a deposit, or the fewest assets for a redeem, both measured net of the vault fill fee. A fill that would return less is rejected, so the order rests until the share value comes back within your tolerance or you cancel. Set it to zero to leave the order unbounded. This is your own slippage protection against the share value moving between submission and fill, distinct from the protocol's own gates described in [Risks & Rewards](./risks-and-rewards.md).

### Retired-Market Direct Redeem

Once a market reaches the **Retired** status (its final, defunct state after wind-down), a redeem pays out immediately at creation, with no keeper, no cooldown, and no execution fee. Deposits are rejected in a Retired market. This gives liquidity providers a direct exit once the market has been fully wound down. For the full status lifecycle, see the trading documentation.

### Share Value

Share value starts from the vault's total assets divided by the total supply of shares. It moves when value settles into or out of the vault: fees, interest, and realized trader PnL. Continuing the earlier example, a vault holding 1,040,000 USDC against 1,000,000 shares is worth 1.04 USDC per share, and a 40,000 USDC trader loss settling into the vault lifts it to 1.08 USDC per share.

When a vault order fills, the unrealized PnL of open positions is also marked into the price at that moment, using the keeper's verified price and always in the direction adverse to the order's owner. A deposit values the vault's pending exposure in the vault's favor, so you buy in at the highest defensible share value and cannot snipe pending trader losses by depositing just before they settle. A redeem counts pending trader profit up to the protocol's per-side payout cap, the amount the vault can actually be made to pay, so you exit at the lowest defensible share value and cannot dodge a pending payout by leaving just before it settles. The spread between the two marks accrues to shareholders who stay.

As the vault earns [fees](../trading/fees.md) and [borrowing interest](../trading/borrowing-interest.md), or absorbs trader losses, share value rises. When traders close in profit, the vault pays out and share value falls. For the protocol-level limits on pending trader PnL, see [Risks & Rewards](./risks-and-rewards.md).
