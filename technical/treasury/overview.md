---
sidebar_position: 1
title: Treasury
---

# Treasury

The treasury is a passive fee sink with a single configurable rate. It implements [OpenZeppelin Ownable](https://github.com/OpenZeppelin/stellar-contracts/tree/main/contracts/access) for access control. For standard Ownable behavior (`transfer_ownership`, `renounce_ownership`), refer to the OZ documentation.

## Constructor

`__constructor(owner: Address, rate: i128)`

Sets the Ownable owner and the initial fee rate. The rate must be in `[0, SCALAR_18/2]` (0% to 50%), else the constructor panics with `InvalidRate` (900).

## Fee Rate

`get_rate() -> i128` is permissionless. It returns the current protocol fee rate as a `SCALAR_18` fraction (for example `1e17` = 10%), defaulting to `0` if unset.

`set_rate(rate: i128)` is owner-only. The rate is bounded to `[0, SCALAR_18/2]`; a value outside the range panics with `InvalidRate` (900).

The trading contract reads `get_rate()` on every settlement and clamps it to `[0, MAX_KEEPER_RATE]` (which is `SCALAR_18/2`, the same 50% ceiling). The treasury then receives its clamped share of the fees the protocol keeps: the trade fee (base plus impact), the borrowing fee, and any liquidation forfeit. Funding carries no treasury cut, since it is a peer-to-peer transfer between traders. Reading the rate live means governance can retune the protocol's revenue share without redeploying or reconfiguring the trading contract.

## Fee Collection

The treasury is a passive receiver. The trading contract pushes fees to it via standard SEP-41 token transfers. The treasury contract does not pull fees and keeps no per-token accounting.

## Withdrawal

`withdraw(token: Address, to: Address, amount: i128)` is owner-only. It can withdraw any SEP-41 token the treasury holds, to any destination the owner chooses. There is no per-token accounting or whitelist.

## Immutability in Trading

The treasury address is set in the trading contract's constructor (threaded through from the factory's `FactoryInitMeta`) and stored with no setter. A trading contract always sends protocol fees to the same treasury for its lifetime. Changing the treasury means deploying a fresh trading + vault pair.
