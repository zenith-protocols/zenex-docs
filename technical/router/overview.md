---
sidebar_position: 1
title: Transactions and authorization
description: Reference for the market router, fee forwarder, session policy, and wallet factory.
---

# Transactions and authorization

The utility contracts compose the app's transaction flow. `RouterContract` batches calls. `FeeForwarderContract` collects a token fee and invokes a target. `SessionPolicyContract` restricts smart-account authorization contexts.

| Reference | What it defines |
| --- | --- |
| [Market router](./batching.md) | The four router entry points, `Call`, strict and isolated execution, and result encoding. |
| [Fee forwarder](./fee-abstraction.md) | `forward`, `forward_dynamic`, signed arguments, the fee allowance, errors, and events. |
| [Session policy](../session-policy.md) | Fixed contract permissions, token destinations, the pinned fee recipient, and policy errors. |
| [Wallet factory](../wallet-factory.md) | Smart-account creation, constructor inputs, and deterministic addresses. |

The market enforces order authorization and execution gates. The router has no persistent state, funds, owner, or special market authority. Each target enforces its own authorization. The forwarder authenticates its fee payer before it invokes the target.

For the user-facing signing flow, read [What you sign](/account/signing). Current contract addresses appear in [Deployments](/deployments).
