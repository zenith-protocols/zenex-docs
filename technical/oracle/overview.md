---
sidebar_position: 1
title: Oracle
---

# Oracle

The oracle turns a signed Chainlink Data Streams V3 report into a `PriceData` value for the stream the caller names. Chainlink's deployed verifier checks the signatures of the decentralized oracle network (DON) on the report. It also checks that the signing configuration is active, and it traps when either check fails. It returns the raw report body. The constructor pins the verifier address. Every other check on the report is the oracle's own, and each one runs on that body, whether this call obtained it or an earlier call did. The pages below hold price verification and the owner's settings, one home per fact. For the Ownable entry points and `upgrade`, refer to [Ownership and upgrade](../ownership.md).

| Page | What it holds |
| --- | --- |
| [Price verification](./verify-price.md) | `verify_price` and its arguments, the permissionless call, the `PriceData` return, the report decode, the gate order, the two staleness classes, the spread reduction formula, the memo of a verified body, and the error codes. |
| [Constructor and settings](./settings.md) | `__constructor`, `update_staleness`, `update_spread_reduction_factor`, the views, the bounds and constants, the instance storage keys, and the events. |
