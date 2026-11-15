---
title: Market migration
description: Close positions and withdraw from the previous market while it winds down.
---

# Market migration

Zenex is moving to a new market and vault that run version 1.0.0 of the contracts. Nothing moves across automatically. Positions, orders, vault shares, and claimable credit from before the move stay on the previous market until you close or withdraw them. The dates are to be announced.

## Close and withdraw on the previous site

The previous market keeps its own site under `/old/` on the app's address while it winds down. During that time the new site shows a banner with an **Open the previous site** link to a connected account that still holds something there. Use the previous site to:

1. Close open positions.
2. Cancel resting orders to return their escrow.
3. Claim any claimable credit.
4. Redeem vault shares.

## The wind-down

The plan is to delist the previous market when the move starts. [Market status](./status.md#delisting-starts-a-wind-down) explains each stage, including the settlement price the owner can set after the first day.

| Stage | What happens |
| --- | --- |
| Seven days from delisting | Positions cannot grow. You can close, cancel, claim, and redeem. |
| After seven days | Keepers can close every remaining position, including healthy ones, through the liquidation path. |
| After forced closes | Vault shares stay redeemable and claimable credit stays claimable. |

:::warning A forced close charges the liquidation fee
A position left open past the seven days can be closed by any keeper at the price then in force. It pays the usual liquidation fee. Close it yourself before then.
:::

## Planned settings for the new market

The new market is not deployed yet. These launch settings are planned and can change. [Deployments](../deployments.md) lists live values once the market exists.

| Setting | Planned value |
| --- | --- |
| Maintenance margin | 1% |
| Initial margin | 4%, a maximum leverage of 25x. The maximum is to be raised weekly toward 40x. |
| Position cap | $1,000 |
| Open interest cap | $50,000 |
| Vault cap | $100,000 |
| Vault share symbol | zXLMUSDC |

[One-click trading](../account/one-click-trading.md) is not offered on the new market for now. On the new vault, share value counts [accrued borrowing interest](../vault/share-value.md#pending-borrowing) before positions pay it. Version 1.0.0 includes changes that no independent reviewer has checked. See [Audit reports](../audits.md).
