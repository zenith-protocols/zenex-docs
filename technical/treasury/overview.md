---
sidebar_position: 1
title: Treasury
---

# Treasury

The treasury is a passive fee sink with a single configurable rate. It implements [OpenZeppelin Ownable](https://github.com/OpenZeppelin/stellar-contracts/tree/main/contracts/access) for access control. For the standard Ownable surface (`get_owner`, two-step `transfer_ownership` plus `accept_ownership`, `renounce_ownership`), refer to the OZ documentation.

## Constructor

`__constructor(owner: Address, rate: i128)`

Sets the Ownable owner and the initial fee rate. The rate must be in `[0, SCALAR_18/2]` (0% to 50%), else the constructor panics with `InvalidRate` (900).

## Fee Rate

`get_rate() -> i128` is permissionless. It returns the current protocol fee rate as a `SCALAR_18` fraction (for example `1e17` = 10%). The constructor always sets a rate, so the storage default of `0` is unreachable on a deployed contract.

`set_rate(rate: i128)` is owner-only. The rate is bounded to `[0, SCALAR_18/2]`. A value outside the range panics with `InvalidRate` (900).

All three entry points (`get_rate`, `set_rate`, `withdraw`) extend the treasury's instance storage TTL (threshold 30 days, bump 31 days), so routine settlements that read the rate keep the contract instance alive.

The market contract reads `get_rate` on every settlement and applies the returned rate directly, relying on the treasury's own `[0, SCALAR_18/2]` bound. The treasury then receives its share of the fees the protocol keeps: the trade fee (base plus impact), the borrowing fee, the liquidation fee, and the vault fill fee on vault-order deposits and redeems. Each component's treasury share is floored separately and computed on the gross fee, before the keeper cut, so the keeper rate cannot dilute the treasury's take. Funding carries no treasury cut, since it is a peer-to-peer transfer between traders. Reading the rate live means the treasury owner can retune the protocol's revenue share without redeploying or reconfiguring the market contract.

## Fee Collection

The treasury is a passive receiver. The market contract pushes fees to it via standard SEP-41 token transfers, and the treasury simply holds whatever balance of each token accumulates from those transfers.

## Withdrawal

`withdraw(token: Address, to: Address, amount: i128)` is owner-only. It can withdraw any SEP-41 token the treasury holds, in any amount, to any destination the owner chooses.

The treasury emits no events of its own. Rate changes and withdrawals surface only through transaction effects, governance `Executed` events when routed through governance, and the token contract's transfer events.

## Immutability in the Market Contract

The treasury address is set once, in the market contract's constructor (threaded through from the factory's `FactoryInitMeta`), and stays fixed for the life of the pair. A market contract always sends protocol fees to the same treasury. Changing the treasury means deploying a fresh market + vault pair.
