---
title: Profit and payouts
description: Understand why a displayed profit differs from the amount a close returns.
---

# Profit and payouts

Your position's profit or loss measures how its current value differs from entry. A long gains when the price rises. A short gains when it falls. Your entry price is the combined average of your increases. A partial close leaves that average unchanged.

## The mark and the payout

The market values a position at the price it would close on. A long exits at the bid. A short exits at the ask. The difference between entry and exit quote sides creates an immediate spread cost. A position can start with a loss even before the price moves.

| Figure | Meaning |
| --- | --- |
| Unrealized profit or loss | The result at the current mark, before the profit cap and closing costs. |
| Equity | What remains after the marked result, profit cap, and closing costs. |
| Payout | What the actual decrease or close returns after settlement. |

A partial close realizes only the result on the closed size. A full close settles the whole position. See [Positions](./positions.md).

## The profit cap {#the-profit-cap-scales-a-winners-payout-when-a-side-runs-ahead}

The vault limits the total profit it recognizes on each side. When a side's pending profit exceeds that cap, profitable closes receive a reduced share. The measure uses the quote that favors the side. It can reach the cap before your own exit-price mark suggests it. For illustration, a side with a cap of 100 and pending profit of 125 pays four fifths of each realized profit. A profit of 10 pays 8 before fees.

The cap moves with vault liquidity. Other positions on your side affect the proportion you receive. Read [Auto-deleveraging](./adl.md) for the forced reduction that protects an overextended side.

:::warning Marked profit can exceed paid profit
Above the side's cap, a close pays only a proportion of its profit. The unpaid portion stays in the vault and is not future credit. Losses pass through in full.
:::

## Collect the result

A close pays what remains after losses and [Fees](./fees.md). A liquidation adds its own fee. Earned funding goes to a separate credit balance. A payout that cannot reach your wallet can also become credit. Use [Claimable credit](./claimable-credit.md) for those balances.
