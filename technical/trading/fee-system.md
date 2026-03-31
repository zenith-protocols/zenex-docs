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

If the position's side has more or equal open interest, the `base_fee_dominant` rate applies. If it has less, the `base_fee_non_dominant` rate applies. Dominance is evaluated at the time of the action (open or close), not at position creation.

### Price Impact Fee

$$
\text{impact\_fee} = \lceil \frac{\text{notional}}{\text{price\_impact\_scalar}} \rceil
$$

Uses ceiling division, always rounding up in favor of the protocol.

### Funding

Accumulated funding cost or credit since the position was filled:

$$
\text{funding} = \text{notional} \times \frac{\text{current\_funding\_index} - \text{entry\_funding\_index}}{\text{SCALAR\_18}}
$$

Positive funding represents a cost to the position (position paid funding). Negative funding represents a credit (position received funding). See [Funding Rate](./funding-rate.md) for how indices are computed.

### Total Fee

$$
\text{total\_fee} = \text{base\_fee} + \text{impact\_fee} + \text{funding}
$$

### Vault Skim

Applies only when funding is negative (position received funding):

$$
\text{vault\_skim} = |\text{funding}| \times \frac{\text{vault\_skim\_rate}}{\text{SCALAR\_7}}
$$

The skim is capped at `user_payout` and is deducted before the user receives their payout.

## Fee Distribution

### On Market Order Open (User)

| Recipient | Amount |
|---|---|
| Treasury | `total_fee * treasury_rate / SCALAR_7` |
| Vault | `total_fee - protocol_fee` |
| Keeper | `0` (no keeper involved) |

### On Position Close (User)

| Recipient | Amount |
|---|---|
| Treasury | `min(total_fee * treasury_rate / SCALAR_7, vault_transfer)` |
| Vault | Remaining collateral after user payout and protocol fee |
| Keeper | `0` (no keeper involved) |

The protocol fee is capped at `vault_transfer` (the net amount flowing to the vault) to prevent paying more to the treasury than the vault received.

### On Keeper Execution (Fill, TP, SL)

| Recipient | Amount |
|---|---|
| Treasury | `total_fee * treasury_rate / SCALAR_7` |
| Keeper | `(total_fee - protocol_fee) * caller_take_rate / SCALAR_7` |
| Vault | `total_fee - protocol_fee - caller_fee` |

### On Liquidation (Keeper)

| Recipient | Amount |
|---|---|
| Treasury | `0` (no protocol fee on liquidation) |
| Keeper | `min(total_fee * caller_take_rate / SCALAR_7, collateral)` |
| Vault | `collateral - caller_fee` |

Liquidation distributes the position's remaining collateral. No PnL settlement occurs.

## Limit Order Fee Handling

When a limit order is placed, the user prepays the worst-case fee: `dominant_fee + impact_fee`, regardless of the market state at fill time.

At fill time, if the position is dominant, the prepaid fee matches and no adjustment is needed. If the position is non-dominant, the overpaid amount (`dominant_fee - non_dominant_fee`) is refunded to the user. This ensures the contract always has sufficient fee funds at fill time without requiring additional user authorization.

## Treasury Rate

The protocol fee rate is fetched from the treasury contract via a cross-contract call (`TreasuryClient::get_rate()`) on every trade. This allows the protocol to adjust fees dynamically without redeploying or reconfiguring the trading contract.
