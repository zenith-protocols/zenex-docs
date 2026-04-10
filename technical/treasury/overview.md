---
sidebar_position: 1
title: Treasury
---

# Treasury

The treasury is a fee accumulator with a configurable rate. It implements [OpenZeppelin Ownable](https://github.com/OpenZeppelin/stellar-contracts/tree/main/contracts/access) for access control. For standard Ownable behavior (`transfer_ownership`, `renounce_ownership`), refer to the OZ documentation.

## Constructor

`__constructor(owner: Address, rate: i128)`

Sets the OZ Ownable owner and the initial fee rate. The rate must be in `[0, SCALAR_7/2]` (0% to 50%).

## Fee Rate

`get_rate() -> i128` is permissionless. It returns the current fee rate in SCALAR_7 precision, defaulting to `0` if unset.

`set_rate(rate: i128)` is owner-only (`#[only_owner]`). The rate is bounded to `[0, SCALAR_7/2]` (0% to 50%). Setting a rate outside this range panics with `TreasuryError::InvalidRate` (900).

The trading contract calls `get_rate()` on every trade to compute the treasury's share. The protocol fee is defined as `protocol_fee = base_fee + impact_fee + borrowing_fee` (excludes funding, which is peer-to-peer). The treasury receives:

$$
\text{treasury\_fee} = \lfloor \text{protocol\_fee} \times \frac{\text{rate}}{\text{SCALAR\_7}} \rfloor
$$

## Fee Collection

The treasury is a passive receiver. The trading contract pushes fees to the treasury address via standard token transfers. The treasury contract does not pull fees or track per-token accounting.

## Withdrawal

`withdraw(token: Address, to: Address, amount: i128)` is owner-only. It can withdraw any SEP-41 token held by the treasury. There is no per-token accounting or whitelist.

## Storage

The treasury uses only instance storage (30-day TTL):

| Key | Type | Description |
|---|---|---|
| `"Rate"` | `i128` | Protocol fee rate (SCALAR_7) |
| OZ Ownable | `Address` | Owner address (managed internally) |

## Immutability in Trading

The treasury address is set in the trading contract's constructor and stored in instance storage with no setter. Once deployed, the trading contract always sends protocol fees to the same treasury. Changing the treasury requires redeploying the trading contract.
