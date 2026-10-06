---
title: Share value
description: Understand what a vault share represents and how its return changes.
---

# Share value

A share represents part of one market's vault. Its value changes with the assets held and the open positions the vault backs. Your share count stays fixed until you transfer, deposit, or redeem. Your return appears as a change in what those shares redeem for.

## What raises or lowers value

| Source | Effect on the vault |
| --- | --- |
| Retained market fees | Add income. |
| Retained borrowing interest | Add income. |
| Trader losses | Increase backing, within collectible margin. |
| Trader profits | Reduce backing. |
| Bad debt | Reduces assets when losses exceed trader margin. |

Funding transfers between traders and does not belong to vault shareholders.

:::warning Fee income does not guarantee profit
The vault pays trader profits and absorbs bad debt. Its shares can redeem for less than you deposited.
:::

## Open positions count before they close

The vault values pending trader profit and loss. You do not need to wait for a close to see their effect on share value. When the position closes, the asset transfer replaces the pending mark. The same profit or loss is not counted twice. The profit cap limits how much pending profit counts. The margin behind a side limits how much pending loss is collectible.

## Deposit and redeem quotes differ

The market chooses the mark that favors the vault for each action. A deposit uses the higher vault value and receives fewer shares. A redeem uses the lower value and returns fewer tokens. Vault fees apply on top. Entering and leaving at an unchanged asset price can therefore return less than you put in. The estimate changes with prices, open positions, and vault assets. The final conversion happens at execution.

Use [Deposits and withdrawals](./depositing.md) for minimum received and withdrawal availability. Use [Risks](../risks.md) for the broader exposure.
