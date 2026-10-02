---
sidebar_position: 1
title: Oracle
---

# Oracle

The oracle is the Chainlink Data Streams adapter for the market. It turns a signed V3 report into a `PriceData` value for the stream the caller names. Chainlink's deployed verifier checks the signatures, and the oracle applies every other gate itself. The owner sets two staleness windows and one spread reduction factor.

| Page | What it holds |
| --- | --- |
| [Price verification](./verify-price.md) | `verify_price`, its arguments, the gate order, the staleness classes, the spread reduction formula, the `PriceData` return, and the error codes it raises. |
| [Constructor and settings](./settings.md) | `__constructor`, the owner calls, the bounds, the views, the storage keys, and the events. The [ownership and upgrade](./settings.md#ownership-and-upgrade) section covers the Ownable entry points and `upgrade`. |
