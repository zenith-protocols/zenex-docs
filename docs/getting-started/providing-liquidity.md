---
sidebar_position: 3
title: Providing Liquidity
---

# How to Use the Vault

### What Is The Vault?

The **vault** holds the collateral pool that traders borrow against when opening leveraged positions. By depositing the vault's collateral token, you earn yield from trading fees and borrowing interest paid by traders. For a deeper overview of how the vault works, see [Vault Overview](../vault/overview.md).

### Depositing

1. **Connect your wallet** by clicking **Connect** in the top-right corner on desktop (or at the top of the page on mobile) and selecting your sign-in method.
2. **Navigate to the Vault page** by selecting the **Vault** tab from the main navigation.
3. On the **Deposit** tab, **enter the amount** of the collateral token you want to deposit. The swap-arrow button inside the box toggles between two modes: **Deposit** (specify collateral in) and **Mint** (specify shares to receive).
4. **Confirm the transaction** by signing in your wallet. You will receive **vault shares** proportional to your deposit, representing your ownership stake in the pool.

### Withdrawing

1. **Navigate to the Vault page** by selecting the **Vault** tab from the main navigation.
2. Switch to the **Withdraw** tab. The swap-arrow button inside the box toggles between two modes: **Withdraw** (specify collateral to receive) and **Redeem** (specify shares to burn). The action button label flips between "Withdraw" and "Redeem" to match.
3. **Confirm the transaction** by signing in your wallet. Your shares are burned and the corresponding collateral is returned to your wallet.

### Important Notes

- **Lock period**: After depositing, a short lock period applies to your vault shares (currently 60 seconds on the live deployment; check the vault contract's `lock_time()` for the live value). During this period you cannot transfer or withdraw your shares. Once the lock expires, you can withdraw or transfer freely at any time.
- **Share value**: The value of your shares changes over time based on trading activity. When traders pay fees and interest, share value increases. When traders profit, share value may decrease. See [Risks & Rewards](../vault/risks-and-rewards.md) for a full breakdown.
