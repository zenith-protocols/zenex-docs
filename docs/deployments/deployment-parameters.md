---
sidebar_position: 2
title: Deployment Parameters
---

# Deployment Parameters

Every Zenex deployment is configured through a set of constructor parameters that define the protocol's fee structure, risk limits, oracle settings, and vault behavior. These parameters are typically defined in `zenex-utils/deploy.json`, which serves as the single source of truth for deployment configuration. Before executing any deployment, operators must review the contents of this file and confirm that all values are correct. Fee rates, leverage limits, and market parameters are critical to protocol safety and should be verified every time.

## Factory

The factory is the entry point for deploying new trading and vault pairs. Its constructor accepts a single `FactoryInitMeta` struct.

| Parameter | Type | Description |
|---|---|---|
| `trading_hash` | `BytesN<32>` | Compiled WASM hash for trading contracts |
| `vault_hash` | `BytesN<32>` | Compiled WASM hash for vault contracts |
| `treasury` | `Address` | Protocol-wide treasury contract address |

These values are immutable after construction. The WASM hashes determine which contract code every pool will run. The treasury address determines where protocol fees are routed. Changing any of these requires deploying a new factory entirely.

## Trading Contract

The trading contract is deployed through the factory's `deploy` function, which passes the following parameters to the trading constructor.

| Parameter | Type | Description |
|---|---|---|
| `owner` | `Address` | Admin address with permission to configure markets and parameters |
| `token` | `Address` | SEP-41 collateral token (e.g., USDC) |
| `vault` | `Address` | Paired strategy vault (precomputed by factory) |
| `price_verifier` | `Address` | Pyth Lazer price verification contract |
| `treasury` | `Address` | Protocol treasury (inherited from factory) |
| `feed_id` | `u32` | Pyth Lazer feed id for the market, immutable for the life of the contract |
| `exponent` | `i32` | Price exponent for the feed, immutable, sets `price_scalar = 10^-exponent` |
| `config` | `Config` | Global trading configuration (see below) |

`feed_id` and `exponent` anchor the contract to a single oracle feed and its precision for good. There is no function to change either after deployment. A new feed or a re-scaled exponent means a fresh trading contract.

## Trading Configuration

The `Config` struct carries the fee, sizing, risk, and vault-order parameters that govern a single market. It is set at construction and can later be replaced wholesale by the owner, subject to the same validation bounds described below. A borrowing-parameter change additionally requires a borrowing accrual in the same ledger, and a funding-parameter change first settles funding under the outgoing parameters.

### Sizing and Fees

| Field | Scale | Bounds | Description |
|---|---|---|---|
| `keeper_rate` | SCALAR_18 | 0 to `MAX_KEEPER_RATE` (50%) | Keeper's share of trade fees and vault-order fill fees |
| `min_position_notional` | token-dec | greater than 0, less than `max_position_notional` | Minimum notional size per position |
| `max_position_notional` | token-dec | greater than `min_position_notional`, at most `max_open_interest` | Maximum notional size per position |
| `max_open_interest` | token-dec | at least `max_position_notional` | Per-side open-interest ceiling across all positions on that side |
| `min_order_notional` | token-dec | greater than 0, at most `min_position_notional` | Minimum absolute notional per order, a dust floor sized so a full position can still close in a single order |
| `min_order_collateral` | token-dec | greater than 0 | Minimum absolute collateral per order, a dust floor |
| `fee_dom` | SCALAR_18 | 0 to `MAX_FEE_RATE` (1%), at least `fee_non_dom` | Trade fee charged to the dominant side |
| `fee_non_dom` | SCALAR_18 | 0 to `MAX_FEE_RATE` (1%) | Trade fee charged to the non-dominant side |
| `impact_divisor` | SCALAR_18 | at least `MIN_IMPACT` (a divisor of 10) | Sets the price-impact fee on the worsening leg of a trade. The floor caps the impact fee at 10% of notional |

### Utilization Caps

