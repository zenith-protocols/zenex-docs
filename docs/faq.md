---
title: FAQ
description: Find a short answer and the page that explains it.
---

# FAQ

Use these answers to find the relevant action or rule.

## Do I need XLM?

A wallet transaction needs XLM from its source account. A relayed action pays a configured token fee. Classic accounts still have reserve requirements. See [Wallets and funds](./account/wallets-and-funds.md).

## Why did my transaction succeed but my trade not open?

Creation can succeed while an attempted fill fails recoverably. The order then rests with escrow held. Check Orders and Positions. See [Pending and failed transactions](./account/transactions.md).

## Why did an expired order keep my funds?

Expiry stops fills. Cancellation returns escrow while the market permits it. See [Orders](./trading/orders.md#cancels).

## Why did my close fail?

Check margin, the decrease lock, your price bound, liquidity, and market status. Below maintenance margin, an ordinary close is refused. See [Positions](./trading/positions.md) and [Margin and leverage](./trading/margin-and-leverage.md).

## Why is my liquidation price changing?

Borrowing, funding owed, fees, and market settings affect equity. The asset price is only one input. See [Liquidation](./trading/liquidation.md).

## Does earned funding increase my margin?

It becomes separate claimable credit when settled. It does not defend the position. See [Claimable credit](./trading/claimable-credit.md).

## Does one-click trading have a spending limit?

The current policy restricts contracts and destinations, but has no spending cap. Check the expiry and revoke the permission on chain when finished. See [One-click trading](./account/one-click-trading.md).

## Why is a withdrawal still waiting after the cooldown?

The vault also needs available assets and liquidity, with pending trader profit within its limits. See [Deposits and withdrawals](./vault/depositing.md).

## Why did my vault order disappear without a fill?

A result below minimum received rejects the order. Principal returns, the keeper keeps the execution fee, and the order ends. See [Minimum received](./vault/depositing.md#the-minimum-received).

## What happens when the market freezes?

Positions and escrow remain held. Closing, adding margin, cancelling, redeeming, and claiming are blocked. Price exposure and elapsed costs continue. See [Market status](./markets/status.md).

## Where are contract addresses and audit reports?

Use [Deployments](./deployments.md) for addresses, code hashes, owners, and settings. Use [Audit reports](./audits.md) for published review coverage.
