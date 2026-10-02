---
sidebar_position: 6
title: Agent wallet
---

# Agent wallet

An automated integrator currently operates its own normal Stellar Ed25519 wallet. It generates and securely stores its keypair, then creates and funds its own G-account.

On testnet, the integrator also establishes the asset balances and trustlines its workflow needs. It signs its own authorization entries and transactions, and pays its own network costs.

Never send the account's S-seed to Zenex. Keep that secret in the integrator's own secure key-management system.

## Deployment boundary

Relay-subsidized account creation is passkey-only. Zenex does not offer Ed25519 smart-account deployment or an x402 deployment endpoint. An automated integrator using an Ed25519 keypair should create, fund, and operate its own Stellar account.
