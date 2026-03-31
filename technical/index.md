---
slug: /technical
sidebar_position: 1
title: Architecture Overview
---

# Architecture Overview

Zenex is a leveraged perpetual futures protocol built on [Stellar Soroban](https://soroban.stellar.org/). The system consists of several smart contracts deployed atomically through a factory, interacting through well-defined interfaces.

## System Contracts

| Contract | Role |
|---|---|
| **Trading** | Core perpetual futures engine handling positions, PnL, fees, funding, liquidation, and ADL |
| **Strategy Vault** | ERC-4626 tokenized vault acting as the liquidity pool and counterparty to traders |
| **Treasury** | Protocol fee accumulator with a configurable rate |
| **Factory** | Deterministic deployer for trading + vault pairs |
| **Trading Admin** | Optional timelock proxy for governance-controlled parameter changes |
| **Price Verifier** | Pyth Lazer oracle that parses and verifies signed price updates |
| **Account** | Smart account with multi-signer support (Ed25519, WebAuthn) |

## Dependency Graph

```text
                    ┌──────────────┐
                    │   Factory    │
                    └──────┬───────┘
                           │ deploys
                ┌──────────┴──────────┐
                ▼                     ▼
        ┌──────────────┐       ┌──────────┐
        │   Trading    │       │  Vault   │
        └──────┬───────┘       └──────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌──────────┐ ┌───────────────┐
│Treasury│ │  Token   │ │Price Verifier │
└────────┘ └──────────┘ └───────────────┘


        ┌──────────────┐
        │ Trading Admin│  (optional timelock proxy)
        └──────┬───────┘
               │ owns
               ▼
        ┌──────────────┐
        │   Trading    │
        └──────────────┘
```

The vault has no knowledge of trading internals. The trading contract calls the vault through a minimal interface (`total_assets`, `strategy_withdraw`). This one-directional dependency simplifies reentrancy analysis.

The Trading Admin is an independent, optional contract. It is not deployed by the factory. When used, it acts as the owner of a trading contract, adding timelock delays to parameter changes.

## Token Flow

All collateral flows through a single SEP-41 token (e.g., USDC). The trading contract acts as custodian for active position collateral.

| Flow | Direction | When |
|---|---|---|
| User to Trading | Collateral + fees on position open | `open_market`, `place_limit` |
| Trading to Vault | Fees (minus protocol share) on every trade | Open, close, fill |
| Trading to Treasury | Protocol fee on every trade | Open, close, fill |
| Vault to Trading | Trader profit payout | `strategy_withdraw` on profitable close |
| Trading to User | Collateral + profit on close | `close_position`, keeper TP/SL |
| Trading to Keeper | Caller incentive fee | Keeper `execute` batch |

## Deployment Model

The factory deploys trading + vault pairs atomically with deterministic addresses. Both addresses are precomputed before deployment using `keccak256(salt || admin || discriminator)`. The vault is deployed first, receiving the precomputed trading address as its authorized strategy. The trading contract is deployed second, receiving the vault address. The factory then records the trading address in its registry.

This ensures neither contract requires a post-deployment initialization step. Both are fully configured at construction time.

## Technology Stack

| Component | Details |
|---|---|
| Runtime | Soroban (Stellar Protocol v25) |
| Language | Rust (`no_std`, `wasm32v1-none` target) |
| SDK | `soroban-sdk 25.0.2` |
| Math | `soroban-fixed-point-math 1.5.0` (floor/ceiling fixed-point operations) |
| Access control | [OpenZeppelin Stellar Contracts](https://github.com/OpenZeppelin/stellar-contracts) (`stellar-access`, `stellar-macros`) |
| Vault standard | OpenZeppelin `stellar-tokens` (ERC-4626 / Fungible Vault) |
| Oracle | Pyth Lazer (Ed25519-signed price feeds) |
| Precision | SCALAR_7 (`10^7`) for token amounts and ratios, SCALAR_18 (`10^18`) for funding/ADL indices |

## Compiler Settings

```toml
[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
```

`overflow-checks = true` is critical. All arithmetic overflows panic rather than wrapping, providing implicit bounds checking throughout the codebase.
