---
sidebar_position: 2
title: Deployment Parameters
---

# Deployment Parameters

Every Zenex deployment is configured through a set of constructor parameters that define the protocol's fee structure, risk limits, oracle settings, and vault behavior. Each deployment keeps a reviewed record of these values, and before executing any deployment operators must confirm that every value is correct: fee rates, leverage limits, and market parameters are critical to protocol safety and should be verified every time. The deployed values are always readable back from the contracts themselves, which are the source of truth.

## Factory

The factory is the entry point for deploying new market and vault pairs. Its constructor takes an `owner` address and a `FactoryInitMeta` struct.

| Parameter | Type | Description |
|---|---|---|
| `owner` | `Address` | Admin for `set_init_meta` and the factory's own `upgrade`, and nothing else |
| `market_hash` | `BytesN<32>` | Compiled WASM hash for market contracts |
| `vault_hash` | `BytesN<32>` | Compiled WASM hash for vault contracts |
| `treasury` | `Address` | Protocol-wide treasury contract address |

The three `FactoryInitMeta` values determine what future deploys install: which contract code every new pair will run and where its protocol fees are routed. The factory owner can replace them at any time through `set_init_meta`, which affects only deployments made after the change; already-deployed pairs keep their code and treasury wiring. `get_init_meta` returns the current values.

## Market Contract

The market contract is deployed through the factory's `deploy` function, which passes the following parameters to the market constructor.

| Parameter | Type | Description |
|---|---|---|
| `owner` | `Address` | Admin address with permission to configure the market, set its status and terminal price, and upgrade the contract |
| `token` | `Address` | SEP-41 collateral token (e.g., USDC) |
| `vault` | `Address` | Paired strategy vault (precomputed by factory) |
| `oracle` | `Address` | Price-verification contract for the market |
| `treasury` | `Address` | Protocol treasury (inherited from factory) |
| `feed_id` | `BytesN<32>` | Price-stream id for the market, immutable for the life of the contract |
| `config` | `Config` | Global market configuration (see below) |

The `oracle` address and `feed_id` anchor the contract to one verifier and one stream for good. There is no function to change either after deployment. A different feed means a fresh market contract.

## Trading Configuration

The `Config` struct carries the fee, sizing, risk, and vault-order parameters that govern a single market. It is set at construction and can later be replaced wholesale by the owner, subject to the same validation bounds described below. A change to any borrowing or funding rate parameter additionally requires an accrual in the same ledger.

### Sizing and Fees

| Field | Scale | Bounds | Description |
|---|---|---|---|
| `keeper_rate` | SCALAR_18 | 0 to `MAX_KEEPER_RATE` (50%) | Keeper's share of trade fees and vault-order fill fees |
| `min_position_notional` | token-dec | greater than 0, less than `max_position_notional` | Minimum notional size per position |
| `max_position_notional` | token-dec | greater than `min_position_notional`, at most `max_open_interest` | Maximum notional size per position |
| `max_open_interest` | token-dec | at least `max_position_notional` | Per-side open-interest ceiling across all positions on that side |
| `min_order_notional` | token-dec | greater than 0, at most `min_position_notional` | Minimum absolute notional per order, a dust floor sized so a full position can still close in a single order |
| `min_order_margin` | token-dec | greater than 0 | Minimum absolute collateral per order, a dust floor |
| `exec_fee` | token-dec | at least 0, at most `min_order_margin` | Flat keeper execution fee escrowed with every trade and vault order at creation, paid to the keeper on fill and refunded on cancel, including the auto-cancel of resting decrease orders when a position fully closes |
| `fee_dom` | SCALAR_18 | 0 to `MAX_FEE_RATE` (1%), at least `fee_non_dom` | Trade fee charged to the dominant side |
| `fee_non_dom` | SCALAR_18 | 0 to `MAX_FEE_RATE` (1%) | Trade fee charged to the non-dominant side |
| `impact_scalar` | token-dec | at least 1000 times `min_position_notional` | Sets the size-quadratic price-impact fee: a fill pays its size squared divided by the scalar, at a rate capped at 10% of the fill |

### Utilization Caps

Utilization is measured per side: each side's reserved open interest against half the vault balance. Opens are blocked once either side's utilization would exceed `max_util_open`, and the same half-vault capacity is the denominator of that side's borrowing curve.

| Field | Scale | Bounds | Description |
|---|---|---|---|
| `max_util_open` | SCALAR_18 | greater than 0, at most `MAX_UTIL` (1000%) | Opens are blocked once either side's utilization would exceed this cap. Also sets the per-side borrow-reserve denominator used by the borrowing curve |
| `max_util_withdraw` | SCALAR_18 | at least `max_util_open`, at most `MAX_UTIL` (1000%) | Redeem fills are blocked once either side's utilization exceeds this higher cap, holding a buffer of vault liquidity above the open cap |

### Margin and Liquidation

