---
title: Provide liquidity
sidebar_position: 3
---

# Provide liquidity

Each market has one vault. The vault holds the settlement token that backs every position in that market, and it is the counterparty to every trader there. If you put tokens in, you hold a share of the vault. You earn what the traders pay, and you carry the loss when the traders win. For what a share is worth and what you risk, see the [vault section](../vault/overview.md).

## A deposit is an order

A deposit takes two steps, at different times. First you sign a deposit order. Your tokens leave your account at that moment, together with a flat execution fee. The market holds both. Second, a keeper fills the order at a signed price, and the vault mints your shares. The whole order fills at once.

Your order waits between the two steps. A deposit mints no shares while it waits, so it earns nothing for you. While an order waits, you can cancel it. A cancelled deposit returns your tokens and the execution fee in full. A cancelled withdrawal returns your shares and the execution fee in full. An emergency freeze on the market blocks the fill and the cancel until the freeze lifts. For what a freeze stops, see [Market status](../markets/status.md).

**The fill sets your share count, not your signature.** The vault values what it holds and the open positions it faces, both at the moment of the fill. That value moves between the two steps, so your share count moves with it. The count the app shows you is an estimate. You can set the least you accept from a fill. On a deposit that bound is a number of shares, and on a withdrawal it is an amount of the settlement token. The fill measures your bound after the vault fee. A fill below your bound fails, and your order keeps waiting.

A withdrawal is the same order in reverse. Your shares leave your account when you sign, and the settlement token arrives at the fill. Your money stays exposed to the vault's value for the whole wait. The fill sets the amount you receive, at the value the vault holds at that moment.

## What it costs

You pay two costs. The execution fee is a flat amount in the settlement token. It escrows with your order. It pays the keeper that fills the order. A cancel returns it. The vault fee is a percentage. The fill takes it off the amount you deposit, and off the assets a withdrawal returns. The keeper takes a cut of that percentage, the treasury takes a cut, and the rest stays in the vault.

Each market sets both costs, and the current amounts are on the [market parameters](../markets/market-parameters.md) page. The fill reads the percentage rates as they stand at that moment, so a rate change reaches an order that still waits. Your order carries its own execution fee from the moment you sign.

## Before you start

You need an account and the market's settlement token. For the account setup and the test funds, see [Start trading](./start-trading.md).

## Deposit

1. Connect your account, then open the Vault tab.
2. On the Deposit tab, enter the amount of the settlement token you want to deposit. Each market sets a minimum deposit, and the market refuses a smaller amount when you sign. The minimum reads the amount you enter. The vault fee comes off that amount at the fill, and the vault mints your shares on what is left. The execution fee is charged on top of the amount you enter.
3. Confirm and sign. Your tokens and the execution fee move into escrow, and the order waits for a keeper.

A keeper fills your deposit with a price published at or after the moment you signed. The market also refuses a price report that is too old. The fill lands in a later ledger than your signature.

Each vault has a ceiling on its balance. A deposit fills while it keeps the vault at or under that ceiling. A larger deposit rests until the balance falls back under the ceiling, and you can cancel it instead. The [market parameters](../markets/market-parameters.md) page carries the current minimum deposit and the current ceiling.

## Withdraw

1. Open the Vault tab and switch to the Withdraw tab.
2. Enter how many of your shares you want to return. The market accepts any positive number up to the shares you hold. A larger number fails when you sign. You can also set the least amount of the settlement token you accept from the fill.
3. Confirm and sign. Your shares and the execution fee move into escrow, and the order waits for a keeper.

A withdrawal waits out a cooldown before any keeper can fill it. The cooldown runs from the moment you sign. The market sets its length, and the fill reads that setting. A change to the length reaches an order that already waits.

Two gates protect the open positions. A withdrawal fills while enough liquidity stays behind the positions the vault backs. It also fills while the pending profit of the traders stays under a set part of what remains in the vault. That second gate measures the long traders and the short traders separately. Your order waits until the condition clears, and you can cancel it instead. The [market parameters](../markets/market-parameters.md) page carries the current cooldown and the current profit limit.

## After the fill

Your shares are a token in your account. You can send them to another account, and whoever holds them can withdraw. Their value rises as traders pay fees and interest, and as traders lose. It falls while traders hold profit, before those traders close. For how that value is set, see [Share value](../vault/share-value.md).
