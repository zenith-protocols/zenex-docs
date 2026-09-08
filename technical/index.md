---
sidebar_position: 1
title: Architecture overview
---

# Architecture overview

Zenex is a perpetual futures protocol of seven Soroban contract types. One market contract and one strategy vault are deployed together, and that pair is one market. The vault holds the market contract as its immutable strategy. The market contract holds the vault, the oracle, the treasury, the settlement token, and the price stream `feed_id`. Its constructor sets all five, and none of them changes after that. The market contract prices against that `feed_id` through the oracle it names at deploy. The oracle and the router keep no per-market state, so one instance of each can serve every market. The factory writes one treasury address into every market it deploys, and its owner can replace that address for later deploys. Each contract type has its own section in this tree, with its entry points, its errors, and the storage, events, and formulas it has. Two pages cover what the contracts share. [Units and scales](/technical/units) states the scale conventions every other page uses. [Ownership and upgrade](/technical/ownership) states the owner surface of the market, oracle, factory, treasury, and governance contracts, and the upgrade path.

## Contracts

| Contract | Type | What it does |
|---|---|---|
| [Market contract](/technical/market/overview) | `MarketContract` | Takes orders and holds one position per account and side. Settles profit and loss, and charges fees, funding, and borrowing. Runs liquidation and auto-deleveraging. Also takes the deposit and redemption orders for its strategy vault. Holds the posted margin of every position and the escrow of every pending order. |
| [Strategy vault](/technical/vault/overview) | `StrategyVaultContract` | Holds the liquidity that backs every position in its market. Mints its share token on a deposit and burns it on a redemption, on the market's call. |
| [Oracle](/technical/oracle/overview) | `Oracle` | Passes a signed Chainlink Data Streams report to Chainlink's verifier, then applies the protocol gates. A report that is already verified and still in the memo skips the verifier call, and the gates run on the stored body. Returns a bid, an ask, and a publish time for one stream, after spread reduction. |
| [Market router](/technical/router/overview) | `RouterContract` | Runs several calls in one transaction. In the create-and-fill flows it fills the order that the first call created, and the try variants leave that order resting when the fill fails. Can collect a fee in a token from the `user` that signed the batch, so another account can submit it. |
| [Factory](/technical/factory/overview) | `FactoryContract` | Deploys one market contract and one strategy vault in one call. The market address derives from the authorizing `admin` and the salt it passes, and the vault address derives from `admin` and a second salt computed from the first. `admin` becomes the owner of the new market contract. |
| [Treasury](/technical/treasury/overview) | `TreasuryContract` | Holds the protocol fee rate and the fees the market sends to it. |
| [Governance](/technical/governance/overview) | `GovernanceContract` | A timelock. Its own owner queues a call, and any account executes it after the delay. The owner also sets a market's status at once, with no delay. |
