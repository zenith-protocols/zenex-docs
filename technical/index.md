---
slug: /technical
sidebar_position: 1
title: Architecture Overview
---

# Architecture Overview

Zenex is a leveraged perpetual futures protocol built on [Stellar Soroban](https://soroban.stellar.org/). Each market is an isolated pair of contracts, a perp engine (the market contract) and a strategy vault, deployed atomically through a factory. The contracts interact through well-defined, one-directional interfaces.

## System Contracts

| Contract | Role |
|---|---|
| **Market** | Single-market perpetual futures engine handling orders, netted positions, PnL, fees, funding, borrowing, liquidation, and ADL |
| **Strategy Vault** | Tokenized vault acting as the liquidity pool and counterparty to traders, with all mutations gated to the registered strategy (the market contract) |
| **Treasury** | Protocol fee accumulator with a configurable rate |
| **Factory** | Deterministic deployer for market + vault pairs |
| **Governance** | Optional timelock proxy for governance-controlled parameter changes |
| **Oracle** | Chainlink Data Streams adapter that verifies a signed report against a market's feed and gates its freshness |
| **[Market Router](./router/overview)** | Stateless, unprivileged batcher: several trader calls plus an optional keeper fill in one transaction |

Each market contract serves exactly one market, identified by the immutable `feed_id` set in its constructor: a deployment is the market. To run BTC and ETH perps you deploy two independent market + vault pairs through the factory.

## Upgradeability

The **market**, **oracle**, and **factory** contracts expose an owner-gated `upgrade` that replaces the WASM in place, preserving storage (a wrong `operator` raises the shared `UpgradeNotOwner` code, 600). Point the owner at the governance contract and every upgrade inherits the timelock, since `queue` forwards an arbitrary call. The rest are deliberately immutable, each for its own reason:

| Contract | Why not upgradeable |
|---|---|
| **Strategy Vault** | Every mutation is gated by the market contract, so a vault defect is contained by freezing the market and winding it down. An owner key on the contract holding all collateral would buy nothing the market's own upgrade path does not already cover |
| **Treasury** | Redeployable: withdraw the balance, deploy a replacement, point future deploys at it through the factory's `set_init_meta` |
| **Market Router** | Stateless — it owns nothing and holds nothing, so redeploying is free and an owner would only subtract from that guarantee |
| **Governance** | It is the upgrade authority, so it stays a fixed root of trust; its escape hatch is the two-step ownership transfer to a fresh instance |

Storage is never migrated automatically on upgrade: a release that changes a stored type's shape must ship its own migration entry and bump the schema version. Upgrading the market or vault WASM also does not change what the factory installs for *new* markets — those hashes live in the factory's instance storage, updated by its owner through `set_init_meta` (see [Factory](./factory/overview)).

Users interact with the perp engine through any Stellar wallet. The optional smart-account stack provides a smart account, signature verifiers, and a session policy for one-click trading; gasless relay submissions ride the market router's `_with_fee` entry points. See [Smart Account](./account/overview) for the full breakdown.

## Roles

Four roles interact with a market contract.

| Role | Authorization | What it does |
|---|---|---|
| **Admin** (owner) | `#[only_owner]` | `set_config`, `set_status`, `set_terminal_price`, and the Ownable transfer surface |
| **Trader** | The user's own signature | Creates and cancels price-free trade orders, claims funding |
| **LP Depositor** | The user's own signature | Creates and cancels vault orders (deposit and redeem) |
| **Keeper** | Permissionless | Fills orders, liquidations, vault orders, and ADL at a verified price for a reward, and runs the unrewarded maintenance pokes (`accrue`, `update_adl_state`), which carry a price as well |

A trader only ever creates and cancels intents. A permissionless keeper is what actually fills an order against a verified oracle price. The keeper is not authenticated: it is simply the reward recipient the caller names, and the trader consented to the fill through the margin and execution fee escrowed at order creation.

## Data Flow

```mermaid
flowchart TB
    subgraph Actors["External Actors"]
        direction LR
        Trader["Trader"]
        LP["LP Depositor"]
        Keeper["Keeper Bot"]
        Admin["Owner"]
    end

    subgraph Contracts["On-Chain Contracts (Zenex in green, Chainlink in blue)"]
        Market["Market"]
        Vault["Strategy Vault"]
        PV["Oracle"]
        Treasury["Treasury"]
        Verifier["Chainlink Data Streams verifier"]
    end

    Trader -->|"create_order / cancel_order / claim_credit"| Market
    LP -->|"create_vault_order / cancel_vault_order"| Market
    Keeper -->|"execute_order / execute_liquidation / execute_vault_order / execute_adl"| Market
    Keeper -->|"accrue / update_adl_state (unrewarded)"| Market
    Admin -->|"set_config / set_status / set_terminal_price"| Market

    Market -->|"verify_price"| PV
    PV -->|"verify"| Verifier
    Market -->|"strategy_withdraw / strategy_deposit / strategy_redeem"| Vault
    Market -->|"get_rate"| Treasury

    style Market fill:#0f2e24,stroke:#29a383,stroke-width:2px
    style Vault fill:#0f2e24,stroke:#29a383
    style PV fill:#0f2e24,stroke:#29a383
    style Treasury fill:#0f2e24,stroke:#29a383
    style Verifier fill:#0d2847,stroke:#3b82f6
```

The market contract is the only contract directly admin-controlled in the diagram. The oracle and treasury both have their own owners that can update configuration (`update_staleness` and `update_spread_reduction_factor` on the oracle, `set_rate` and `withdraw` on the treasury). Those owners may be the same account, separate accounts, or a governance contract per deployment. See the dedicated [Governance](./governance/overview), [Treasury](./treasury/overview), and [Oracle](./oracle/overview) pages for the full owner-only surface on each contract.

LP deposits and redeems flow through the market contract as vault orders, not by calling the vault directly. The vault's only mutations are the strategy-gated `strategy_deposit`, `strategy_redeem`, and `strategy_withdraw`, authorized to the registered strategy (the market contract), so the market contract is the single writer of vault share supply. The market contract calls the vault through a minimal interface (`strategy_deposit`, `strategy_redeem`, `strategy_withdraw`, `total_assets`, and the share token's `transfer` for redeem escrow). The dependency is one-directional, which keeps the call graph and storage ownership easy to reason about.

