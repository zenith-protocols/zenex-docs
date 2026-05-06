---
sidebar_position: 4
title: Fee System
---

# Fee System

Fees are charged on every position open and close. They flow to three recipients: the vault (liquidity providers), the treasury (protocol), and keepers (execution incentive).

## Fee Components

### Base Fee

The base fee depends on which side of the market the position is on:

$$
\text{base\_fee} = \text{notional} \times \frac{\text{base\_fee\_rate}}{\text{SCALAR\_7}}
$$

Dominance is evaluated against the **post-action** market state, not the pre-action state. The contract calls `is_dominant(side, notional)` with the position's notional added (on open) or removed (on close), then checks whether that side ends up strictly larger than the other.

| Action | Pays `fee_dom` when | Pays `fee_non_dom` when |
|---|---|---|
| Open | Your side is strictly larger after the position is added | Your side is equal or smaller after the add |
| Close | Your side is no longer strictly larger after the position is removed | Your side is still strictly larger after the removal |

This means a position opened on the current minority side can still pay `fee_dom` if it is big enough to flip dominance. A close from the dominant side that leaves the side dominant pays `fee_non_dom` (it reduced imbalance).

`fee_dom` and `fee_non_dom` are SCALAR_7 fractions of notional, bounded by `MAX_FEE_RATE = 100_000` (1%).

### Price Impact Fee

$$
\text{impact\_fee} = \lfloor \frac{\text{notional}}{\text{impact}} \rfloor
$$

Where `impact` is the per-market divisor from `MarketConfig`. Charged on every open and every close. Floor division means orders with `notional < impact` round down to zero impact fee, so most small trades effectively pay only the base fee.

### Funding

Accumulated funding cost or credit since the position was filled:

$$
\text{funding} = \text{notional} \times \frac{\text{current\_fund\_idx} - \text{entry\_fund\_idx}}{\text{SCALAR\_18}}
$$

Positive funding represents a cost to the position (position paid funding). Negative funding represents a credit (position received funding). Funding is purely peer-to-peer: 100% flows between longs and shorts with no protocol cut. See [Funding Rate](./funding-rate.md) for how indices are computed.

### Borrowing Fee

Accumulated borrowing cost since the position was filled:

$$
\text{borrowing\_fee} = \text{notional} \times \frac{\text{current\_borr\_idx} - \text{entry\_borr\_idx}}{\text{SCALAR\_18}}
$$

Borrowing fees are always non-negative and accrue only to the dominant side of the market. The borrowing rate is an additive dual-utilization curve:

$$
\text{rate} = \text{r\_base} + \text{r\_var} \times \text{util\_vault}^5 + \text{r\_var\_market} \times \text{util\_market}^3
$$

Where `r_base` and `r_var` are global parameters (TradingConfig), and `r_var_market` is per-market (MarketConfig). The vault term uses a quintic curve (gentle at low utilization, aggressive near capacity) and the market term uses a cubic curve (reacts faster to per-market congestion).

### Total Fee

$$
\text{total\_fee} = \text{base\_fee} + \text{impact\_fee} + \text{funding} + \text{borrowing\_fee}
$$

### Protocol Fee

Protocol revenue excludes funding (which is peer-to-peer):

$$
\text{protocol\_fee} = \text{base\_fee} + \text{impact\_fee} + \text{borrowing\_fee}
$$

Treasury receives a cut of `protocol_fee`. Keepers receive a cut of `trading_fee` (base + impact only).

## Fee Distribution

Every settlement uses the same shape. Three constants are computed and the vault gets whatever is left:

```
treasury_fee = protocol_fee * treasury_rate / SCALAR_7
caller_fee   = trading_fee  * caller_rate   / SCALAR_7   // zero if user-initiated
user_payout  = max(equity, 0)                            // zero on opens / fills / liquidations
vault        = col - user_payout - treasury_fee - caller_fee
```

Two orthogonal axes decide which terms are non-zero on a given event:

- **Closes** (self close, TP, SL) settle PnL. They pay a `user_payout` and add accrued borrowing into `protocol_fee`. Opens and fills set `user_payout = 0` and have no borrowing yet, so `protocol_fee = base + impact` on those.
- **Keeper-initiated events** (limit fill, TP / SL close) pay a `caller_fee` cut from the trading fee. User-initiated events (market open, self close) set `caller_fee = 0`.

If `vault` is negative on a close (user profited), the vault pays via `strategy_withdraw`. The keeper's share is always cut from the trading fee (`base + impact`), never from funding or borrowing.

### Liquidation

Liquidation is structurally different because the liquidation fee is added to the keeper and treasury cuts:

```
liq_fee      = max(equity, 0)                                // remaining equity at liq time
revenue      = min(protocol_fee + liq_fee, col)
treasury_fee = revenue                       * treasury_rate / SCALAR_7
caller_fee   = min(trading_fee + liq_fee, col) * caller_rate / SCALAR_7
vault        = col - treasury_fee - caller_fee
user_payout  = 0
```

No PnL is settled for the user; all collateral is redistributed.
| User | `0` (all collateral redistributed) |

`liq_fee = max(equity, 0)` is the remaining equity at liquidation time. Treasury receives a share of the total revenue (protocol fees + liquidation fee). No PnL settlement occurs for the user.

## Limit Order Fee Handling

When a limit order is placed, the user's full collateral is transferred to the contract with no fee deduction. Fees are computed and deducted from collateral at fill time via `ctx.open()`, based on the position's dominance at that moment. This means limit orders have no fee cost until they are actually filled by a keeper.

## Treasury Rate

The protocol fee rate is fetched from the treasury contract via a cross-contract call (`TreasuryClient::get_rate()`) on every trade. This allows the protocol to adjust fees dynamically without redeploying or reconfiguring the trading contract.
