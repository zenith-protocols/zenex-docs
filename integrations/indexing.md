---
sidebar_position: 5
title: Indexing
---

# Indexing

Every state change on a Zenex market emits a typed Soroban event. An indexer reconstructs positions, fills, and vault activity by decoding these events in order. The SDK ships a decoder keyed on each event's on-chain topic layout, so you can build an indexer in any environment that can read Soroban events.

## The indexing path

Zenex runs a hosted indexer built on a Goldsky Turbo pipeline: contract events flow through a Goldsky webhook into a Node.js receiver, which decodes them with `@zenith-protocols/zenex-sdk` and writes position and fill state to Postgres. A separate backend serves the decoded data over a REST API (base URL TBD). To run your own, point a Goldsky pipeline at a market's trading contract, decode the webhook payloads with the SDK, and persist whatever shape your application needs. The reference receiver lives at [`zenex-indexer`](https://github.com/zenith-protocols/zenex-indexer).

## Decoding

`decodeEvent` accepts a raw event from Soroban RPC `getEvents`, a Mercury webhook, or a Goldsky Turbo webhook, dispatches to the right normalizer by shape, and returns a typed union. `normalizeGoldsky` is the entry point the hosted indexer uses.

```typescript
import { decodeEvent, ZenexContractType, TradingEventType } from '@zenith-protocols/zenex-sdk';

// `raw` is a Goldsky webhook event, an RPC event, or a Mercury event.
const decoded = decodeEvent(raw);

if (decoded?.contractType === ZenexContractType.Trading) {
  switch (decoded.eventType) {
    case TradingEventType.IncreaseFill:
      // itemized open receipt
      break;
    case TradingEventType.PositionUpdate:
      // the resulting netted position row
      break;
  }
}
```

`decodeEvent` returns `undefined` for events it does not recognize (including events from unsuccessful transactions or contract calls, which `normalizeGoldsky` filters defensively).

## Topic layout

Every trading event is a `#[contractevent]`. Its topics are the snake_case event name symbol first, then the `#[topic]` fields in declaration order; every remaining field lands in the data map. Amounts carry units: token decimals for quote-side values, base decimals for `tokens`, the feed's price scalar for prices, and `SCALAR_18` for indices and rates.

## Trading events

There are 14 trading events.

| Event (name symbol) | Topics after the name | Data fields |
|---|---|---|
| `create_order` | `user`, `id` | `order` (the stored `Order` row) |
| `cancel_order` | `user`, `id` | (none) |
| `create_vault_order` | `user`, `id` | `order` (the stored `VaultOrder` row) |
| `cancel_vault_order` | `user`, `id` | (none) |
| `execute_vault_order` | `user`, `id` | `filled`, `remaining` (0 = completed and removed) |
| `claim_funding` | `user` | `amount` |
| `adl_update` | (none) | `long`, `short` (per-side ADL enabled flags) |
| `status_update` | (none) | `status` (the `Status` discriminant) |
| `config_update` | (none) | `config` (the new `Config`) |
| `terminal_price_update` | (none) | `price` (the flat settlement price) |
| `increase_fill` | `user`, `id`, `is_long` | `notional`, `tokens`, `collateral`, `base_fee`, `impact_fee`, `funding`, `borrowing` |
| `decrease_fill` | `user`, `id`, `is_long` | `notional`, `tokens`, `collateral`, `pnl`, `base_fee`, `impact_fee`, `funding`, `borrowing`, `bad_debt`, `returned` |
| `liquidation` | `user`, `is_long` | `notional`, `tokens`, `collateral`, `pnl`, `base_fee`, `impact_fee`, `funding`, `borrowing`, `bad_debt`, `liq_fee`, `returned`, `forfeit` |
| `position_update` | `user`, `is_long` | `position` (the stored `Position` row; zeroed = closed) |

The decoded event fields are camelCase (`orderId`, `isLong`, `baseFee`, `impactFee`, `badDebt`, `liqFee`), and nested `order` / `position` / `config` structs decode into the same typed mirrors the view parsers return.

## Fill receipts versus position snapshots

A fill emits two events. The receipt (`increase_fill`, `decrease_fill`, or `liquidation`) carries the itemized economics of what happened: the size and base tokens moved, the collateral leg, realized PnL, the four fee items (trade, impact, funding, borrowing), and any bad debt. The paired `position_update` carries the resulting netted position row, zeroed when the position closed. Index the receipt to reconstruct the trade's economics and the `position_update` to track live state; join them on the transaction.

A few details worth encoding in an indexer:

- The fill price is implied, not a field. Compute it as `notional * SCALAR_18 / tokens` from a receipt.
- On `decrease_fill` and `liquidation`, the `funding` sign tells you where funding went: positive was paid from collateral, negative was credited to the trader's claimable balance.
- On `liquidation`, `liq_fee` of `0` is a soft-tier liquidation (the remainder is `returned` to the trader); a positive `liq_fee` is a hard-tier liquidation (the remainder is `forfeit` to the vault).
- A `decrease_fill` with `orderId` of `0` is an auto-deleveraging slice, not a user-submitted order. The keeper force-decreased the position through the ADL path.

## Factory events

Market deployment emits one factory event.

| Event (name symbol) | Topics after the name | Data fields |
|---|---|---|
| `deploy` | `trading`, `vault` | (none) |

Index `deploy` to discover new markets and their paired strategy vaults, then subscribe each new trading address to your pipeline.

## Vault and governance events

The strategy vault and the generic governance timelock emit their own events, decoded by the same `decodeEvent` entry point (`ZenexContractType.Vault`, `ZenexContractType.Governance`). Most trading integrations only need the trading and factory events above.

## Running your own indexer

The reference receiver ([`zenex-indexer`](https://github.com/zenith-protocols/zenex-indexer)) receives a Goldsky webhook, decodes each event with the SDK, and writes to Postgres. Deploy it under your own Goldsky pipeline and database if you want full control over the schema, custom enrichment, or to track a private market the hosted indexer does not cover. Because the decoder is keyed on the on-chain topic layout above, an alternative indexer in any language can read the same events directly from Soroban RPC.
