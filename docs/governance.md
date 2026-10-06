---
title: Governance
description: Understand who controls market settings, status, and upgrades.
---

# Governance

A contract's owner controls its administrative actions. Different owners can control the market, oracle, treasury, and factory. Use [Deployments](./deployments.md) to identify the current owners and any verified timelock.

## What owners can change

| Contract | Owner powers that affect users |
| --- | --- |
| Market | Replace parameters, change status, set a delisted settlement price, and upgrade market code. |
| Oracle | Change freshness windows, narrow the spread, and upgrade oracle code. |
| Treasury | Change its fee share and withdraw collected funds. |
| Factory | Change the metadata used for future deployments and upgrade factory code. |

Parameter bounds apply to the deployed code. They constrain ordinary changes made through that code. The market is also its vault's strategy. Its authority over vault assets makes market control relevant to liquidity providers. No owner call can replace a market's settlement token, vault, oracle, treasury, or price stream.

An owner can transfer ownership to a new account, which must accept it. An owner can also give up ownership for good. Nobody can change that contract afterwards, so a market given up while frozen stays frozen.

:::warning An upgrade changes the rules
The market and oracle owners can replace their contract code. Existing positions rely on those contracts. Parameter bounds alone do not protect against the behavior of replacement code. New oracle code can change the price that every market on that oracle receives.
:::

## When a change takes effect

An account owner can apply an authorized change directly. A governance timelock can queue ordinary changes for a public delay of one second to 60 days. A freeze or delisting can therefore arrive without the delay used for a parameter change. A change to the delay itself waits out the current delay.

:::info A timelock depends on its deployed delay
A queue helps only when the owner actually uses a timelock and its delay gives you time to act. Market status changes bypass the ordinary queue and can take effect immediately.
:::

## What this means for an open position

New settings can affect existing positions and resting orders. Their fees, margin requirements, funding, and borrowing can change before you exit. A freeze can hold funds in place. A wind-down can introduce an owner-set price and later force healthy positions closed. Read [Market status](./markets/status.md) for those outcomes and [Risks](./risks.md) for the wider exposure.