Utilization is open interest divided by vault balance.

| Field | Scale | Bounds | Description |
|---|---|---|---|
| `max_util_open` | SCALAR_18 | greater than 0, at most `MAX_UTIL` (1000%) | Opens are blocked once utilization would exceed this cap. Also sets the borrow-reserve denominator used by the borrowing curve |
| `max_util_withdraw` | SCALAR_18 | at least `max_util_open`, at most `MAX_UTIL` (1000%) | Vault-order withdrawals are blocked once utilization exceeds this higher cap, holding a buffer of vault liquidity above the open cap |

### Margin and Liquidation

| Field | Scale | Bounds | Description |
|---|---|---|---|
| `init_margin` | SCALAR_18 | `MIN_MARGIN` (0.1%) to `MAX_MARGIN` (50%), greater than `maintenance_margin` | Initial margin requirement. Maximum leverage is 1 divided by `init_margin` |
| `maintenance_margin` | SCALAR_18 | greater than `liq_fee`, less than `init_margin` | Maintenance margin floor. A position is liquidated once its margin falls to this level |
| `liq_fee` | SCALAR_18 | 0 to `MAX_LIQ_FEE` (25%), less than `maintenance_margin` | Fee charged on liquidation |

### Position Lifecycle

| Field | Scale | Bounds | Description |
|---|---|---|---|
| `notional_lock` | seconds | `MIN_NOTIONAL_LOCK` (15s) to `MAX_NOTIONAL_LOCK` (1 day) | Decrease lock on newly added notional. The floor matches the price verifier's maximum staleness, so an accepted stale price can never open and close the same size |

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
| `max_pnl_trader` | SCALAR_18 | at least `adl_max_pnl`, under 100% | Realized-profit haircut threshold. While a side's pending PnL exceeds this fraction, close payouts on that side scale down proportionally |

### Vault Orders

Every rung below is measured against net pending trader PnL as a fraction of the vault balance (the pre-fill balance for the deposit gates, the post-redeem balance for the redeem gate). See [providing liquidity](../vault/depositing.md) for the mechanics.

| Field | Scale | Bounds | Description |
|---|---|---|---|
| `redeem_lock` | seconds | 0 to `MAX_REDEEM_LOCK` (30 days) | Cooldown from a vault order's creation before a redeem can fill |
| `deposit_lock` | seconds | 0 to `MAX_REDEEM_LOCK` (30 days) | Cooldown from a vault order's creation before a deposit can fill. Waived while pending trader losses sit at or under `instant_deposit_pnl` |
| `instant_deposit_pnl` | SCALAR_18 | 0 to `max_pnl_deposit` | Share underpricing at or under which a deposit fills immediately, skipping the cooldown |
| `vault_fee` | SCALAR_18 | 0 to `MAX_FEE_RATE` (1%) | Fee charged on vault-order fills, taken from the assets moved |
| `min_deposit` | token-dec | greater than 0, at most `max_vault_balance` divided by 100 | Minimum assets per vault-order fill |
| `max_pnl_deposit` | SCALAR_18 | at least `instant_deposit_pnl`, under 100% | Deposit fills are blocked while share underpricing exceeds this |
| `max_pnl_withdraw` | SCALAR_18 | 0 to under 100% | Redeem fills are blocked while share overpricing, measured against the post-redeem vault balance, exceeds this |
| `max_vault_balance` | token-dec | greater than 0, at least `min_deposit` times 100 | Vault balance ceiling enforced on deposit fills |

A configuration that violates any bound, or that gets the relative ordering between two fields wrong (such as `fee_dom` below `fee_non_dom`, or `min_position_notional` above `max_position_notional`), is rejected at construction and on every later `set_config` call.

## Strategy Vault

The vault is also deployed through the factory, receiving its parameters from the same `deploy` call.

