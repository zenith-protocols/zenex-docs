---
sidebar_position: 12
title: Treasury
---

# Treasury

The treasury is a fee accumulator with a configurable rate. It implements [OpenZeppelin Ownable](https://github.com/OpenZeppelin/stellar-contracts/tree/main/contracts/access) for access control. For standard Ownable behavior (`transfer_ownership`, `renounce_ownership`), refer to the OZ documentation.

## Constructor

`__constructor(owner: Address, rate: i128)`

Sets the OZ Ownable owner and the initial fee rate. No validation is performed on the rate value.

## Fee Rate

`get_rate() -> i128` is permissionless. It returns the current fee rate in SCALAR_7 precision, defaulting to `0` if unset.

`set_rate(rate: i128)` is owner-only (`#[only_owner]`). There is no upper-bound validation. A rate of `SCALAR_7` (10,000,000) represents 100% of trading fees going to the protocol.

The trading contract calls `get_rate()` on every trade to compute the protocol fee:

$$
\text{protocol\_fee} = \text{total\_fee} \times \frac{\text{rate}}{\text{SCALAR\_7}}
$$

## Fee Collection

The treasury is a passive receiver. The trading contract pushes fees to the treasury address via standard token transfers. The treasury contract does not pull fees or track per-token accounting.

## Withdrawal

`withdraw(token: Address, to: Address, amount: i128)` is owner-only. It can withdraw any SEP-41 token held by the treasury. There is no per-token accounting or whitelist.

## Upgradeability

The contract derives `#[derive(Upgradeable)]` from OpenZeppelin `stellar-macros`. The `upgrade(new_wasm_hash)` function requires owner authorization.

## Storage

The treasury uses only instance storage (30-day TTL):

| Key | Type | Description |
|---|---|---|
| `"Rate"` | `i128` | Protocol fee rate (SCALAR_7) |
| OZ Ownable | `Address` | Owner address (managed internally) |

## Immutability in Trading

The treasury address is set in the trading contract's constructor and stored in instance storage with no setter. Once deployed, the trading contract always sends protocol fees to the same treasury. Changing the treasury requires redeploying the trading contract.
