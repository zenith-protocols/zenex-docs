---
sidebar_position: 2
title: Depositing & Withdrawing
---

# Depositing & Withdrawing

### Depositing

To provide liquidity, you deposit underlying tokens (e.g., USDC) into the vault. In return, the vault mints **share tokens** proportional to your deposit based on the current share price:

$$
sharesReceived = \frac{depositAmount}{sharePrice}
$$

There are two ways to deposit:

- **Deposit**: Specify an exact amount of underlying tokens to deposit. You receive however many shares that amount is worth at the current price.
- **Mint**: Specify an exact number of shares you want to receive. The vault calculates and takes the required amount of underlying tokens.

**Example:** If the current share price is \$1.05 and you deposit \$1,000 USDC, you receive approximately 952.38 vault shares ($1000 / 1.05$).

### Withdrawing

To exit your position, you burn vault shares in exchange for the underlying tokens. The amount you receive depends on the current share price, which may be higher or lower than when you deposited.

There are two ways to withdraw:

- **Withdraw**: Specify an exact amount of underlying tokens you want to receive. The vault burns however many shares are required.
- **Redeem**: Specify an exact number of shares to burn. You receive whatever amount of underlying tokens those shares are worth.

### Lock Period

After depositing, your vault shares are subject to a **lock period**. During this time you cannot transfer or withdraw your shares. This mechanism protects the vault against arbitrage of the share price. The duration is set per-deployment and can be queried on-chain via `lock_time()`; the current testnet deployment uses 60 seconds. Once the lock period has elapsed, you can withdraw or transfer freely at any time.

### Share Price

The share price reflects the total value of assets held in the vault divided by the total supply of shares:

$$
sharePrice = \frac{totalAssets}{totalShares}
$$

As the vault earns [fees](../trading/fees.md) and [borrowing interest](../trading/borrowing-interest.md), or absorbs trader losses, the total assets increase and the share price rises. Conversely, when traders are profitable, the vault pays out and the share price decreases. For more on what drives share price changes, see [Risks & Rewards](./risks-and-rewards.md).
