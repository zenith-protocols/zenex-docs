---
sidebar_position: 1
title: Governance Overview
---

# Governance Overview

Zenex is a protocol primitive. Anyone can deploy a trading contract and its strategy vault through the factory, and each deployment has its own owner who controls its parameters. There is no single "Zenex exchange" with a fixed governance structure. Because each market is a standalone trading contract, governance is per market: how a given market is run depends entirely on who owns that contract and the trust model they choose.

## Ownership

Every trading contract has an owner, set at deployment time. The owner can update that market's configuration, change its operational status, and set a terminal settlement price when winding the market down. Ownership can be held by a single address, a multisig, a governance contract, or any other on-chain entity, and it can be transferred through a two-step transfer-and-accept process. Because each market is its own standalone contract, an owner governs one market at a time.

## What the Owner Controls

The owner acts through three entry points on the trading contract:

- **Configuration** (`set_config`): replaces the market's [Config](../markets/market-parameters.md), the full set of fees, margins, leverage cap, utilization caps, and interest curves. A change to the borrowing parameters must be paired with a same-ledger interest accrual, so the switch to new rates never skips or double-counts accrued interest.
- **Status** (`set_status`): moves the market through its [lifecycle](../markets/overview.md) states (Active, OnIce, Frozen, Delisted, Retired). Retiring a market sweeps its funding-pool surplus into the vault and requires that all positions are already closed.
- **Terminal price** (`set_terminal_price`): sets or refreshes the flat settlement price of a delisted market, used to wind down any remaining positions after the delist grace window.

## Optional Timelock

Zenex provides an optional governance contract that adds a timelock to configuration changes. When used, a change must be queued on-chain and a mandatory delay must pass before it can take effect. This is covered in detail on the [Parameter Changes](./parameter-changes.md) page. Using the timelock is optional: the choice of governance model is up to whoever owns the market.

## Emergency Status

Regardless of whether a timelock is used, the market's status can always be changed immediately. This means the owner (or the governance contract owner) can pause new position openings, freeze all trading activity, or restore normal operations without delay. This emergency power is deliberately narrow: it applies only to the status, not to fee rates, margin requirements, or any other financial parameter.

## Immutable Addresses

Certain core addresses are set at construction and cannot be changed by anyone after deployment. The vault, the price verifier, the treasury, and the oracle feed (its `feed_id` and `exponent`) are fixed for the lifetime of the trading contract. The contract itself has no upgrade path: shipping a logic change means deploying a fresh trading and vault pair through the factory. This guarantees that where liquidity is held, how prices are verified, where fees flow, and which asset the market prices cannot be altered after the fact.