| Field | Scale | Bounds | Description |
|---|---|---|---|
| `init_margin` | SCALAR_18 | `MIN_MARGIN` (0.1%) to `MAX_MARGIN` (50%), and above `maintenance_margin` plus `fee_non_dom` plus `MIN_CHUNK_IMPACT_CAP` (0.1%) so a fresh minimum-size position is never born liquidatable | Initial margin requirement. Maximum leverage is 1 divided by `init_margin` |
| `maintenance_margin` | SCALAR_18 | greater than `liq_fee`, less than `init_margin` | Maintenance margin floor. A position becomes liquidatable once its equity falls below this fraction of notional |
| `liq_fee` | SCALAR_18 | 0 to `MAX_LIQ_FEE` (25%), less than `maintenance_margin` | Liquidation fee rate on the closed notional, charged on every liquidation and capped at the equity left after the close's other costs |

### Position Lifecycle

| Field | Scale | Bounds | Description |
|---|---|---|---|
| `notional_lock` | seconds | `MIN_NOTIONAL_LOCK` (15s) to `MAX_NOTIONAL_LOCK` (1 day) | Decrease lock on newly added notional. The floor matches the oracle's ceiling on the strict fill window, so an accepted price can never open and close the same size |

### Borrowing

Borrowing follows a kink model over reserve utilization: a flat slope below the kink, a steeper one above it.

| Field | Scale | Bounds | Description |
|---|---|---|---|
| `target_util` | SCALAR_18 | 0 to just under 100% | Kink utilization on the normalized reserve curve where the borrowing-rate slope steepens |
| `borrow_rate` | SCALAR_18, per second | 0 to `increased_borrow_rate` | Borrowing-rate slope below the kink |
| `increased_borrow_rate` | SCALAR_18, per second | `borrow_rate` to `MAX_BORROW_RATE` (1000% APR) | Borrowing rate at full utilization |

### Funding

Funding follows a velocity model: the rate accelerates as the skew between long and short open interest widens, and decays back once the skew narrows. See [funding rate](../trading/funding-rate.md) for the mechanics.

| Field | Scale | Bounds | Description |
|---|---|---|---|
| `funding_increase` | SCALAR_18, per second squared | 0 to `MAX_FUNDING_RATE` | Velocity acceleration as the skew widens |
| `funding_decrease` | SCALAR_18, per second squared | 0 to `MAX_FUNDING_RATE` | Velocity decay once the skew sits inside the decay band |
| `threshold_stable_funding` | SCALAR_18 | 0 to 100% | Skew band within which the funding rate holds steady |
| `threshold_decrease_funding` | SCALAR_18 | 0 to `threshold_stable_funding` | Skew band within which the funding rate decays back toward zero |
| `funding_min` | SCALAR_18, per second | 0 to `funding_max` | Floor on the rate actually charged |
| `funding_max` | SCALAR_18, per second | `funding_min` to `MAX_FUNDING_RATE` (1000% APR) | Hard cap on the funding rate |

### Risk and Auto-Deleveraging

Every rung below is a side's pending PnL measured as a fraction of half the vault balance. See [auto-deleveraging](../trading/adl.md) for the mechanics.

| Field | Scale | Bounds | Description |
|---|---|---|---|
| `adl_max_pnl` | SCALAR_18 | `MIN_ADL_TRIGGER` (45%) to `max_pnl_trader`, under 100% | Threshold that arms auto-deleveraging for the crowded side |
| `adl_clear_target` | SCALAR_18 | `MIN_ADL_CLEAR` (40%) to `adl_max_pnl` | Target that auto-deleveraging closes positions down to once armed |
| `max_pnl_trader` | SCALAR_18 | at least `adl_max_pnl`, under 100% | Realized-profit haircut threshold. While a side's pending PnL exceeds this fraction, close payouts on that side scale down proportionally. Also caps each side's pending profit in the net PnL used to price vault shares |

### Vault Orders

A deposit order fills as soon as a keeper submits a verified price published at or after the order's creation, in a strictly later ledger, subject to the order's own `min_out` bound, the `min_deposit` floor at creation, and the `max_vault_balance` ceiling. Only the redeem side has a cooldown, and redeem fills are additionally gated on pending trader PnL, with each side's pending profit measured against half the post-redeem vault balance. See [providing liquidity](../vault/depositing.md) for the mechanics.

| Field | Scale | Bounds | Description |
|---|---|---|---|
| `redeem_lock` | seconds | 0 to `MAX_REDEEM_LOCK` (30 days) | Cooldown from a vault order's creation before a redeem can fill |
| `deposit_fee` | SCALAR_18 | 0 to `MAX_FEE_RATE` (1%) | Fee charged on deposit fills, taken from the assets moved |
| `redeem_fee` | SCALAR_18 | 0 to `MAX_FEE_RATE` (1%) | Fee charged on redeem fills, taken from the proceeds |
| `min_deposit` | token-dec | greater than 0, at most `max_vault_balance` divided by 100 | Minimum assets per deposit order, enforced at creation. Redeems have no minimum amount |
| `max_pnl_withdraw` | SCALAR_18 | greater than 0, at most `adl_max_pnl` | Redeem fills are blocked while either side's pending PnL exceeds this fraction of half the post-redeem vault balance |
| `max_vault_balance` | token-dec | greater than 0, at least `min_deposit` times 100 | Vault balance ceiling enforced on deposit fills |

