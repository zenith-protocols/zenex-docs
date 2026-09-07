---
sidebar_position: 3
title: Providing Liquidity
---

# How to Use the Vault

### What Is The Vault?

Each Zenex market pairs a market contract with its own **strategy vault**. The vault holds the liquidity that traders borrow against and stands as the counterparty to every position in that market. By depositing the market's settlement token, you earn yield from the trading fees and borrowing interest that traders pay. For a deeper overview of how the vault works, see [Vault Overview](../vault/overview.md).

### How Deposits and Redeems Work

Deposits and redeems on Zenex flow **through the market contract as vault orders**. When you deposit, your assets are held in escrow and a keeper fills the order shortly after, minting your **vault shares** net of the vault fee. When you redeem, your shares are escrowed and a keeper fills the redeem, burning them and paying out assets net of the vault fee. Alongside your deposit or redeem, a small flat execution fee in the settlement token is escrowed too. It pays the keeper that fills your order and is refunded in full if you cancel. This ordering exists so that share pricing always reflects the market's live PnL and cannot be sniped or drained by a well-timed deposit or withdrawal.

Two things follow from this. First, a deposit or redeem rests until a keeper fills it, and you can cancel it while it rests to get your escrowed assets or shares and the execution fee back in full, except while the market is under an emergency freeze. Second, redeems have a cooldown and fills are subject to safety gates, described below.

### Depositing

1. **Connect your wallet** by clicking **Connect** and selecting your sign-in method.
2. **Navigate to the Vault page** by selecting the **Vault** tab from the main navigation.
3. On the **Deposit** tab, **enter the amount** of the settlement token you want to deposit. Each market sets a minimum deposit amount, and a deposit below it is rejected when you submit. The shares shown are an estimate: the exact amount is determined at the price the keeper fills your order with.
4. **Confirm the transaction** by signing in your wallet. Your assets and the execution fee are escrowed and the deposit order is created. A keeper then fills it and you receive **vault shares** net of the vault fee, proportional to your deposit.

### Withdrawing

1. **Navigate to the Vault page** by selecting the **Vault** tab from the main navigation.
2. Switch to the **Withdraw** tab. You can specify either the amount of assets you want to receive or the number of shares you want to burn. There is no minimum redeem amount.
3. **Confirm the transaction** by signing in your wallet. Your shares and the execution fee are escrowed and a redeem order is created. A keeper fills it, burns your shares, and returns the corresponding assets net of the vault fee.

### Important Notes

- **Redeem cooldown**: a redeem has a cooldown that counts from the moment you create the order and must elapse before a keeper can fill it. The cooldown length is a per-market parameter (see [Parameter Changes](../governance/parameter-changes.md)), read when the order fills, so a parameter change can shorten or lengthen a resting redeem's wait. A deposit has no cooldown. It can fill as soon as a price newer than your order arrives, because shares are always priced against the market's pending PnL marked in existing depositors' favor, so there is nothing for a fast deposit to snipe.
- **Whole fills**: a deposit or redeem order fills in full. A keeper either fills your entire order or leaves it resting.
- **Safety gates**: to protect existing depositors, a redeem is blocked while pending trader profits would let it drain the pool, or while withdrawing would leave too little liquidity to back open positions. If a gate is active, your order simply rests until the condition clears.
- **Minimum received**: when you create a deposit or redeem you can set a minimum amount to receive (shares for a deposit, assets for a redeem, measured after the vault fee). If a fill would return less than that, the fill fails and your order keeps resting.
- **Balance cap**: each vault has a maximum total balance, a per-market parameter. A deposit that would push the vault above that cap will not fill until room opens up.
- **Share value**: the value of your shares changes over time based on trading activity. When traders pay fees and interest, or lose money, share value rises. When traders profit, share value can fall. See [Risks & Rewards](../vault/risks-and-rewards.md) for a full breakdown.
