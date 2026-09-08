---
sidebar_position: 1
title: Governance Overview
---

# Governance Overview

Zenex is a protocol primitive. Anyone can deploy a market contract and its strategy vault through the factory, and each deployment has its own owner who controls its parameters. There is no single "Zenex exchange" with a fixed governance structure. Because each market is a standalone market contract, governance is per market: how a given market is run depends entirely on who owns that contract and the trust model they choose.

## Ownership

Every market contract has an owner, set at deployment time. The owner can update that market's configuration, change its operational status, set a terminal settlement price when winding the market down, and upgrade the contract's code in place. Ownership can be held by a single address, a multisig, a governance contract, or any other on-chain entity, and it can be transferred through a two-step transfer-and-accept process. Because each market is its own standalone contract, an owner governs one market at a time.

## What the Owner Controls

The owner acts through four entry points on the market contract:

- **Configuration** (`set_config`): replaces the market's [Config](../markets/market-parameters.md), the full set of fees, margins, leverage cap, utilization caps, and interest curves. A change to a borrowing or funding rate parameter must be paired with an accrual in the same ledger, so the switch to new rates never skips or double-counts what has already accrued.
- **Status** (`set_status`): moves the market through its [lifecycle](../markets/overview.md) states (Active, OnIce, Frozen, Delisted, Retired). Retiring a market sweeps its funding-pool surplus into the vault and requires that all positions are already closed.
- **Terminal price** (`set_terminal_price`): sets or refreshes the flat settlement price of a delisted market, used to wind down any remaining positions after the delist grace window.
- **Upgrade** (`upgrade`): replaces the market contract's code in place, preserving all storage. This is the heaviest power an owner holds, and placing the ownership behind the timelock makes every upgrade wait out the delay like any other queued change.

## Optional Timelock

Zenex provides an optional governance contract that adds a timelock to owner actions. When used, any change (a new configuration, a terminal price, an ownership transfer) must be queued on-chain and a mandatory delay must pass before it can be executed. This is covered in detail on the [Parameter Changes](./parameter-changes.md) page. Using the timelock is optional: the choice of governance model is up to whoever owns the market.

## Emergency Status

Status changes never wait on the timelock. The owner (or the governance contract owner) can pause new position openings, freeze all trading activity, or restore normal operations immediately, within the market's lifecycle rules: a retired market is final, and a delisted market can only return to normal operation during its grace window. This emergency power is deliberately narrow: it applies only to the status, not to fee rates, margin requirements, or any other financial parameter.

## Immutable Addresses

Certain core addresses are set at construction and cannot be changed by anyone after deployment. The vault, the oracle contract, the treasury, and the market's price feed are fixed for the lifetime of the market contract: no owner entry point exists to rewire them, so where liquidity is held, how prices are verified, where fees flow, and which asset the market prices cannot be altered after the fact. What the owner *can* change is the code itself, through the owner-gated `upgrade` — which is why who owns a market, and whether that ownership sits behind the timelock, is the first thing to check when evaluating one. The vault holding depositor collateral has no upgrade path at all.

One nuance on fees: the treasury is its own contract with its own owner. That owner sets the protocol's share of fees (bounded between 0% and 50%) and withdraws whatever the treasury has collected. The market contract reads the rate live at every settlement, so a rate change applies immediately unless the treasury itself is owned by a timelocked governance contract. The address a market pays into is fixed at deployment, but the rate it reads from that address is not.
