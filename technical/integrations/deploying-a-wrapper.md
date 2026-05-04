---
sidebar_position: 3
title: Deploying Your Wrapper
---

# Deploying Your Wrapper

This page walks through deploying a `TradingWrapper` instance you control on Stellar testnet, configuring it, and managing it over time. The same flow works for mainnet once a canonical mainnet deployment of the trading contract exists; substitute the network and trading address accordingly.

The wrapper is a small Rust crate published in the [`zenex-wrapper`](https://github.com/zenith-protocols/zenex-wrapper) repository. You do not need to fork it — the published WASM is identical for every integrator. The deployment differs only in the constructor arguments (your owner address, the trading contract address, and your initial fee rate).

## Prerequisites

You will need:

- A Stellar account on testnet with a small XLM balance to pay for deployment fees. You can fund a testnet account at [Stellar Lab](https://laboratory.stellar.org/).
- The [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli) version `25.2.0` or newer. The `stellar contract build` command requires this minimum version because the SDK uses the experimental spec-shaking feature.
- Rust 1.84 or newer with the `wasm32v1-none` target (`rustup target add wasm32v1-none`). Older Rust versions targeting `wasm32-unknown-unknown` will not work — Soroban's runtime rejects the WebAssembly features that target produces.
- The address of the Zenex trading contract you want to proxy. See [Contract Addresses](/technical/deployments/contract-addresses) for testnet and mainnet values.

## Building the WASM

Clone the wrapper repo and build it with `stellar contract build`:

```bash
git clone https://github.com/zenith-protocols/zenex-wrapper.git
cd zenex-wrapper
stellar contract build
```

The build produces `target/wasm32v1-none/release/zenex_wrapper.wasm`. Make a note of the file size — the optimized contract should be roughly `16-17 KB`. Significantly larger output suggests something is wrong with your toolchain or build profile.

You can also run the unit tests to verify the contract builds correctly in your environment:

```bash
cargo test
```

All tests should pass. The tests use a mock trading contract, so no testnet interaction is needed.

## Deploying

Upload the WASM and create a contract instance. The constructor takes three arguments: the owner address (you), the address of the Zenex trading contract you are proxying, and the initial fee rate.

```bash
# 1. Install the WASM (uploads bytecode and returns a hash)
stellar contract install \
  --source-account <YOUR_KEY> \
  --network testnet \
  --wasm target/wasm32v1-none/release/zenex_wrapper.wasm

# 2. Deploy a new instance
stellar contract deploy \
  --source-account <YOUR_KEY> \
  --network testnet \
  --wasm-hash <HASH_FROM_STEP_1> \
  -- \
  --owner <YOUR_OWNER_ADDRESS> \
  --trading <ZENEX_TRADING_ADDRESS> \
  --fee_rate 10000
```

`fee_rate` is in `SCALAR_7` fixed-point units. A value of `10_000` means `0.1%` of notional. A value of `100_000` means `1%`. A value of `0` deploys a wrapper that charges no integrator fee, useful if you want to publish your wrapper address now and switch on fees later.

The deploy command prints the new contract's address. Save it — this is what you will configure your frontend to call.

## Verifying the Deployment

Read back the wrapper's configuration to confirm everything is wired up correctly:

```bash
stellar contract invoke \
  --source-account <YOUR_KEY> \
  --network testnet \
  --id <WRAPPER_ADDRESS> \
  -- get_trading

stellar contract invoke \
  --source-account <YOUR_KEY> \
  --network testnet \
  --id <WRAPPER_ADDRESS> \
  -- get_token

stellar contract invoke \
  --source-account <YOUR_KEY> \
  --network testnet \
  --id <WRAPPER_ADDRESS> \
  -- get_fee_rate
```

`get_trading` should return the trading contract address you passed at construction. `get_token` should return the same collateral token that the trading contract uses (the wrapper reads this from the trading contract during construction, so it cannot disagree). `get_fee_rate` should return the value you passed for `fee_rate`.

You can also check ownership:

```bash
stellar contract invoke \
  --source-account <YOUR_KEY> \
  --network testnet \
  --id <WRAPPER_ADDRESS> \
  -- get_owner
```

This returns your owner address.

## Updating the Fee Rate

The owner can change the fee rate at any time:

```bash
stellar contract invoke \
  --source-account <YOUR_OWNER_KEY> \
  --network testnet \
  --id <WRAPPER_ADDRESS> \
  -- set_fee_rate \
  --rate 50000
```

The new rate applies to every subsequent transaction. A `FeeRateUpdated` event is emitted with the old and new values. Frontends should treat `get_fee_rate` as live data and re-fetch it before each user-visible quote rather than caching it.

## Withdrawing Accumulated Fees

The wrapper accumulates integrator fees in its own balance of the collateral token. To withdraw them, call `withdraw` with a destination address and an amount:

```bash
stellar contract invoke \
  --source-account <YOUR_OWNER_KEY> \
  --network testnet \
  --id <WRAPPER_ADDRESS> \
  -- withdraw \
  --to <DESTINATION_ADDRESS> \
  --amount 5000000
```

Amounts are in raw token units. For a `7-decimal` token like the testnet USDC, `5_000_000` means `0.5` USDC. You can withdraw any amount up to the wrapper's current balance, which you can read with the standard SAC `balance` call against the wrapper address. The destination can be any account or contract — typically a treasury wallet you control.

A `FeesWithdrawn` event is emitted with the destination and the amount.

## Upgrading the Wrapper

The wrapper supports owner-only upgrades. To deploy a new version of the WASM (for example, after adding a fee cap or new functionality), build the new WASM, install it, and call `upgrade`:

```bash
# Build and install the new WASM as before
stellar contract install \
  --source-account <YOUR_KEY> \
  --network testnet \
  --wasm target/wasm32v1-none/release/zenex_wrapper.wasm

# Trigger the upgrade
stellar contract invoke \
  --source-account <YOUR_OWNER_KEY> \
  --network testnet \
  --id <WRAPPER_ADDRESS> \
  -- upgrade \
  --new_wasm_hash <NEW_HASH> \
  --operator <YOUR_OWNER_ADDRESS>
```

After the upgrade, the contract continues at the same address with the same storage (trading address, fee rate, token, owner). New WASM can introduce new functions or change the behavior of existing ones, but the constructor is not re-run. Verify the upgrade by calling any new functions you have added.

## Renouncing Ownership

If you want to publish a wrapper as a final, trust-minimized contract — fees and configuration locked forever — call `renounce_ownership`:

```bash
stellar contract invoke \
  --source-account <YOUR_OWNER_KEY> \
  --network testnet \
  --id <WRAPPER_ADDRESS> \
  -- renounce_ownership
```

After renouncing, `set_fee_rate`, `withdraw`, and `upgrade` are permanently disabled. Any fees accumulated in the wrapper after that point are unrecoverable. Do not renounce ownership unless that is exactly what you want.

## Operational Recommendations

A few practices that have worked well for the Zenex frontend itself, which can be applied to any wrapper deployment:

- Hold the owner key in a hardware wallet or multi-sig. Owner privileges are equivalent to upgrade rights, so the same care that applies to upgradeable protocol contracts applies here.
- Withdraw fees on a schedule rather than continuously. Each withdrawal costs a transaction fee, so accumulating before withdrawing is more efficient.
- Watch the `FeeRateUpdated` and `FeesWithdrawn` events with your indexer. Surfacing your own fee history publicly is an easy trust signal for users.
- If you set a non-zero fee rate, display the simulated fee on every quote in your frontend before the user signs. Users who can see what they will pay before they pay it are more forgiving than users who only see it after.
