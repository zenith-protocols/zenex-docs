---
title: Deposits and redeems
sidebar_position: 2
---

# Deposits and redeems

A deposit and a redeem are orders. You create one and sign it, and the market takes and holds what you put in. A keeper fills it later with a signed price report. See [Keepers](../keepers.md) for who may fill an order. Each order fills in one piece, never in parts. A redeem waits out a cooldown first, and a redeem on a retired market is the one case that pays out inside your own transaction.

## How a deposit works

To join the vault, create a deposit order for an amount of the market's settlement token. The market takes that amount from your wallet at creation, together with a flat execution fee, and holds both. The market sets the smallest deposit it accepts, and your amount must reach that floor. The execution fee does not count toward it.

When a keeper fills the order, the fill takes the vault fee off your amount and turns the rest into shares. The conversion uses the value of a share at the fill, not the value when you created the order. See [Share value](./share-value.md) for what sets that value and why it is read at the price that is adverse to you.

A deposit waits out no cooldown. Two separate timing rules still bound the fill. The price the fill uses must be published at or after your creation time. The fill itself must land after the moment you created the order.

## How a redeem works

To leave the vault, create a redeem order for a number of shares. If the market is not retired, the market takes the shares from your wallet at creation, together with the same flat execution fee, and holds both. The market accepts any positive number of shares.

When a keeper fills the order, the vault burns the shares. The fill values your shares at the price that is adverse to you, as a deposit does. It takes the vault fee off the proceeds and pays you the rest in the settlement token. If that payment cannot reach your wallet, the market parks the amount in your name and you take it with a claim. See [Claimable credit](../trading/claimable-credit.md) for how that balance pays out.

A redeem waits out a cooldown before any keeper can fill it. The cooldown runs from the moment you created the order. The market reads the length of the cooldown at the fill, so a change to that length moves the deadline of orders already in the queue. See [Governance](../governance.md) for who changes a market parameter.

## What an order costs

An order that a keeper fills charges a vault fee. It is a rate on the assets the fill moves, and the market sets one rate for a deposit and a second for a redeem. Part of that fee pays the keeper. Part goes to the protocol treasury. The rest stays in the vault, where it belongs to the depositors who hold shares.

That order also holds a flat execution fee in the settlement token. It pays the keeper that fills the order, and it is the same amount whatever the size of your order. A redeem on a retired market needs no keeper, and it pays neither fee. For the current rates and amounts, see [Market parameters](../markets/market-parameters.md).

## The minimum received

Each order in the queue carries a minimum received that you set. On a deposit it is the fewest shares you take. On a redeem it is the fewest settlement tokens you take. Both are counted after the vault fee. The market refuses a fill that would return less than your minimum. The order rests until the share value moves back into your range. Set the minimum to zero to accept any result.

## How you cancel

If the market is not frozen, you can cancel an order at any time before it fills. A cancel returns everything the market holds for that order: the assets or the shares you put in, and the execution fee with them. Nothing is withheld.

**A frozen market blocks a cancel.** While the freeze lasts, the market keeps what it holds and no keeper can fill your order. Your assets or your shares come back when the freeze lifts and you cancel. See [Market status](../markets/status.md) for what else a freeze stops.

## Why a fill can be refused

A refused fill leaves your order where it is. The order still rests, and a keeper can try again later. These are the reasons a fill fails:

| Reason | Affects |
| --- | --- |
| The fill would land at your creation time or earlier, so no transaction both creates and fills an order. | Both |
| The fill would use a price published before your creation time. | Both |
| The oracle rejects the price report the keeper presents, for example because it is too old to accept. | Both |
| The fill would return less than the minimum you set. | Both |
| The market is frozen or retired. | Both |
| The deposit would carry the vault above its balance cap. | Deposit |
| The cooldown on the order has not run out. | Redeem |
| The redeem would leave too little liquidity behind for the open positions the vault backs. | Redeem |
| Pending profit on the long side or the short side is above its limit, measured against what stays in the vault after you are paid. | Redeem |

The market sets the balance cap and that profit limit, and [Market parameters](../markets/market-parameters.md) gives the current values.

Most of these reasons depend on the market and not on you. An order can sit through them and fill later, once the price moves or once traders close. A redeem also comes unblocked when other depositors join. A deposit held back by the balance cap waits on redeems instead, because each further deposit carries the vault closer to the cap. A retired market is the exception. No order in the queue fills there, and a cancel is the way out.

## A redeem on a retired market

A retired market never trades again, and [Market status](../markets/status.md) covers how a market reaches that state. It accepts a redeem and no other order. That redeem pays out inside your own transaction, so it needs no keeper and it waits out no cooldown. It carries no execution fee and no vault fee, and you receive the full value of the shares you send. The minimum received you set does not bound that payout.
