---
sidebar_position: 1
title: Contract Addresses
---

# Contract Addresses

Zenex contracts are deployed through the factory contract, which deterministically computes addresses for each market and vault pair. This means that given the same admin address and salt, the resulting contract addresses are predictable before the deployment transaction is submitted. Integrators can verify any market contract's legitimacy by calling `is_deployed` on the factory, which returns `true` for every market contract address the factory has deployed.

## Address Derivation

The factory uses Soroban's `with_address` deployer to precompute both the trading and vault addresses before either contract is instantiated. Each address is derived from the admin's address and a salt, not from the factory contract itself, so the same admin and salt always produce the same pair of addresses regardless of which factory instance is asked to deploy them. Soroban also requires the address passed to `with_address` to authorize the call, so the admin's own signature is what unlocks a deployment at a given address. A salt alone cannot be front-run by another caller. The caller supplies a 32-byte salt for the market address, and the vault address derives from the hash of that salt with a fixed suffix appended, so one salt deterministically yields both addresses. The exact derivation is documented on the [technical factory page](/technical/factory/overview).

The WASM hashes a factory installs are stored in its instance storage and replaceable only by the factory owner through `set_init_meta`, so every pair deployed between two `set_init_meta` calls runs identical contract code, and the factory's `get_init_meta` view always shows what a deploy would install today.

## Testnet

The following contracts are deployed on Stellar testnet (`https://soroban-testnet.stellar.org`).

| Contract | Address | Notes |
|---|---|---|
| Factory | `CCG4O646VGQOBXSGQAAPU4HXWUMWT3YNRZ4NJR72HSZZMWERARKEJURC` | Canonical deployment registry |
| Oracle | `CBWUFUXRJB2NCG3R2GPFVUO7LDMZUG4V6DYLQ6MJU5HKUMTY4EOCQ32Z` | Price-report verification, shared by markets |
| Treasury | `CDVQTOBIHL6CGFL62ADIQ3CRTWHD6EGY4XXJRGTLBIG7GILGHJDUHDVS` | Protocol fee accumulator |
| Market Router | `CB3NF5SVBKKE4LNUUUPT35OZAG4UOVWCSCWDY3MXBRS6YK5742EYHYWS` | Stateless call router for batched and atomic flows |
| Referral | `CAVUAS7CMIXOUXFND77EDNB5OOWBAM4AOAGV4NF6D4JQXAZAAERQDJQQ` | On-chain referral attribution |
| Governance | Not deployed | Timelock that queues and executes owner actions after a delay. Not part of the current testnet deployment. |

The settlement token is testnet **USDC** (`USDC:GCLSQU55UGBZQITOD4JFGEMIFAAUZSHZ6V2BK7BQNZ2F76V5KNXLOUGC`), Stellar Asset Contract `CD4MP2QV4LABFU5OL6Y5RICCLQIX7TWT6T6J546EDYVUXHH6RS2V5S2O`.

One market is currently deployed:

| Market | Market contract | Strategy vault |
|---|---|---|
| XLM-USD | `CA2NCUEHBP7BOIIUVN6QGWUKZVT6F3EGH77DALC67OMJXTAHQVVQ7YSX` | `CCMYTLDMTWQMIIG6N4KT22F33RYKVLMVE3WL2OLABN5NZE6JFCJGLR7O` |

Its price stream is the Chainlink Data Streams XLM/USD feed, id `0x000358cb12b1f5bbeca8b5b4666025a40b15520af1f82516ee2fb9a335055e9a` (also readable from the market's `get_feed`). The oracle's staleness windows are set to 10 seconds (trade) and 60 seconds (close) on this deployment.

## Mainnet

Mainnet deployment details will be added after launch. The same factory-based deployment model will be used, and addresses will be deterministic given the admin address and salt used for each deployment.

## Verifying Deployed Contracts

The factory serves as the canonical registry for all legitimately deployed market contracts. To verify that a given address is an authentic Zenex market contract, call the factory's `is_deployed` function with the market address. It returns `true` if the address was deployed through that factory instance and `false` otherwise. Only market contract addresses are registered in the factory. Vault addresses are not tracked directly, but each market contract stores its paired vault address, readable through the market contract's `get_vault` function.

Discovery of deployed pools relies on indexing the `Deploy` events emitted by the factory at deployment time, since the factory contract itself exposes no enumeration function to list them.

## Code Upgrades

Three contracts are upgradeable, each by its own owner: the **market**, the **oracle**, and the **factory** expose an owner-gated `upgrade` that replaces the WASM in place while preserving storage. Pointing an owner at the governance timelock makes every upgrade inherit its delay.

The rest are deliberately immutable. The **strategy vault** is gated entirely by its market contract, so a vault defect is contained by freezing the market and winding it down rather than by replacing vault code under live collateral. The **treasury** is redeployable, the **market router** is stateless and holds nothing, and the **governance** contract is the upgrade authority itself, so it stays a fixed root of trust.

The WASM hashes a factory installs for *new* markets live in its instance storage, not in its code: after a market or vault upgrade, the factory owner updates them through `set_init_meta` so new deployments do not ship superseded code. Already-deployed pairs are unaffected — each market's own owner holds its upgrade authority from birth.
