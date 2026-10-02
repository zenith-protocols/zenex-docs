---
title: Deposits and redeems
sidebar_position: 2
---

# Deposits and redeems

This page covers how you enter and leave the vault, what an order costs, the minimum you can set, how you cancel, and why a fill fails. A deposit and a redeem are orders. You create one and sign it, and the market takes what you put in and holds it. A keeper fills it later with a signed price report. Each order fills in one piece, never in parts. See [Keepers](../keepers.md) for who may fill an order. A redeem on a retired market is the one order that pays out inside your own transaction.

## A deposit turns your tokens into shares at the value of the fill

To join the vault, create a deposit order for an amount of the market's settlement token. The market takes that amount from your wallet at creation, together with a flat execution fee, and holds both. The market sets the smallest deposit it accepts, and your amount must reach that floor. The execution fee does not count toward it.

A market takes a new deposit while it is active, on ice, or delisted. A frozen market refuses every new order, and a retired market refuses a new deposit. See [Market status](../markets/status.md) for each state.

When a keeper fills the order, the fill takes the vault fee off your amount and turns the rest into shares. The conversion uses the value of a share at the fill, not the value at creation. See [Share value](./share-value.md) for what sets that value and why it is read at the price that is adverse to you.

Two timing rules bind a fill to a moment after you signed. [Eight conditions leave a fill waiting](#eight-conditions-leave-a-fill-waiting) lists them.

## A redeem turns your shares into tokens after a cooldown

To leave the vault, create a redeem order for a number of shares. If the market is not retired, the market takes the shares from your wallet at creation, together with the same flat execution fee, and holds both. The market accepts any positive number of shares. A frozen market refuses the order.

When a keeper fills the order, the vault burns the shares. The fill values your shares at the price that is adverse to you, as a deposit does. It takes the vault fee off the proceeds and pays you the rest in the settlement token. If that payment cannot reach your wallet, the market parks the amount in your name and you take it with a claim. See [Claimable credit](../trading/claimable-credit.md) for how that balance pays out.

A redeem waits out a cooldown before any keeper can fill it. The cooldown keeps liquidity in the vault for a set time after you ask to leave. It runs from the moment you created the order. The current length is the redeem cooldown row in [Market parameters](../markets/market-parameters.md). The market reads that length at the fill, so a change to it moves the deadline of every redeem already waiting. See [Governance](../governance.md) for who changes a market parameter.

## An order costs a vault fee and an execution fee

The vault fee is a rate on the tokens a fill moves. On a deposit it applies to the amount you deposit. On a redeem it applies to the tokens your shares redeem for, before the fee. The market sets one rate for a deposit and a second for a redeem. Part of the fee pays the keeper. Part goes to the protocol treasury. The rest stays in the vault, where it belongs to the liquidity providers who hold shares.

The order also holds a flat execution fee in the settlement token. It pays the keeper that fills the order, and it is the same amount whatever the size of your order. For the current rates and amounts, see [Market parameters](../markets/market-parameters.md).

## A fill below your minimum rejects the order {#the-minimum-received}

Each order carries a minimum received that you set. On a deposit it is the fewest shares you accept. On a redeem it is the fewest settlement tokens you accept. Both count after the vault fee. A minimum of zero switches the check off.

If the share value moves so far that a fill would return less than your minimum, the market rejects the order. It does not fill the order, and it does not wait for a better price. This keeps the minimum a limit on slippage. The check runs after the cooldown and the timing rules and before the balance cap and the redeem limits. A rejection therefore ends the order even when one of those limits would also have blocked the fill.

The market returns the tokens or shares you put in, in full, and charges no vault fee. The keeper keeps the execution fee for the attempt, and the order is gone. A minimum set too tight therefore costs you the execution fee.

If the tokens of a rejected deposit cannot reach your wallet, they wait for you as [claimable credit](../trading/claimable-credit.md). One cause is a dropped trustline, the Stellar setting that lets an account hold a token. A rejected redeem returns shares, and shares need no trustline.

## You can cancel an order unless the market is frozen

If the market is not frozen, you can cancel an order at any time before it fills. A cancel returns everything the market holds for that order. That is the tokens or the shares you put in, and the execution fee with them. Nothing is withheld.

**A frozen market stops every order action.** While the freeze lasts, you cannot create or cancel an order, and no keeper can fill one. The market keeps what it holds. Your tokens or your shares come back when the freeze lifts and you cancel. See [Market status](../markets/status.md) for what else a freeze stops.

## Eight conditions leave a fill waiting

Each of these conditions stops a fill. The order stays in place, and a keeper can try again later. A fill below your minimum is different, because it rejects the order as described above.

| Condition | Affects |
| --- | --- |
| The fill would land at your creation time or earlier, so no transaction both creates and fills an order. | Both |
| The fill would use a price published before your creation time. | Both |
| The oracle, the contract that checks each price report, rejects the report the keeper presents, for example because it is too old to accept. | Both |
| The market is frozen. | Both |
| The deposit would carry the vault above its balance cap. | Deposit |
| The cooldown on the order has not run out. | Redeem |
| The redeem would leave too little liquidity behind for the open positions the vault backs. | Redeem |
| Pending profit on the long side or the short side is above its limit, measured against what stays in the vault after you are paid. | Redeem |

The market sets the balance cap and the redeem block level, and [Market parameters](../markets/market-parameters.md) gives the current values.

Most of these conditions depend on the market and not on you. An order can wait through them and fill later, once the price moves or once traders close. A redeem also comes unblocked when other liquidity providers join. A deposit held back by the balance cap waits on redeems, because a redeem lowers the vault balance and each further deposit raises it. A retired market is the exception. It never trades again, so no queued order fills there, and a cancel is the way out.

## A redeem on a retired market pays out at once

A retired market never trades again, and [Market status](../markets/status.md) covers how a market reaches that state. It accepts a redeem and no other new order. That redeem pays out inside your own transaction, so it needs no keeper and it waits out no cooldown. It carries no execution fee and no vault fee, and you receive the full value of the shares you send. The minimum received you set does not bound that payout.