Every price-bearing call verifies its price through the same `verify_price` cross-contract call, which validates the submitted Data Streams report against the market's immutable `feed_id` and returns a bid/ask pair. A `protective` flag selects the staleness class: fills use the strict trade window, while liquidation, ADL, and accrual use the wider close window. The exception is a delisted market with a stored terminal price, which prices flat and skips verification. Trader intents (`create_order`, `create_vault_order`, the cancels, `claim_credit`) carry no price at all.

The signature trust behind `verify_price` roots outside Zenex. The oracle delegates the DON signature check to Chainlink's deployed Data Streams verifier contract via `verify`, and that contract's config set and its rotation live entirely on Chainlink's side. The verifier address is pinned in the oracle's constructor with no setter, so no owner key can redirect pricing. See the [Oracle](./oracle/overview) page.

The governance contract is an independent, optional contract. It is not deployed by the factory and is not bound to any specific target. It can be set as the owner of any admin-controlled contract (market, treasury, oracle, or even a separate governance instance) and adds a configurable timelock delay to parameter changes on whatever it owns. Owner-only calls flow through `queue` then `execute`, where `execute` is itself permissionless once the delay has elapsed. The one bypass is `set_status`, which lets the governance owner immediately set the status of a target market contract without going through the queue, so a market can be frozen in an emergency without waiting for the delay.

## Token Flow

All collateral flows through a single SEP-41 token (e.g., USDC). The market contract acts as custodian for active position margin and for escrowed vault-order assets and shares. Every order and vault order also escrows a flat execution fee (`exec_fee`, a `Config` field) at creation, paid to the keeper at fill and refunded on cancel. Protocol fees (trade, impact, borrowing, liquidation) are debited from the position's margin inside the market contract, rather than charged on top of the posted amount, and split between the vault, the treasury, and the keeper. Funding is likewise debited from margin but flows into an internal credit pool credited to the opposing side, paid out through `claim_credit`. The same pool pays out any position payout whose direct token transfer failed, which the market parks as claimable credit.

| Flow | Direction | When |
|---|---|---|
| Trader to Market | Escrowed margin plus exec fee (increase) or exec fee only (decrease) | `create_order` |
| LP Depositor to Market | Escrowed deposit assets or redeem shares, plus exec fee | `create_vault_order` |
| Market to Vault | LP share of fees (trade, impact, borrowing, liquidation), trader losses, and deposit-fill principal (`strategy_deposit`) | Fills, liquidations, deposit fills |
| Market to Treasury | Protocol share of trade, impact, liquidation, borrowing, and vault fill fees | Fills, liquidations, vault-order fills |
| Market to Keeper | Keeper reward: a cut of the trade or vault fill fee, plus the order's escrowed exec fee on order and vault-order fills (liquidation and ADL pay the fee cut only) | Order, liquidation, ADL, and vault-order fills |
| Vault to Market | Trader profit payout, bad-debt coverage (`strategy_withdraw`), and redeem-fill assets (`strategy_redeem`) | Profitable or underwater closes, redeem fills |
| Market to Trader | Withdrawal, realized profit, credit claim, liquidation remainder, or trade-order escrow refund | Decrease fills, `claim_credit`, liquidations, `cancel_order` |
| Market to LP Depositor | Redeem payout or vault-order escrow refund | Redeem fills, `cancel_vault_order` |
| Treasury to Recipient | Protocol revenue withdrawal (destination chosen by owner) | `withdraw` (owner-only) |

Every order escrows at creation: an increase order transfers `margin + exec_fee` from the trader to the market contract when `create_order` runs, a decrease order transfers `exec_fee`, and a vault order transfers the LP depositor's assets (or redeem shares) plus `exec_fee`. Cancelling refunds the escrow. Fees are deducted from the escrowed margin at fill and the resulting margin must still meet the initial-margin requirement, so a fee change between creation and fill at worst makes the fill revert instead of leaving the position under-margined.

## Deployment Model

The factory deploys a market contract and its strategy vault as an atomic pair with deterministic, precomputed addresses. Each contract's wiring (dependency addresses, ownership, the immutable feed anchor, the full market config, vault share metadata) is set in its constructor, so neither needs a separate `initialize` call. Because one contract is one market, deployment itself is the market's registration: its parameters are the `Config` passed to `deploy`, and the feed is the `feed_id` stream anchor.

The initial `Config` is a constructor argument, so it takes effect at deployment regardless of who the owner is. Subsequent parameter changes go through the owner, and through the timelock when the owner is a governance contract.

Implementation detail (salt derivation, deploy ordering, address precomputation) lives on the [Factory](./factory/overview) page.