A configuration that violates any bound, or that gets the relative ordering between two fields wrong (such as `fee_dom` below `fee_non_dom`, or `min_position_notional` above `max_position_notional`), is rejected at construction and on every later `set_config` call.

## Strategy Vault

The vault is also deployed through the factory, receiving its parameters from the same `deploy` call.

| Parameter | Type | Description |
|---|---|---|
| `name` | `String` | Vault share token name (e.g., "Zenex USDC Vault") |
| `symbol` | `String` | Vault share token symbol (e.g., "zUSDC") |
| `asset` | `Address` | Underlying collateral token (same as the market contract's `token`) |
| `decimals_offset` | `u32` | Extra share-token decimals on top of the asset's own decimals, hardening the share price against donation-based inflation attacks. Capped at 10 by the token library |
| `strategy` | `Address` | Authorized market contract (precomputed by factory) |

The `strategy` parameter is the only address authorized to call the vault's `strategy_deposit`, `strategy_redeem`, and `strategy_withdraw` entry points. It is set to the precomputed market contract address, which the factory calculates before either contract exists. LP sizing rules, including the minimum deposit amount, the redeem cooldown, and the vault-order fee, are not vault constructor parameters. They live on the market contract's `Config` and are documented above under Vault Orders.

## Oracle

The oracle is deployed independently (not through the factory) and can be shared across multiple market contracts.

| Parameter | Type | Description |
|---|---|---|
| `owner` | `Address` | Admin for the staleness windows, the spread reduction, and the oracle's own upgrade, and nothing else |
| `verifier` | `Address` | Deployed Chainlink Data Streams verifier holding the publisher signer set. Immutable, with no setter |
| `trade_staleness` | `u64` | Maximum observation age for order and vault-order fills, in seconds. From 3 to 15; 10 on the current testnet deployment |
| `close_staleness` | `u64` | Maximum observation age for liquidations, ADL, and accrual, in seconds. At least `trade_staleness`, at most 120; 60 on the current testnet deployment |
| `spread_reduction_factor` | `i128` (SCALAR_18) | Fraction of the half-spread trimmed off each side of the report's bid and ask, 0 to 100% |

Signature verification is delegated entirely to the `verifier` contract, which checks a report against its own signer set and returns the verified body. The oracle decodes that body and enforces every protocol gate on it: the stream id must match the market's anchor, the report must not have expired, its observation must sit inside the window for the call, and its bid and ask must be positive and uncrossed. The wider close window is what lets a liquidation or an accrual land during a feed gap while fills stay on the strict window. The exact bounds and checks are in the [technical reference](/technical/oracle/overview).

## Treasury

The treasury is also deployed independently and referenced by the factory.

| Parameter | Type | Description |
|---|---|---|
| `owner` | `Address` | Admin with permission to adjust rate and withdraw funds |
| `rate` | `i128` (SCALAR_18) | Fraction of protocol fees directed to treasury, bounded to 0 to 50% |

The treasury rate determines what percentage of protocol revenue (base fees, impact fees, borrowing fees, liquidation fees, and vault-order fill fees) is retained by the protocol versus flowing to vault depositors. A rate of `100_000_000_000_000_000` (10% in SCALAR_18) means the treasury keeps 10% of all protocol fees. This rate can be adjusted after deployment by the treasury owner via `set_rate`.

## Governance

The governance contract is an optional timelock proxy deployed independently and assigned as the owner of a market contract.

| Parameter | Type | Description |
|---|---|---|
| `owner` | `Address` | Admin who can queue parameter changes |
| `delay` | `u64` | Minimum seconds between queuing and executing a change |

The `delay` must be non-zero and at most 60 days (`60 * 24 * 3600` seconds). Values outside this range cause the constructor to panic. The delay can be changed after deployment via `set_delay`, and the new value takes effect only after the current delay has elapsed, so the timelock cannot be shortened instantly.

The delay parameter enforces a timelock on all configuration updates. When the owner queues a parameter change (such as updating `Config`), it specifies the target contract address at call time. The change cannot be executed until `delay` seconds have passed. This gives traders and LPs time to react to upcoming parameter changes. `set_status` is exempt from the timelock, allowing immediate emergency pauses.

## Circular Dependency Resolution

The factory resolves a fundamental circular dependency between the market contract and the vault. The market contract needs the vault address at construction (to call `total_assets` and `strategy_withdraw`), while the vault needs the market address at construction (to authorize `strategy_withdraw` calls from the market contract).

The factory solves this by precomputing both addresses using deterministic salt derivation before deploying either contract. The vault is deployed first with the precomputed market address as its `strategy`. The market contract is deployed second with the precomputed vault address. No post-deployment linking or initialization step is required. Both contracts are fully configured from the moment they are instantiated.
