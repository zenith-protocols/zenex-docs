---
sidebar_position: 5
title: Indexing
---

# Indexing

Every state change on a Zenex market emits a typed Soroban event. An indexer reconstructs positions, fills, and vault activity by decoding these events in order. The SDK ships the event shapes as TypeScript interfaces, so a decoder written against the topic layout below stays in step with the contracts.

## The indexing path

Zenex runs a hosted indexer built on a Goldsky Turbo pipeline: contract events flow through a Goldsky webhook into a Node.js receiver, which decodes them against the SDK's event types and writes position and fill state to Postgres. A separate backend serves the decoded data over a REST API (base URL TBD). To run your own, point a Goldsky pipeline at a market's market contract, decode the webhook payloads, and persist whatever shape your application needs. The reference receiver lives at [`zenex-indexer`](https://github.com/zenith-protocols/zenex-indexer).

## Decoding

The SDK exports the `MarketEventType` enum (whose members are the topic-0 symbols below), the `ZenexContractType` tag, and one interface per event under the `MarketEvent`, `VaultEvent`, `FactoryEvent`, and `GovernanceEvent` unions. Write the decode against the topic layout below and type the result with these interfaces.

```typescript
import { MarketEventType } from '@zenith-protocols/zenex-sdk';
import type { MarketEvent } from '@zenith-protocols/zenex-sdk';

function apply(decoded: MarketEvent) {
  switch (decoded.eventType) {
    case MarketEventType.OpenFill:
      // itemized receipt for a fill that opened the side
      break;
    case MarketEventType.CloseFill:
      // itemized receipt for a full close
      break;
  }
}
```

## Topic layout

Every market event is a `#[contractevent]`. Its topics are the snake_case event name symbol first, then the `#[topic]` fields in declaration order. Every remaining field lands in the data, which crosses the wire as a `Map<Symbol, Val>` keyed by field name and sorted by that name's bytes, so the declaration order the tables below list is documentation rather than wire layout. An event with no non-topic fields carries an empty map. Amounts carry units: token decimals for quote-side values, base decimals for `tokens`, the feed's native price precision for prices, and `SCALAR_18` for indices and rates.

## Market events

There are 18 market events.

| Event (name symbol) | Topics after the name | Data fields |
|---|---|---|
| `create_order` | `user`, `id` | `order` (the stored `Order` row) |
| `cancel_order` | `user`, `id` | `refund` (escrow returned by this cancel) |
| `create_vault_order` | `user`, `id` | `order` (the stored `VaultOrder` row) |
| `cancel_vault_order` | `user`, `id` | (empty map) |
| `deposit_fill` | `user`, `id` | `keeper`, `assets`, `shares`, `fee`, `net_pnl` |
| `redeem_fill` | `user`, `id` | `keeper`, `shares`, `assets`, `fee`, `net_pnl` |
| `claim_credit` | `user` | `amount` |
| `adl_update` | (none) | `long`, `short` (per-side ADL enabled flags) |
| `accrual_update` | (none) | (empty map) |
| `status_update` | (none) | `status` (the `Status` discriminant) |
| `config_update` | (none) | `config` (the new `Config`) |
| `terminal_price_update` | (none) | `price` (the flat settlement price) |
| `open_fill` | `user`, `id`, `is_long` | `keeper`, `price`, `notional`, `tokens`, `margin`, `base_fee`, `impact_fee` |
| `increase_fill` | `user`, `id`, `is_long` | `keeper`, `price`, `notional`, `tokens`, `margin`, `base_fee`, `impact_fee`, `funding`, `borrowing` |
| `decrease_fill` | `user`, `id`, `is_long` | `keeper`, `price`, `notional`, `tokens`, `margin`, `pnl`, `base_fee`, `impact_fee`, `funding`, `borrowing`, `returned` |
| `close_fill` | `user`, `id`, `is_long` | `keeper`, `price`, `notional`, `tokens`, `margin`, `pnl`, `base_fee`, `impact_fee`, `funding`, `borrowing`, `bad_debt`, `returned` |
| `reject_vault_order` | `user`, `id` | `keeper`, `quoted`, `net_pnl` |
| `liquidation` | `user`, `is_long` | `keeper`, `price`, `notional`, `tokens`, `margin`, `pnl`, `base_fee`, `impact_fee`, `funding`, `borrowing`, `bad_debt`, `returned`, `liq_fee` |

Topic types are `user: Address`, `id: u32`, `is_long: bool`. Every raw data field is `i128` except `keeper` (`Address`), `order` (`Order` or `VaultOrder`), `config` (`Config`), `long` and `short` (`bool`), and `status` (`u32`). The SDK adds one derived property that is not in the contract payload: `source` on `redeem_fill` (`'order' | 'instant'`) and on `decrease_fill` and `close_fill` (`'order' | 'adl'`), derived from the order id, where `0` marks an ADL close or a retired-market instant redeem. The decoded event fields are camelCase (`orderId`, `isLong`, `baseFee`, `impactFee`, `badDebt`, `liqFee`, `netPnl`), and nested `order` / `config` structs decode into the same typed mirrors the view parsers return.

## Fill receipts and position state

A fill emits one receipt (`open_fill`, `increase_fill`, `decrease_fill`, `close_fill`, or `liquidation`) carrying the itemized economics of what happened: the execution price, the size and base tokens moved, the margin leg, realized PnL, the fee items, and any bad debt. Both lifecycle boundaries are chain-attested: `open_fill` fires when a fill takes an empty side to size, `close_fill` (or `liquidation`) when the stored row zeroes. An indexer opens and closes position lifecycles on the event kind alone, without inferring them from its own accumulated state. Read the resulting position row through `getPosition` or from the transaction's ledger entry changes, which carry every stored row the transaction wrote.

A few details worth encoding in an indexer:

- `price` is the execution price the fill settled at: the entry side on `open_fill` and `increase_fill`, the exit side on the close receipts. On a close receipt, `notional` and `tokens` are the closed size at entry pricing, so `notional * SCALAR_18 / tokens` gives the entry price of the closed chunk.
- `open_fill` carries no `funding` or `borrowing`. Accruals settle over the notional held before the fill, which is zero when the side opens.
- On the receipts that carry `funding`, the sign tells you where funding went: positive was paid from margin, negative was credited to the trader's claimable balance.
- `liquidation` charges `liq_fee` on every liquidation, capped at the position's equity. `returned` is the remainder paid to the trader net of that fee, zero exactly where the fee saturates it.
- A `decrease_fill` or `close_fill` with `orderId` of `0` is an auto-deleveraging close, not a user-submitted order. The keeper force-decreased the position through the ADL path. A `redeem_fill` with `orderId` of `0` is a retired market's instant redeem, where the redeeming user stands in as `keeper`.
- `close_fill` and `liquidation` arrive alongside one `cancel_order` per decrease order still resting on the side, each carrying its own `refund`. Those refunds ride the closure payout transfer, so the tokens the trader actually receives exceed `returned` by their sum.
- `accrual_update` comes only from `accrue` and carries no payload. It marks that the accrual indices advanced. The post-accrual state (indices, rate, timestamp) is read from `get_market_data`. Fills, liquidations, and ADL advance the same indices silently.
- A trader's claimable credit balance holds earned funding plus any payout whose direct token transfer failed (the market parks it as claimable credit instead of trapping the fill). `claim_credit` pays it out, capped at the market's credit pool.

## Factory events

Market deployment emits one factory event.

| Event (name symbol) | Topics after the name | Data fields |
|---|---|---|
| `deploy` | `trading`, `vault` | (empty map) — the `trading` topic keeps its pre-rename name so historical `Deploy` events stay decodable; the SDK's decoded `FactoryDeployEvent` exposes it as `market` |

Index `deploy` to discover new markets and their paired strategy vaults, then subscribe each new market address to your pipeline.

## Vault, governance, and router events

| Contract | Event (name symbol) | Topics after the name | Data fields |
|---|---|---|---|
| vault | `deposit` | `operator`, `from`, `receiver` | `assets`, `shares` |
| vault | `withdraw` | `operator`, `receiver`, `owner` | `assets`, `shares` |
| vault | `strategy_withdraw` | `strategy` | `amount` |
| governance | `queued` | `nonce` | `target`, `fn_name`, `unlock_time` |
| governance | `executed` | `nonce` | `target`, `fn_name` |
| governance | `cancelled` | `nonce` | (empty map) |
| governance | `status_set` | `target` | `status` |
| governance | `delay_set` | (none) | `old_delay`, `new_delay` |
| router | `fee_collected` | `user`, `recipient` | `token`, `amount` |

`operator` on the vault pair is always the market contract, and a mint or burn publishes nothing of its own, so `deposit` / `withdraw` plus the ledger entry changes are the whole record of a supply move. Shares are an ordinary fungible token on top of that, and two of its events publish under the same `transfer` symbol, one with a bare `i128` in data and one with a map of `amount` and `to_muxed_id`, so a share-balance decoder branches on the data shape. The oracle and the treasury emit nothing, and the market router's batched calls surface under the market contract's id rather than the router's, whose own id carries only the `fee_collected` its three `_with_fee` entry points emit. The market, governance, treasury, and oracle contracts each implement Ownable and emit `ownership_transfer`, `ownership_transfer_completed`, and `ownership_renounced`, all of whose addresses ride the data map rather than topics.

## Running your own indexer

The reference receiver ([`zenex-indexer`](https://github.com/zenith-protocols/zenex-indexer)) receives a Goldsky webhook, decodes each event, and writes to Postgres. Deploy it under your own Goldsky pipeline and database if you want full control over the schema, custom enrichment, or to track a private market the hosted indexer does not cover. Because the shapes above are the on-chain topic layout, an indexer in any language can read the same events directly from Soroban RPC.
