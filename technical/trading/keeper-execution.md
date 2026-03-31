---
sidebar_position: 8
title: Keeper Execution
---

# Keeper Execution

The keeper system enables permissionless execution of limit order fills, stop-loss/take-profit triggers, and liquidations. Any address can call the `execute` function and earn fees for performing these actions.

## Batch Processing

`execute(caller, requests, price_data) -> Vec<u32>`

The `execute` function processes a batch of requests in a single transaction. All price feeds are verified once at the start and cached in an `ExecuteContext`, amortizing the cost of the cross-contract call to the price verifier. The contract must not be `Frozen`.

Each request is processed independently. Errors are captured as error codes in the return vector and do not abort the batch. All token transfers are aggregated across the batch and settled at the end.

### ExecuteContext

The `ExecuteContext` caches the verified price map (`Map<u32, (i128, i128)>` mapping feed_id to price and price_scalar), the trading config reference, token and vault addresses, the treasury address, and the accumulated `ProcessingResult` for transfers. This avoids repeated storage reads across multiple requests in the same batch.

## Request Types

```rust
pub enum ExecuteRequest {
    Fill(u32),        // Position ID: fill a pending limit order
    StopLoss(u32),    // Position ID: trigger stop-loss
    TakeProfit(u32),  // Position ID: trigger take-profit
    Liquidate(u32),   // Position ID: liquidate an underwater position
}
```

## Non-Atomic Error Handling

Individual request failures return error codes in the result vector instead of panicking:

| Error Code | Meaning |
|---|---|
| `0` | Success |
| `733` | Position already filled (for Fill requests) |
| `744` | Take-profit not triggered (price has not reached TP) |
| `745` | Stop-loss not triggered |
| `746` | Position not liquidatable (equity above maintenance) |
| `747` | Limit order not fillable (price has not reached limit) |
| `748` | Position too new (`min_open_time` not elapsed) |
| `750` | Action not allowed for position status (e.g., trying to SL a pending order) |

Contract-wide errors (Frozen status, price not found) do panic and abort the entire batch.

## Settlement Ordering

The batch aggregates all transfers into a `ProcessingResult` containing a transfer map (address to amount). Settlement follows a specific order: the vault pays first if its net transfer is negative (vault owes money), with `strategy_withdraw` called to bring tokens into the trading contract. Then all outbound transfers are paid (keeper fees, user payouts, treasury fees, user refunds). Finally, if the vault's net transfer is positive (vault gains), tokens are transferred to the vault. This ordering prevents balance shortfalls within the trading contract during batch settlement.

## Keeper Fee

Keepers earn a percentage of total fees on each successful action:

$$
\text{caller\_fee} = (\text{total\_fee} - \text{protocol\_fee}) \times \frac{\text{caller\_take\_rate}}{\text{SCALAR\_7}}
$$

The caller fee is deducted from the vault's share, not from the user. On liquidation, `caller_fee = min(total_fee * caller_take_rate, collateral)`. The caller fee cannot exceed the vault transfer amount.

## Price Staleness

Keeper actions use a relaxed staleness threshold of `MAX_STALENESS_KEEPER = 300` seconds (5 minutes), compared to `MAX_STALENESS_USER = 60` seconds (1 minute) for user actions. This accounts for the delay between price publication and keeper transaction submission.

## No Authentication Required

The `execute` function does not require the caller to authenticate. Any address can submit keeper requests and receive the `caller_take_rate` percentage of fees. This is an intentional design choice that creates a competitive, permissionless keeper network where anyone can participate.

The `caller` address parameter determines who receives the keeper fee. The caller does not need to be related to the position owner.
