---
title: Events
sidebar_position: 17
---

# Events

The market declares 17 events, and the Ownable module it carries publishes three more. Each event is the receipt for one action, and its payload carries what the call charged, moved, or set. The state a call leaves behind is read from the views and from the transaction's ledger entry changes. Every unit named below is defined on [Units and scales](../units.md).

## Wire layout

Every market event carries the `contractevent` attribute from soroban-sdk 26.1.1. The first topic is the event name symbol, the struct name in lower snake case. The fields marked `#[topic]` follow as the remaining topics, in declaration order. Every other field sits in the data map under its own field name. The host holds a map in key order, so the data map is ordered by field name and not by declaration order. An event that declares no data field carries an empty map.

## Event index

| Event | Topics after the name | Published by |
| --- | --- | --- |
| `create_order` | `user: Address`, `id: u32` | `create_order` |
| `cancel_order` | `user`, `id` | `cancel_order`, and the closure sweep in `execute_order`, `execute_liquidation`, and `execute_adl` |
| `create_vault_order` | `user`, `id` | `create_vault_order` |
| `cancel_vault_order` | `user`, `id` | `cancel_vault_order` |
| `deposit_fill` | `user`, `id` | `execute_vault_order` |
| `redeem_fill` | `user`, `id` | `execute_vault_order`, and `create_vault_order` on a `Retired` market |
| `claim_credit` | `user` | `claim_credit` |
| `adl_update` | none | `update_adl_state` |
| `accrual_update` | none | `accrue` |
| `status_update` | none | `set_status` |
| `config_update` | none | `set_config` |
| `terminal_price_update` | none | `set_terminal_price` |
| `open_fill` | `user`, `id`, `is_long: bool` | `execute_order` |
| `increase_fill` | `user`, `id`, `is_long` | `execute_order` |
| `decrease_fill` | `user`, `id`, `is_long` | `execute_order`, `execute_adl` |
| `close_fill` | `user`, `id`, `is_long` | `execute_order`, `execute_adl` |
| `liquidation` | `user`, `is_long` | `execute_liquidation` |

## Order receipts

| Event | Data field | Unit | Meaning |
| --- | --- | --- | --- |
| `create_order` | `order` | `Order` | The stored order row, as `get_order` returns it. |
| `cancel_order` | `refund` | token-dec | The escrow this one cancel returns, `Order::escrow_amount`. |

The order row is immutable while the order rests, so the `create_order` payload stays authoritative until the order's fill or cancel receipt.

`cancel_order` covers two paths. The order's `user` cancels one order through `cancel_order`, or a full close sweeps every decrease order that still rests on the closed side. The sweep publishes one event for each swept id, and each event carries that order's own escrow in `refund`.

## Vault order receipts

| Event | Data field | Unit | Meaning |
| --- | --- | --- | --- |
| `create_vault_order` | `order` | `VaultOrder` | The stored vault order row, as `get_vault_order` returns it. |
| `deposit_fill` | `keeper` | Address | The reward recipient the fill's caller named. |
| `deposit_fill` | `assets` | token-dec | The gross assets taken from escrow. |
| `deposit_fill` | `shares` | share-dec | The vault shares minted to the user. |
| `deposit_fill` | `fee` | token-dec | The vault fee charged. |
| `deposit_fill` | `net_pnl` | token-dec, signed | The capped net pending trader PnL the share mint priced against. |
| `redeem_fill` | `keeper` | Address | The reward recipient the fill's caller named. |
| `redeem_fill` | `shares` | share-dec | The vault shares burned. |
| `redeem_fill` | `assets` | token-dec | The gross assets redeemed from the vault. |
| `redeem_fill` | `fee` | token-dec | The vault fee charged. |
| `redeem_fill` | `net_pnl` | token-dec, signed | The capped net pending trader PnL the share burn priced against. |

A deposit fill prices the share mint against `assets - fee`. The vault also takes its cut of `fee`, so its net credit is the sum of the two. A redeem fill pays the user `assets - fee`. `Settlement::compute_vault_order` splits `fee` into the keeper, treasury, and vault legs. [Vault orders](./vault-orders.md) gives both steps.

`cancel_vault_order` declares no data field and carries the empty map.

## Credit

`claim_credit` carries one data field, `amount` (token-dec), the sum the call paid. The payout is the claimable balance capped at what the credit pool holds, so a claim can be partial. An unpaid remainder stays claimable for a later call.

## Fill receipts

When the side held no position before the fill, an increase fill publishes `open_fill`, and `increase_fill` otherwise. When the row survives, a decrease fill publishes `decrease_fill`, and `close_fill` when the row zeroes. `execute_liquidation` publishes `liquidation`. Only the order path opens a position, so `open_fill` comes from `execute_order` alone.

Accruals settle over the notional the position held before the fill. That notional is zero on an open, so `open_fill` declares neither `funding` nor `borrowing`.

The five fill events share one payload shape, so the table below is keyed by data field. The last column names the events that carry the field.

