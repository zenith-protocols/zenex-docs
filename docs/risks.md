---
title: Risks
description: Review the main ways trading, liquidity, permissions, and services can affect your funds.
---

# Risks

Trading and providing liquidity expose funds to prices, contract behavior, counterparties, and administrative control. The pages below explain the limits that matter before you act.

:::danger Funds can be lost or held
A position can lose all its margin. Vault shares can lose value. Market checks or a freeze can delay access to funds.
:::

## Trading risks

| Risk | What can happen | Details |
| --- | --- | --- |
| Leverage and time costs | Price losses, funding, and interest consume equity. | [Margin and leverage](./trading/margin-and-leverage.md). |
| Liquidation | A keeper closes the whole position and charges the liquidation fee. | [Liquidation](./trading/liquidation.md). |
| Delayed exits | A trigger, price bound, decrease lock, or missing keeper leaves an exit unfilled. | [Orders](./trading/orders.md). |
| Profit cap | A close pays less than marked profit. The withheld part stays in the vault. | [Profit and payouts](./trading/pnl.md). |
| Auto-deleveraging | A keeper reduces eligible exposure without another approval. | [Auto-deleveraging](./trading/adl.md). |
| Price or network failure | Execution stops, arrives late, or uses a valid report that differs from the display. | [Prices](./markets/prices.md). |

The position's margin bounds its trading loss. Separate orders, relay fees, and active session permissions can still commit other available funds.

## Liquidity risks

The vault pays trader profits and absorbs losses beyond trader margin. Fee income can be smaller than those outflows. A deposit and redeem use different adverse marks and each pays its applicable vault fee. A quick round trip can lose value. A redeem can remain blocked after its cooldown because liquidity or pending profit checks fail. A minimum-received rejection returns principal but spends the execution fee. Read [Share value](./vault/share-value.md) and [Deposits and withdrawals](./vault/depositing.md).

## Permissions and services

A relayed signature permits fees and contract actions within its signed scope. Dynamic target arguments leave some submission choices to the relayer. One-click trading grants continuing permission. The current policy limits destinations but has no spending cap. A compromised browser can misuse it for trading. A timeout can hide a successful submission. Signing another request before checking the chain can duplicate exposure. Read [What you sign](./account/signing.md), [One-click trading](./account/one-click-trading.md), and [Pending and failed transactions](./account/transactions.md).

## Owners and contract risk

Owners can change parameters, freeze markets, delist them, and upgrade relevant contracts. A freeze blocks exits while exposure and elapsed costs continue. A delisted market can settle at an owner-set price. Healthy positions can later be forcibly closed. Contracts, dependencies, token issuers, and the Stellar network can fail. An audit covers a defined scope and cannot guarantee safety. Read [Governance](./governance.md), [Market status](./markets/status.md), and [Audit reports](./audits.md).

App, relay, and funding-service access depends on each service's availability and access policy. The contract interface remains a separate integration surface.