| Parameter | Type | Description |
|---|---|---|
| `name` | `String` | Vault share token name (e.g., "Zenex USDC Vault") |
| `symbol` | `String` | Vault share token symbol (e.g., "zUSDC") |
| `asset` | `Address` | Underlying collateral token (same as trading's `token`) |
| `decimals_offset` | `u32` | Extra share-token decimals on top of the asset's own decimals, mitigating ERC-4626 inflation attacks |
| `strategy` | `Address` | Authorized trading contract (precomputed by factory) |

The `strategy` parameter is the only address authorized to call the vault's deposit, mint, withdraw, redeem, and `strategy_withdraw` entry points. It is set to the precomputed trading contract address, which the factory calculates before either contract exists. LP sizing rules, including the minimum vault-order fill amount, the deposit and redeem cooldowns, and the vault-order fee, are not vault constructor parameters. They live on the trading contract's `Config` and are documented above under Vault Orders.

## Price Verifier

The price verifier is deployed independently (not through the factory) and can be shared across multiple trading contracts.

| Parameter | Type | Description |
|---|---|---|
| `owner` | `Address` | Admin address for configuration updates |
| `lazer` | `Address` | Deployed Pyth Lazer verification contract that holds the trusted-signer set |
| `max_confidence_bps` | `u32` | Maximum allowed confidence interval in basis points |
| `max_staleness` | `u64` | Maximum age of a price update in seconds (hard cap: 15s) |

Signature verification is delegated entirely to the `lazer` contract, which checks the LE-ECDSA envelope against its own trusted-signer set and returns the verified inner payload. The price verifier only parses that payload and enforces confidence and staleness on it. The `max_confidence_bps` parameter rejects prices whose confidence interval exceeds the threshold, preventing the protocol from accepting highly uncertain oracle data. The `max_staleness` parameter rejects prices that are too old, ensuring the protocol operates on recent market data. The constructor and `update_max_staleness` both reject any value above `MAX_STALENESS_SECONDS = 15`. This cap is the floor for the trading contract's `notional_lock`, so an accepted stale price can never open and close the same size.

## Treasury

The treasury is also deployed independently and referenced by the factory.

| Parameter | Type | Description |
|---|---|---|
| `owner` | `Address` | Admin with permission to adjust rate and withdraw funds |
| `rate` | `i128` (SCALAR_18) | Fraction of protocol fees directed to treasury, bounded to 0 to 50% |

The treasury rate determines what percentage of protocol revenue (base fees, impact fees, borrowing fees, vault-order fill fees, and forfeited liquidation remainders) is retained by the protocol versus flowing to vault depositors. A rate of `100_000_000_000_000_000` (10% in SCALAR_18) means the treasury keeps 10% of all protocol fees. This rate can be adjusted after deployment by the treasury owner via `set_rate`.

## Governance

The governance contract is an optional timelock proxy deployed independently and assigned as the owner of a trading contract.

| Parameter | Type | Description |
|---|---|---|
| `owner` | `Address` | Admin who can queue parameter changes |
| `delay` | `u64` | Minimum seconds between queuing and executing a change |

The `delay` must be non-zero and at most 60 days (`60 * 24 * 3600` seconds). Values outside this range cause the constructor to panic.

The delay parameter enforces a timelock on all configuration updates. When the owner queues a parameter change (such as updating `Config`), it specifies the target contract address at call time. The change cannot be executed until `delay` seconds have passed. This gives traders and LPs time to react to upcoming parameter changes. `set_status` is exempt from the timelock, allowing immediate emergency pauses.

## Circular Dependency Resolution

The factory resolves a fundamental circular dependency between the trading contract and the vault. The trading contract needs the vault address at construction (to call `total_assets` and `strategy_withdraw`), while the vault needs the trading address at construction (to authorize `strategy_withdraw` calls from the trading contract).

The factory solves this by precomputing both addresses using deterministic salt derivation before deploying either contract. The vault is deployed first with the precomputed trading address as its `strategy`. The trading contract is deployed second with the precomputed vault address. No post-deployment linking or initialization step is required. Both contracts are fully configured from the moment they are instantiated.
