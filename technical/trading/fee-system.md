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

If the position's side has more or equal open interest, `fee_dom` applies. If it has less, `fee_non_dom` applies. Dominance is evaluated at the time of the action (open or close), not at position creation.

### Price Impact Fee

$$
\text{impact\_fee} = \lceil \frac{\text{notional}}{\text{impact}} \rceil
$$

Where `impact` is the per-market divisor from `MarketConfig`. Uses ceiling division, always rounding up in favor of the protocol.

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

### On Market Order Open (User)

| Recipient | Amount |
|---|---|
| Treasury | `(base_fee + impact_fee) * treasury_rate / SCALAR_7` |
| Vault | `(base_fee + impact_fee) - treasury_fee` |
| Keeper | `0` (no keeper involved) |

Only base and impact fees apply at open (no borrowing or funding yet).

### On Position Close (User)

| Recipient | Amount |
|---|---|
| User | `max(equity, 0)` where `equity = col + pnl - total_fee` |
| Treasury | `protocol_fee * treasury_rate / SCALAR_7` |
| Vault | `col - user_payout - treasury_fee` |
| Keeper | `0` (no keeper involved) |

If the vault transfer is negative (user profited), the vault pays via `strategy_withdraw`.

### On Keeper Execution (Fill, TP, SL)

| Recipient | Amount |
|---|---|
| User | `max(equity, 0)` |
| Treasury | `protocol_fee * treasury_rate / SCALAR_7` |
| Keeper | `trading_fee * caller_rate / SCALAR_7` |
| Vault | `col - user_payout - treasury_fee - caller_fee` |

The keeper earns a share of trading fees (base + impact), not of borrowing or funding.

### On Liquidation (Keeper)

| Recipient | Amount |
|---|---|
| Treasury | `revenue * treasury_rate` where `revenue = min(protocol_fee + liq_fee, col)` |
| Keeper | `min(trading_fee + liq_fee, col) * caller_rate / SCALAR_7` |
| Vault | `col - treasury_fee - caller_fee` |
| User | `0` (all collateral redistributed) |

`liq_fee = max(equity, 0)` is the remaining equity at liquidation time. Treasury receives a share of the total revenue (protocol fees + liquidation fee). No PnL settlement occurs for the user.

## Limit Order Fee Handling

When a limit order is placed, the user's collateral is transferred upfront. At fill time, fees are computed based on the position's dominance at that moment. If the position is non-dominant, the fee difference is implicitly absorbed as additional collateral. This ensures the contract always has sufficient funds at fill time without requiring additional user authorization.

## Treasury Rate

The protocol fee rate is fetched from the treasury contract via a cross-contract call (`TreasuryClient::get_rate()`) on every trade. This allows the protocol to adjust fees dynamically without redeploying or reconfiguring the trading contract.
