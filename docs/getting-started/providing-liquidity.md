---
sidebar_position: 3
title: Providing Liquidity
---

# How to Use the Vault

### What Is The Vault?

Each Zenex market pairs a trading contract with its own **strategy vault**. The vault holds the liquidity that traders borrow against and stands as the counterparty to every position in that market. By depositing the market's settlement token, you earn yield from the trading fees and borrowing interest that traders pay. For a deeper overview of how the vault works, see [Vault Overview](../vault/overview.md).

### How Deposits and Redeems Work

Deposits and redeems on Zenex flow **through the trading contract as vault orders**. When you deposit, your assets are held in escrow and a keeper fills the order shortly after, minting your **vault shares** net of the vault fee. When you redeem, your shares are escrowed and a keeper fills the redeem, burning them and paying out assets net of the vault fee. This ordering exists so that share pricing always reflects the market's live PnL and cannot be sniped or drained by a well-timed deposit or withdrawal.

Two things follow from this. First, a deposit or redeem rests until a keeper fills it, and you can cancel it while it rests to get your escrowed assets or shares back in full. Second, fills are subject to cooldowns and safety gates, described below.

### Depositing

1. **Connect your wallet** by clicking **Connect** in the top-right corner on desktop (or at the top of the page on mobile) and selecting your sign-in method.
2. **Navigate to the Vault page** by selecting the **Vault** tab from the main navigation.
3. On the **Deposit** tab, **enter the amount** of the settlement token you want to deposit. The swap-arrow button inside the box toggles between two modes: **Deposit** (specify assets in) and **Mint** (specify shares to receive).
4. **Confirm the transaction** by signing in your wallet. Your assets are escrowed and the deposit order is created. A keeper then fills it and you receive **vault shares** net of the vault fee, proportional to your deposit.

### Withdrawing

1. **Navigate to the Vault page** by selecting the **Vault** tab from the main navigation.
2. Switch to the **Withdraw** tab. The swap-arrow button inside the box toggles between two modes: **Withdraw** (specify assets to receive) and **Redeem** (specify shares to burn). The action button label flips to match.
3. **Confirm the transaction** by signing in your wallet. Your shares are escrowed and a redeem order is created. A keeper fills it, burns your shares, and returns the corresponding assets net of the vault fee.

### Important Notes

- **Cooldowns**: a deposit and a redeem each have a cooldown that must elapse before a keeper can fill the order. The cooldown lengths are set per market by governance. A deposit can skip its cooldown when the shares price close enough to fair value that there is nothing to snipe. A redeem cooldown is stamped when you create the order and never restarts, even if the order fills in parts.
- **Safety gates**: to protect existing depositors, a deposit is blocked while pending trader losses would let it snipe the pool at a discount, and a redeem is blocked while pending trader profits would let it drain the pool, or while withdrawing would leave too little liquidity to back open positions. If a gate is active, your order simply rests until the condition clears. You can also set your own adverse-price tolerance so a fill is skipped if the share price has moved against you beyond what you will accept.
- **Balance cap**: each vault has a maximum total balance set per market by governance. A deposit that would push the vault above that cap will not fill until room opens up.
- **Share value**: the value of your shares changes over time based on trading activity. When traders pay fees and interest, or lose money, share value rises. When traders profit, share value can fall. See [Risks & Rewards](../vault/risks-and-rewards.md) for a full breakdown.
