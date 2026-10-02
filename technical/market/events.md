---
title: Events
sidebar_position: 17
---

# Events

This page covers the 18 events the market publishes, their topics and data fields, and the order in which one call emits them. It closes with the three ownership events that the market carries from the Ownable module. Each event is the receipt for one action, and its payload carries what the call charged, moved, or set. The state a call leaves behind comes from the views and from the ledger entry changes of the transaction. [Units and scales](../units.md) defines every unit named below.

## Topics identify the receipt and the data map carries the amounts

Every market event carries the `contractevent` attribute from soroban-sdk 26.1.1. The first topic is the event name symbol, which is the struct name in lower snake case. The fields marked `#[topic]` follow as the remaining topics, in declaration order. Every other field sits in the data map under its own field name. The host holds a map in key order, so the data map is ordered by field name and not by declaration order. An event with no data field carries an empty map.

## Eighteen events cover orders, fills, credit, and administration

| Event | Topics after the name | Published by |
| --- | --- | --- |
| `create_order` | `user: Address`, `id: u32` | `create_order` |
| `cancel_order` | `user`, `id` | `cancel_order`, and the closure sweep in `execute_order`, `execute_liquidation`, and `execute_adl` |
| `create_vault_order` | `user`, `id` | `create_vault_order` |
| `cancel_vault_order` | `user`, `id` | `cancel_vault_order` |
| `deposit_fill` | `user`, `id` | `execute_vault_order` |
| `redeem_fill` | `user`, `id` | `execute_vault_order`, and `create_vault_order` on a `Retired` market |
| `reject_vault_order` | `user`, `id` | `execute_vault_order` |
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

The owner signs `set_config`, `set_status`, and `set_terminal_price`. `update_adl_state` and `accrue` take a price payload and no signature. Every fill entry names a `keeper`, which is the reward recipient and never an authorizer. Each fill receipt carries that address in `keeper`.

## Order receipts carry the row and the escrow

| Event | Data field | Unit | Meaning |
| --- | --- | --- | --- |
| `create_order` | `order` | `Order` | The stored order row, as `get_order` returns it. |
| `cancel_order` | `refund` | token-dec | The escrow this one cancel returns, as `Order::escrow_amount` computes it. The escrow is `margin + exec_fee` for an increase order and `exec_fee` for a decrease order. |

The order row is immutable while the order rests, so the `create_order` payload stays authoritative until the order's fill or cancel receipt.

`cancel_order` covers two paths. The order's `user` cancels one order through `cancel_order`. A full close also sweeps every decrease order that still rests on the closed side. The sweep publishes one event for each swept id, and each event carries that order's own escrow in `refund`.

## Vault order receipts report the fee and the mark

| Event | Data field | Unit | Meaning |
| --- | --- | --- | --- |
| `create_vault_order` | `order` | `VaultOrder` | The stored vault order row, as `get_vault_order` returns it. |
| `deposit_fill` | `keeper` | Address | The reward recipient the fill's caller named. |
| `deposit_fill` | `assets` | token-dec | The gross deposit principal taken from escrow, `order.amount`. It excludes `exec_fee`. |
| `deposit_fill` | `shares` | share-dec | The vault shares minted to the user. |
| `deposit_fill` | `fee` | token-dec | The vault fee charged. |
| `deposit_fill` | `net_pnl` | token-dec, signed | The capped net pending trader profit and loss (PnL) that the share mint priced against. |
| `redeem_fill` | `keeper` | Address | The reward recipient the fill's caller named. |
| `redeem_fill` | `shares` | share-dec | The vault shares burned. |
| `redeem_fill` | `assets` | token-dec | The gross assets redeemed from the vault. |
| `redeem_fill` | `fee` | token-dec | The vault fee charged. |
| `redeem_fill` | `net_pnl` | token-dec, signed | The capped net pending trader PnL that the share burn priced against. |
| `reject_vault_order` | `keeper` | Address | The reward recipient the fill's caller named. |
| `reject_vault_order` | `quoted` | share-dec (deposit) or token-dec (redeem) | What the fill would have paid, below the order's `min_out`. It is the shares a deposit would mint, or a redeem's assets net of the vault fee. |
| `reject_vault_order` | `net_pnl` | token-dec, signed | The capped net pending trader PnL that the quote priced against. |

A deposit fill mints shares against `assets - fee`, and that amount raises the vault's tracked balance when the assets move. The vault leg of `fee` raises the balance a second time when the settlement legs move. `Settlement::compute_vault_order` splits `fee` into the keeper, treasury, and vault legs and adds `exec_fee` to the keeper leg. A redeem fill pays the user `assets - fee` on the `trader` leg. [Deposit fill](./vault-orders.md#deposit-fill) and [Redeem fill](./vault-orders.md#redeem-fill) list the steps in order.

