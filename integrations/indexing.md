---
title: Index events
sidebar_label: Build an event index
description: Decode contract receipts, preserve event order, and reconstruct orders and position lifecycles.
---

# Index events

An index turns contract receipts into history. Use [the public data API](./data-api) when you need existing projections. This guide covers your own pipeline. The Zenex indexer reads Stellar RPC events, archives them, and projects them into PostgreSQL. Its backend serves those projections.

## Establish coverage

Track a deployment's market addresses and the ledger where your coverage starts. Preserve the network with that registry.

Read `getEvents` in cursor order. Store the cursor only after the batch and its projections commit. Replayed events must not create duplicate rows. Persist the RPC event ID, contract address, ledger, close time, transaction hash, topics, and value. Keep the raw receipt for a rebuild. For RPC pagination and filters, consult [Stellar getEvents](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getEvents).

:::warning RPC history has a retention window
A cursor outside that window needs an archive or backfill. An empty response does not prove complete historical coverage.
:::

## Decode the wire format

Use Stellar SDK `scValToNative` to decode each topic and the data value. The first topic identifies the event. Market topics then carry the owner, order ID, and side where applicable. Data maps use contract field names in snake case. The SDK exports event types, enums, and row parsers. Your decoder validates the wire data and maps it to those types.

| Wire receipt | Projected effect |
| --- | --- |
| `create_order`, `create_vault_order` | Add the immutable pending row |
| `cancel_order`, `cancel_vault_order` | Remove the pending row |
| `open_fill` | Start a position lifecycle |
| `increase_fill`, `decrease_fill` | Record a change within that lifecycle |
| `close_fill`, `liquidation` | Finalize the lifecycle |
| `deposit_fill`, `redeem_fill` | Record a vault receipt |
| `reject_vault_order` | Remove the order and record its rejection |
| `claim_credit` | Record the paid credit |
| `accrual_update` | Refresh market accrual state |
| `status_update`, `config_update`, `terminal_price_update`, `adl_update` | Update the corresponding market state |

Validate topic count, value keys, value types, and source contract. Decode only events from successful contract calls. Keep invalid or unknown receipts for inspection. Keep amounts as `bigint` or exact decimal text. A JSON serializer must convert `bigint` deliberately. The complete field catalog lives in [market events](/technical/market/events). Use [units and scales](/technical/units) when you normalize values.

:::warning Receipts do not replace current state
Fill payloads describe the amounts for that action. Read the resulting position from chain when you need its current row.
:::

## Identify orders and positions

Key an order by market, owner, and ID. Trade orders and vault orders share the owner's order counter. Key a position by market, owner, and side. A lifecycle starts at `open_fill` and ends at `close_fill` or `liquidation`.

A fill with ID zero can come from auto-deleveraging. Do not require a created order for every decrease or close receipt. Preserve receipt order within a transaction. A full close can emit cancel receipts for pending decrease orders on the same side.

## Keep financial history exact

A funding debit is positive. Earned funding is negative and becomes claimable credit. Borrowing is a non-negative cost. Use the receipt's realized profit, fees, and payout fields for that action. Avoid reconstructing realized results from a later ticker price.

A vault rejection returns the order's principal and pays its execution fee to the keeper. Its create receipt supplies those escrow amounts.

An `accrual_update` marker has no financial payload. Your projection needs a chain observation for rates and market totals. For vault receipt amounts and cancellation order, consult [the event catalog](/technical/market/events).

## Publish honest freshness

Commit a ledger watermark with the projected batch. Return the first covered ledger and the last fully projected ledger with query results. Treat a gap, failed decoder, or failed projection as a coverage problem. Preserve the source receipt so you can repair and replay it.

Readers need to distinguish a confirmed transaction from an index that has not reached its ledger. The [public API freshness model](./data-api#check-freshness) shows that boundary.
