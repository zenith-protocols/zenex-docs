---
sidebar_position: 1
title: Governance Overview
---

# Governance Overview

Zenex is a protocol primitive. Anyone can deploy their own vault and trading contracts through the factory, and each deployment has its own owner who controls its parameters. There is no single "Zenex exchange" with a fixed governance structure. How a particular deployment is governed depends entirely on who owns it and what trust model they choose.

## Ownership

Every trading contract has an owner, set at deployment time. The owner can update trading parameters, add or remove markets, and change the contract status. Ownership can be held by a single address, a multisig, a governance contract, or any other on-chain entity. The owner can also transfer ownership to a different address.

## Optional Timelock

Zenex provides an optional governance contract that adds a timelock to parameter changes. When used, changes must be queued on-chain and a mandatory delay must pass before they take effect. This is covered in detail on the [Parameter Changes](./parameter-changes.md) page. The timelock is not required. The choice of governance model is up to whoever deploys the contracts.

## Emergency Status

Regardless of whether a timelock is used, the contract status can always be changed immediately. This means the owner (or the governance contract owner) can freeze new position openings, pause all trading activity, or restore normal operations without delay. This emergency power is deliberately narrow. It applies only to the contract status, not to fee rates, margin requirements, or any other financial parameter.

## Immutable Addresses

Certain core addresses are set at construction and cannot be changed by anyone after deployment. The vault address, the price verifier address, and the treasury address are fixed for the lifetime of the trading contract. This guarantees that the fundamental infrastructure of a deployment, where liquidity is held, how prices are verified, and where fees flow, cannot be altered after the fact.