A rejection refunds the order's `amount` to the user and pays its `exec_fee` to the keeper. Both values sit in the `create_vault_order` row, so the receipt does not repeat them. A deposit refund that the user cannot receive parks as claimable credit. [Rejection](./vault-orders.md#rejection) gives the sequence.

`cancel_vault_order` carries an empty data map.

## A credit claim pays what the pool holds

`claim_credit` carries one data field, `amount` (token-dec), the sum the call paid. The payout is the claimable balance capped at what the credit pool holds, so a claim can be partial. An unpaid remainder stays claimable for a later call. A call with nothing payable traps with `NothingToClaim` (760) and publishes no event.

## Five fill events draw from one field table

When the side held no position before the fill, an increase fill publishes `open_fill`, and `increase_fill` otherwise. An increase order with zero notional adds margin alone, so it publishes `increase_fill` with `notional` and `tokens` of `0`. When the row survives, a decrease fill publishes `decrease_fill`, and `close_fill` when the row zeroes. `execute_liquidation` publishes `liquidation`. Only the order path opens a position, so `open_fill` comes from `execute_order` alone.

Accruals settle over the notional the position held before the fill. That notional is zero on an open, so `open_fill` omits `funding` and `borrowing`.

The table is keyed by data field, and the last column names the events that carry it.

| Data field | Unit | Meaning | Carried by |
| --- | --- | --- | --- |
| `keeper` | Address | The reward recipient the fill's caller named. | all five |
| `price` | feed precision | The entry-side price. It is the ask for a long and the bid for a short. | `open_fill`, `increase_fill` |
| `price` | feed precision | The exit-side price. It is the bid for a long and the ask for a short. | `decrease_fill`, `close_fill`, `liquidation` |
| `notional` | token-dec | The size opened or added. | `open_fill`, `increase_fill` |
| `notional` | token-dec | The closed size, as the position booked it at entry. | `decrease_fill`, `close_fill`, `liquidation` |
| `tokens` | base-dec | The base size bought at the entry price. `to_tokens_floor` rounds a long down and `to_tokens_ceil` rounds a short up. | `open_fill`, `increase_fill` |
| `tokens` | base-dec | The base size closed. | `decrease_fill`, `close_fill`, `liquidation` |
| `margin` | token-dec | The margin the order escrowed at creation, gross of the debited fees. | `open_fill`, `increase_fill` |
| `margin` | token-dec | The requested withdrawal. An auto-deleveraging (ADL) fill requests `0`. | `decrease_fill` |
| `margin` | token-dec | The freed margin, gross of the debited fees. | `close_fill`, `liquidation` |
| `pnl` | token-dec, signed | The realized PnL on the closed size, post-haircut and gross of the debited fees. | `decrease_fill`, `close_fill`, `liquidation` |
| `base_fee` | token-dec | The trade fee charged. | all five |
| `impact_fee` | token-dec | The impact fee charged. | all five |
| `funding` | token-dec, signed | The settled funding. A positive value is paid from margin and a negative value is credited as claimable. | every fill except `open_fill` |
| `borrowing` | token-dec | The settled borrowing fee. | every fill except `open_fill` |
| `bad_debt` | token-dec | The fees and losses past the freed margin, which the vault absorbs. | `close_fill`, `liquidation` |
| `returned` | token-dec | The withdrawal owed plus the profit the fees did not consume. | `decrease_fill` |
| `returned` | token-dec | The settled equity, floored at zero. | `close_fill` |
| `returned` | token-dec | The settled equity, floored at zero, less `liq_fee`. | `liquidation` |
| `liq_fee` | token-dec | The liquidation fee charged, capped at the settled equity floored at zero. | `liquidation` |

### How a close and a liquidation settle