| Data field | Unit | Meaning | Carried by |
| --- | --- | --- | --- |
| `keeper` | Address | The reward recipient the fill's caller named. | all five |
| `price` | feed precision | The entry-side price: the ask for a long, the bid for a short. | `open_fill`, `increase_fill` |
| `price` | feed precision | The exit-side price: the bid for a long, the ask for a short. | `decrease_fill`, `close_fill`, `liquidation` |
| `notional` | token-dec | The size opened or added. | `open_fill`, `increase_fill` |
| `notional` | token-dec | The closed size, as the position booked it at entry. | `decrease_fill`, `close_fill`, `liquidation` |
| `tokens` | base-dec | The base size bought. | `open_fill`, `increase_fill` |
| `tokens` | base-dec | The base size closed. | `decrease_fill`, `close_fill`, `liquidation` |
| `margin` | token-dec | The margin the order escrowed at creation, gross of the debited fees. | `open_fill`, `increase_fill` |
| `margin` | token-dec | The requested withdrawal. An auto-deleveraging fill requests `0`. | `decrease_fill` |
| `margin` | token-dec | The freed margin, gross of the debited fees. | `close_fill`, `liquidation` |
| `pnl` | token-dec, signed | The realized PnL on the closed size, post-haircut and gross of the debited fees. | `decrease_fill`, `close_fill`, `liquidation` |
| `base_fee` | token-dec | The trade fee charged. | all five |
| `impact_fee` | token-dec | The impact fee charged. | all five |
| `funding` | token-dec, signed | The settled funding. A positive value is paid from margin, a negative value is credited as claimable. | every fill except `open_fill` |
| `borrowing` | token-dec | The settled borrowing fee. | every fill except `open_fill` |
| `bad_debt` | token-dec | The fees and losses past the freed margin, which the vault absorbs. | `close_fill`, `liquidation` |
| `returned` | token-dec | The paid withdrawal plus the profit the fees did not consume. | `decrease_fill` |
| `returned` | token-dec | The settled equity, floored at zero. | `close_fill` |
| `returned` | token-dec | The settled equity, floored at zero, less `liq_fee`. | `liquidation` |
| `liq_fee` | token-dec | The liquidation fee charged, capped at the settled equity floored at zero. | `liquidation` |

On a `close_fill` and on a `liquidation`, `Position::settle` computes the settled equity as the freed `margin`, less the debited fees, plus `pnl`. The debited fees are `base_fee`, `impact_fee`, `borrowing`, and `funding` when it is positive. [Margin and leverage](./margin-and-leverage.md) defines the terms. A close whose settled equity is negative returns `0` and reports the shortfall in `bad_debt`. A partial decrease prices its own fees over the closed fraction, and it can leave a shortfall that the vault funds too. `decrease_fill` declares no `bad_debt` field, so its absence is not a zero.

A `returned` amount is owed to the trader, and not always transferred to them. A payout the token transfer rejects becomes a claimable credit, which `claim_credit` later pays. No event separates the two outcomes.

## Administration

| Event | Data field | Unit | Meaning |
| --- | --- | --- | --- |
| `adl_update` | `long` | bool | Auto-deleveraging is enabled on the long side. |
| `adl_update` | `short` | bool | Auto-deleveraging is enabled on the short side. |
| `status_update` | `status` | u32 | The new operational status, as the `Status` discriminant. |
| `config_update` | `config` | `Config` | The new market configuration. |
| `terminal_price_update` | `price` | feed precision | The flat settlement price the call set or refreshed. |

`accrual_update` declares no data field and carries the empty map.

## Struct payloads

Four payloads carry a stored row or a discriminant, each documented on its own page. The `Order` row is on [Orders](./orders.md). The `VaultOrder` row is on [Vault orders](./vault-orders.md). The `Config` struct is on [Config](./config.md). The `status` value is the `Status` discriminant, on [Market status](./status.md).

## Reserved ids

`next_order_id` allocates order ids from `1` and never reuses one, so an id in a topic is never `0` for a stored order. Trade orders and vault orders draw from one counter per account, so `user` and `id` name one order across both receipt families. Two receipts use `0` as a marker:

- `execute_adl` fills no order, so its `decrease_fill` or `close_fill` carries `id` `0`.
- A redeem created on a `Retired` market pays the user inside `create_vault_order`. It stores no row and publishes `redeem_fill` with `id` `0`, `keeper` set to the user who redeems, `fee` `0`, and `net_pnl` `0`. That path publishes no `create_vault_order`.

## Order of emission

The events of one call arrive in the order the contract publishes them. Three sequences are fixed:

- `execute_order` on a full close publishes `close_fill` first, then one `cancel_order` for each swept sibling.
- `execute_liquidation` publishes the swept `cancel_order` events first, then `liquidation`.
- `execute_adl` on a full close publishes the swept `cancel_order` events first, then `close_fill`.

`execute_order`, `execute_liquidation`, `execute_adl`, and both `execute_vault_order` fills publish their receipts before `Settlement::settle` runs. The transfers of that settlement, and the events those transfers publish, follow the market's own receipts. The redeemer's net payout is the trader leg of that settlement, so it transfers after `redeem_fill`. A swept escrow refund also joins the trader leg, so it transfers after its own `cancel_order`.

A vault fill also moves tokens before its receipt. `deposit_fill` follows the `strategy_deposit` transfer into the vault, and `redeem_fill` follows the `strategy_redeem` draw from it.

`cancel_order`, `cancel_vault_order`, `claim_credit`, and the retired-market redeem transfer before their receipt. When `Order::escrow_amount` is above zero, `create_order` transfers the escrow first. When the credit-pool surplus is positive, `set_status` into `Retired` sweeps it to the vault first. `set_config`, `set_terminal_price`, `update_adl_state`, and `accrue` move no tokens. A partial fill sweeps no resting order, so a `decrease_fill` on a position that survives carries no `cancel_order` with it.

## Ownership events

The market also carries the Ownable module, which publishes `ownership_transfer`, `ownership_transfer_completed`, and `ownership_renounced` under the same layout rule. Their payloads are on [Ownership and upgrade](../ownership.md).
