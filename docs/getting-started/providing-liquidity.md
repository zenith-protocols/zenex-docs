---
title: Provide liquidity
sidebar_position: 3
---

# Provide liquidity

This page covers how you deposit into a market's vault and redeem from it, what each order costs, and what holds a fill back. Each market has one vault. The vault holds the settlement token that backs every position in that market, and it is the counterparty to every trader there. If you deposit, you hold shares of the vault. You earn what the traders pay, and you carry the loss when the traders win. For what a share is worth and what you risk, see the [vault section](../vault/overview.md) and [Risks](../risks.md).

## A deposit or a redeem is an order

Both take two steps, at different times. First you sign the order. Your tokens or shares leave your wallet at that moment, together with a flat execution fee, and the market holds both. Second, a keeper fills the order at a signed price. On a deposit the vault mints your shares. On a redeem the vault burns them and pays you the settlement token. The whole order fills at once. The Withdraw tab in the app creates a redeem order.

While an order waits, you can cancel it, and a cancel returns your tokens or shares and the execution fee in full. **A freeze on the market blocks a new order, the fill, and the cancel until the freeze lifts.** For what a freeze stops, see [Market status](../markets/status.md).

**The fill sets your share count or your payout, not your signature.** The vault values what it holds and the open positions it faces, both at the moment of the fill. That value moves between the two steps, so the result moves with it. The figure the app shows you is an estimate.

You set the least you accept from a fill. On a deposit that minimum is a number of shares, and on a redeem it is an amount of the settlement token. The fill counts it after the vault fee, and the app sets it from the slippage you allow. If a fill would return less, the market rejects the order. Your tokens or shares come back in full, the keeper keeps the execution fee for the attempt, and the order is removed. The order does not wait for a better price. For the full rule, see [Deposits and redeems](../vault/depositing.md#the-minimum-received).

## What it costs

The order has two costs. The execution fee is a flat amount in the settlement token. It escrows with your order and pays the keeper that fills it. A cancel returns it, and a rejection does not. The vault fee is a percentage. The fill takes it off the amount you deposit, and off the assets a redeem returns. The keeper takes a cut of that percentage, the treasury takes a cut, and the rest stays in the vault for the shareholders.

Each market sets both costs, and the current amounts are on the [market parameters](../markets/market-parameters.md) page. The fill reads the percentage rates as they stand at that moment, so a rate change reaches an order that still waits. Your order carries its own execution fee from the moment you sign.

When you sign or cancel an order, the transaction also costs a network fee in the token you trade with. [Fees](../trading/fees.md) covers how you pay it.

## Before you start

You need a connected wallet that holds the market's settlement token. A deposit also needs enough of the token to cover the execution fee on top of the amount. [Start trading](./start-trading.md) gives the same prerequisite.

## Deposit

1. Connect your wallet, then open the Vault tab.
2. On the Deposit tab, enter the amount of the settlement token you want to deposit. Each market sets a minimum deposit, and the market refuses a smaller amount when you sign. The minimum reads the amount you enter. The vault fee comes off that amount at the fill, and the vault mints your shares on what is left. The execution fee is charged on top of the amount.
3. Confirm and sign. Your tokens and the execution fee move into escrow, and the order waits for a keeper.

A keeper fills your deposit with a price published at or after the moment you signed. The market also refuses a price report that is too old. The fill lands in a later ledger than your signature.

Each vault has a ceiling on its balance. If your deposit would take the balance over the ceiling, the fill waits until the balance leaves room for it. You can cancel the order instead. The [market parameters](../markets/market-parameters.md) page carries the current minimum deposit and the current ceiling. A retired market refuses new deposits.

## Redeem

1. Open the Vault tab and switch to the Withdraw tab.
2. Enter how many of your shares you want to redeem. The market accepts any positive number up to the shares you hold, and a larger number fails when you sign.
3. Confirm and sign. Your shares and the execution fee move into escrow, and the order waits for a keeper.

A redeem waits out a cooldown before any keeper can fill it. The cooldown runs from the moment you sign. The market sets its length, and the fill reads that setting, so a change to the length reaches an order that already waits.

Two gates then protect the open positions, and your order needs both to pass. The liquidity gate needs enough liquidity to stay behind the positions the vault backs. The profit gate looks at what remains in the vault after your payout. Half of that amount is the base, and the pending profit of the long traders and of the short traders must each stay within a set part of it. A fill checks the cooldown first, then your minimum, then the two gates.

**A redeem can stay unfilled for as long as either gate holds, so you may be unable to exit for a while.** The order keeps waiting, and you can cancel it to get your shares back as long as the market is not frozen. The [market parameters](../markets/market-parameters.md) page carries the current cooldown and the current redeem block. [Risks](../risks.md) covers why a redeem is refused.

On a retired market a redeem pays out inside your own transaction. It needs no keeper and no cooldown, and it carries no execution fee and no vault fee. Your minimum does not bound that payout. A deposit or redeem that still rests there never fills, and you can cancel it. For that path, see [Deposits and redeems](../vault/depositing.md).

## After the fill

Your shares are a token in your wallet. You can send them to another wallet, and whoever holds them can redeem. Their value rises as traders pay fees and interest, and as traders lose. It falls while traders hold profit, before those traders close. For how that value is set, see [Share value](../vault/share-value.md).

You control the amount, your minimum, and the cancel. You do not control who fills the order, when it fills, or which verified price it fills at.