`Position::settle` computes the settled equity. `Position::close_settled` derives `returned` and `bad_debt` from it, and `Position::liquidate` charges `liq_fee`. The [Margin and leverage](./margin-and-leverage.md#settled-equity) page gives the equity formula. The [Liquidation](./liquidation.md#the-fee-is-capped-at-equity) page gives the `liq_fee` formula and a worked table of `returned` and `bad_debt`.

On a `close_fill`, `returned` is the settled equity floored at zero and `bad_debt` is the negated equity floored at zero. On a `liquidation`, `returned` is that equity less `liq_fee`. A negative `funding` is credited as claimable and never enters the debit.

`Position::decrease` traps with `PositionLiquidatable` while the settled equity sits below the maintenance line, so a `close_fill` always carries a `bad_debt` of `0`. A partial decrease prices its own fees over the closed fraction. It can still leave a shortfall that the vault funds. A winner whose profit lifts its equity above the maintenance line can owe fees past its margin. `decrease_fill` carries no `bad_debt` field, so a missing field is not a zero.

A `returned` amount is owed to the user. A payout that the token transfer rejects becomes a claimable credit, which `claim_credit` pays later. No event separates the two outcomes.

## Administration events report the value the call set

| Event | Data field | Unit | Meaning |
| --- | --- | --- | --- |
| `adl_update` | `long` | bool | `true` when the long side is armed, and `false` when it is clear. |
| `adl_update` | `short` | bool | `true` when the short side is armed, and `false` when it is clear. |
| `status_update` | `status` | u32 | The new operational status, as the `Status` discriminant. |
| `config_update` | `config` | `Config` | The new market configuration. |
| `terminal_price_update` | `price` | feed precision | The flat settlement price the call set or refreshed. |

`accrual_update` carries an empty data map, and it marks the poke only. Each administration call publishes its event on every success, including a call that leaves the stored value unchanged. `set_status` is the exception, because a same-status set traps with `InvalidStatus`.

Four payloads carry a stored row or a discriminant, and each is documented on the page of its type. The `Order` row is on [Orders](./orders.md). The `VaultOrder` row is on [Vault orders](./vault-orders.md). The `Config` struct is on [Config](./config.md). The `status` value is the `Status` discriminant, on [Market status](./status.md).

## Id `0` marks two receipts that have no stored order

`next_order_id` allocates order ids from `1` and never reuses one, so an id in a topic is never `0` for a stored order. Trade orders and vault orders draw from one counter for each account, so `user` and `id` name one order across both receipt families. Two receipts use `0` as a marker:

- `execute_adl` fills no order, so its `decrease_fill` or `close_fill` carries `id` `0`.
- A redeem created on a `Retired` market pays the user inside `create_vault_order`. It stores no row and publishes `redeem_fill` with `id` `0`, `keeper` set to the user who redeems, `fee` `0`, and `net_pnl` `0`. That path publishes no `create_vault_order`.

## Receipts and transfers follow a fixed order

The events of one call arrive in the order the contract publishes them. Three sequences around a closure sweep are fixed:

- `execute_order` on a full close publishes `close_fill` first, then one `cancel_order` for each swept sibling.
- `execute_liquidation` publishes the swept `cancel_order` events first, then `liquidation`.
- `execute_adl` on a full close publishes the swept `cancel_order` events first, then `close_fill`.

`execute_order`, `execute_liquidation`, `execute_adl`, and a filled `execute_vault_order` publish their receipts before `Settlement::settle` runs. The transfers of that settlement, and the events those transfers publish, follow the market's own receipts. A negative vault leg draws from the vault first, and the vault publishes `StrategyWithdraw` for the draw. The payouts follow. [Strategy withdraw](../vault/strategy-withdraw.md) gives that event. The redeemer's net payout is the `trader` leg, so it transfers after `redeem_fill`. A swept escrow refund also joins the `trader` leg, so it transfers after its own `cancel_order`. [Fees and settlement](./fee-system.md) gives the legs.

A vault fill moves its vault tokens before its receipt. `deposit_fill` follows the `strategy_deposit` transfer into the vault and the vault's `Deposit` event. `redeem_fill` follows the `strategy_redeem` draw and the vault's `Withdraw` event. A rejected vault order refunds its principal, then publishes `reject_vault_order`, then settles the `exec_fee` to the keeper.

Six calls transfer before they publish their own receipt:

- `cancel_order` returns the escrow refund first.
- `cancel_vault_order` returns the escrowed principal and the `exec_fee` first.
- `claim_credit` pays the credit first.
- `create_vault_order` escrows the principal and the `exec_fee` first, except a redeem on a `Retired` market, which pays the user inside the call first.
- `create_order` transfers the escrow first when `Order::escrow_amount` is above zero.
- `set_status` into `Retired` sweeps a positive credit-pool surplus to the vault before `status_update`.

A `cancel_order` swept by an `execute_order`, `execute_liquidation`, or `execute_adl` call is the exception. Its refund joins the settlement and transfers after the event. `set_config`, `set_terminal_price`, `update_adl_state`, and `accrue` move no tokens.

A partial fill sweeps no resting order, so a `decrease_fill` on a position that survives comes with no `cancel_order`.

## Ownership events

The market carries the Ownable module, which publishes three events under the same layout rule. Each carries one topic, the name symbol, and every field sits in the data map. The oracle, factory, treasury, and governance contracts publish the same three from their own address.

```rust
#[contractevent]
pub struct OwnershipTransfer {
    pub old_owner: Address,
    pub new_owner: Address,
    pub live_until_ledger: u32, // 0 on a cancel
}

#[contractevent]
pub struct OwnershipTransferCompleted {
    pub new_owner: Address,
}

#[contractevent]
pub struct OwnershipRenounced {
    pub old_owner: Address,
}
```

The topic symbols are `ownership_transfer`, `ownership_transfer_completed`, and `ownership_renounced`.
