---
sidebar_position: 1
title: Contract addresses
---

# Contract addresses

This page lists the contracts of the Zenex mainnet deployment. It shows how you check where a market came from and says which contracts can change their own code. The addresses are live state, so each record carries its stack name and date. Testnet deployments are not listed here.

## The factory creates every market

The factory is the contract that creates each market together with its vault. Any account can call it, and the account that signs the call becomes the owner of the new market. The deployer chooses the market's parameters within the bounds the market accepts.

Both addresses of a pair follow from two inputs. The first is the account that owns the market. The second is a 32-byte number that the deployer picks, called the salt. The vault address comes from the same salt, so one salt fixes both addresses before either contract exists. The address of the factory takes no part in the derivation. Because the owning account must sign the deployment, no other account can deploy to an address that belongs to that account and salt. The [factory pages](/technical/factory/overview) give the exact derivation.

## Mainnet

Zenex has no mainnet deployment yet. When it launches, this section records the stack name and date, the factory, oracle, treasury, market router, referral, and governance addresses, the settlement token, the owner of each contract, and one row per market with its market contract and vault. Every market goes through the factory, so the check below applies to it from the first day.

## A factory answer shows where a market came from

To check a market, ask the factory whether it deployed that address. The factory answers yes for a market it deployed and no for any other address. It remembers each market it created, but only as a yes or no for an address you give it. It cannot give you a list of its markets, and it does not store vault addresses. To find the vault of a market, ask the market, which reports its vault address. If the factory's record of a market has expired from the ledger, the call fails instead of answering no, so a failed call proves nothing. Restoring the record makes the factory answer yes again.

To find the markets of a factory, read its deployment events from the chain. Each event names the market and the vault of one pair.

A yes shows that the factory created the pair. It does not show who owns the market, because any account can deploy through the factory. The factory installs the market and vault code, and sets the treasury, that its own owner has recorded at the moment of the deployment. That owner can replace the record at any time, and the change reaches later deployments only. **A yes therefore does not vouch for the market's rules.** The owner of the market holds them.

## Three contracts can change their own code

The owner of a market, of the oracle, and of the factory can each replace the code of that contract in place. The stored state survives the replacement. If the governance timelock owns one of them, every replacement waits out the delay of the timelock. [Governance](../governance.md) covers the timelock.

The vault, the treasury, the market router, and the governance contract have no way to replace their code. The vault answers only to its market, so the code that holds the liquidity cannot change under the providers.

A pair that is already deployed does not depend on the factory's record of code. Its own owner holds the right to replace the code of the market from the moment of the deployment.
