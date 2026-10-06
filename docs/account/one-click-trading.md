---
title: One-click trading
description: Understand session permissions, their limits, expiry, and revocation.
---

# One-click trading

One-click trading lets a supported passkey wallet sign eligible actions without another passkey prompt. You first approve a session key and its expiry on chain.

## What the session can do

The session policy fixes the allowed markets, token, fee forwarder, and relay fee recipient. It accepts authorized actions on those markets. It permits token transfers into an allowed market and token approvals for the fee forwarder.

Each relayed transaction still carries a fee cap and its own signed action terms. The market's normal order and risk checks still apply. The session is broader than one order. Review the permission and displayed expiry before you enable it.

:::warning The policy has no spending cap
The current policy restricts contracts and destinations. It does not set a maximum trade size, leverage, total spending amount, or action count. A valid session can commit available funds to trading and incur fees. Use it only on a browser and device you trust.
:::

## Enable and use it

Select the one-click mode in the app's settings. Confirm the session setup with your passkey, then wait for the on-chain confirmation.

The browser holds a local session key. Eligible actions use it until the session expires or its permission is revoked. A browser compromise can misuse an active session to trade. Restricting transfer destinations does not prevent losses through trading.

## End the session

Switch away from one-click trading and approve the removal when the app requests it. Wait for the removal transaction to confirm. Expiry stops new session authorizations.

Orders already created stay on chain, and open positions keep their exposure. After revocation, review resting orders and positions separately. [Orders](../trading/orders.md) explains cancellation. [Positions](../trading/positions.md) explains closes.

:::info Local cleanup and on-chain revocation are different
Closing the tab, disconnecting, or clearing browser data does not remove the permission from the smart wallet. The on-chain permission ends when its rule is removed or expires.
:::
