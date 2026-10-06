---
title: Keepers
description: Understand who fills an order and what determines execution.
---

# Keepers

A keeper submits an execution call with a signed price report. Any account can act as a keeper when the contract permits the action. Keepers fill trade and vault orders, liquidate weak positions, and reduce eligible positions through auto-deleveraging.

## What a keeper controls

The keeper chooses the eligible order or position, the submission time, and an accepted price report. The market checks the signed order terms, price rules, and risk limits. A keeper cannot fill outside those checks. The fill names a reward recipient. That recipient can differ from the transaction submitter.

:::warning Execution needs someone to act
An eligible trigger does not execute itself. A stop loss, deposit, or withdrawal can wait if no keeper submits a successful fill. Rewards encourage execution, but do not guarantee its timing.
:::

## How the keeper is paid

Order fills pay the recorded execution fee. The keeper also receives the configured share of eligible market fees. A liquidation or ADL action consumes no order, so has no order execution fee. The market can still pay its applicable fee share.

## Keeper and relayer are different roles

The relayer submits a transaction using your signed permissions. The keeper executes an order against a verified price. One service can perform both jobs. The router can combine order creation with an execution attempt. That does not guarantee the fill succeeds. Use [What you sign](./account/signing.md) for the submission flow. Use [Orders](./trading/orders.md) and [Prices](./markets/prices.md) for execution conditions.
