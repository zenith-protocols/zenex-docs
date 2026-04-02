---
sidebar_position: 8
title: Auto-Deleveraging
---

# Auto-Deleveraging (ADL)

ADL is the protocol's last-resort mechanism to prevent vault insolvency. When the vault cannot cover the net liability of winning positions, ADL proportionally reduces all winning-side positions across all markets.

## When ADL Triggers

ADL is triggered by the permissionless `update_status` function when the contract is in `OnIce` or `AdminOnIce` status (not `Active` or `Frozen`), the utilization threshold (`UTIL_ACTIVE = 90%`) is still exceeded, and there is an actual deficit where `net_liability > vault_balance`. If the threshold is no longer exceeded, the contract returns to `Active` instead.

## Two-Pass Algorithm

### Pass 1: Aggregate PnL Computation

For each market, aggregate PnL is computed without iterating individual positions, using the `entry_wt` fields:

$$
\text{long\_pnl} = \text{price} \times \frac{\text{l\_entry\_wt}}{\text{price\_scalar}} - \text{l\_notional}
$$

$$
\text{short\_pnl} = \text{s\_notional} - \text{price} \times \frac{\text{s\_entry\_wt}}{\text{price\_scalar}}
$$

The `entry_wt` sum (`sum(notional_i / entry_price_i)`) represents the aggregate "quantity" of positions. Multiplying by the current price gives the current value, and subtracting the original notional gives the aggregate PnL.

From these values, `total_winner_pnl` is the sum of all positive-side PnL across all markets, and `total_loser_pnl` is the absolute value of all losing-side PnL. The `net_liability = total_winner_pnl - total_loser_pnl`. If `net_liability <= vault_balance`, ADL is not needed and a `NoDeficit` error is returned.

### Pass 2: Apply Reduction

$$
\text{deficit} = \text{net\_liability} - \text{vault\_balance}
$$

$$
\text{reduction\_pct} = \min\left(\frac{\text{deficit}}{\text{total\_winner\_pnl}},\ 1.0\right)
$$

$$
\text{factor} = 1.0 - \text{reduction\_pct}
$$

For the winning side in each market:

```text
l_notional (or s_notional) *= factor
l_entry_wt (or s_entry_wt) *= factor
l_adl_idx (or s_adl_idx) *= factor
```

Emits `ADLTriggered { reduction_pct, deficit }`.

## Lazy Position Application

ADL modifies market-level aggregates only. Individual position records in storage are not touched. Each position detects its ADL reduction at close time:

$$
\text{effective\_notional} = \text{notional} \times \frac{\text{current\_adl\_idx}}{\text{entry\_adl\_idx}}
$$

The ADL index starts at `SCALAR_18` (`10^18`) for every new market. When ADL occurs, the winning side's index is multiplied by `factor` (which is less than 1.0). A position opened before ADL has `adl_idx = SCALAR_18`. After ADL with `factor = 0.9`, `current_adl_idx = 0.9 * SCALAR_18`, so on close the effective notional is `notional * 0.9`. A position opened after ADL snapshots the already-reduced index, so its effective notional is unaffected by past ADL events.

## Compounding

Multiple ADL events compound correctly because the index is a running product:

```text
After ADL 1 (factor 0.9): adl_index = SCALAR_18 * 0.9
After ADL 2 (factor 0.8): adl_index = SCALAR_18 * 0.9 * 0.8 = SCALAR_18 * 0.72
```

A position opened before both events has `effective_notional = notional * 0.72`. A position opened between the events has `effective_notional = notional * 0.8`. A position opened after both has `effective_notional = notional * 1.0`.

## Circuit Breaker Hysteresis

The circuit breaker uses a 5% hysteresis band to prevent oscillation:

| Transition | Threshold | Condition |
|---|---|---|
| Active to OnIce | 95% (`UTIL_ONICE`) | `net_pnl >= vault_balance * 0.95` |
| OnIce to Active | 90% (`UTIL_ACTIVE`) | `net_pnl < vault_balance * 0.90` |
| OnIce to ADL | 90% still met + deficit | `net_liability > vault_balance` |

When `OnIce`, no new positions can be opened, reducing the rate at which the vault's exposure grows. Existing positions can still be managed (closed, collateral modified), which helps reduce utilization organically.

## Design Rationale

ADL uses market-level aggregates, making it O(markets) rather than O(positions). This is critical for gas efficiency on Soroban. Individual positions are not modified in storage, avoiding the cost of touching every position record. All winning-side positions are reduced equally by percentage, ensuring fairness. The reduction percentage is capped at 1.0 to prevent negative notional values.
