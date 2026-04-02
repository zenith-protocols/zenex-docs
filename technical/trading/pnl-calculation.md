---
sidebar_position: 3
title: PnL Calculation
---

# PnL Calculation

## Formula

PnL is computed as the position's notional value change based on entry and exit prices.

For a **long** position:

$$
\text{pnl} = \text{notional} \times \frac{\text{current\_price} - \text{entry\_price}}{\text{entry\_price}}
$$

For a **short** position:

$$
\text{pnl} = \text{notional} \times \frac{\text{entry\_price} - \text{current\_price}}{\text{entry\_price}}
$$

In fixed-point arithmetic:

```text
price_diff = current_price - entry_price    // (long)
price_diff = entry_price - current_price    // (short)

price_change_ratio = price_diff * price_scalar / entry_price   // floor division
pnl = notional * price_change_ratio / price_scalar             // floor division
```

Where `price_scalar = 10^(-exponent)`. For Pyth's standard exponent of `-8`, `price_scalar = 10^8`.

Both divisions use floor rounding (`fixed_div_floor`, `fixed_mul_floor`), which slightly favors the vault on rounding errors.

## Example

A 10x long on BTC with $1,000 collateral, entry at $100,000, close at $110,000:

```text
notional = 10,000 (in token units, e.g., 10,000 USDC)
price_diff = 110,000 - 100,000 = 10,000
price_change_ratio = 10,000 * 100,000,000 / 100,000 = 10,000,000  (= 0.1 in price_scalar)
pnl = 10,000 * 10,000,000 / 100,000,000 = 1,000 USDC
```

User profit: $1,000 (10% return on notional, 100% return on collateral before fees).

## Equity and Payout

After PnL is computed, equity and payout are derived:

$$
\text{equity} = \text{col} + \text{pnl} - \text{total\_fee}
$$

Where `total_fee = base_fee + impact_fee + funding + borrowing_fee` (see [Fee System](./fee-system.md)).

The user payout is:

$$
\text{user\_payout} = \max(\text{equity},\ 0)
$$

If equity is negative, the user receives nothing and the vault absorbs the loss.

## Vault Transfer

The vault transfer represents the net flow between the trading contract and the vault:

$$
\text{vault\_transfer} = \text{col} - \text{user\_payout} - \text{treasury\_fee}
$$

A positive vault transfer means the user lost money and the collateral remainder flows to the vault. A negative vault transfer means the user profited and the vault must pay the difference via `strategy_withdraw`. The treasury fee is `protocol_fee * treasury_rate`, where `protocol_fee = base_fee + impact_fee + borrowing_fee`.

## ADL Adjustment

If Auto-Deleveraging has occurred since the position was opened, the position's effective notional is reduced before PnL computation:

$$
\text{effective\_notional} = \text{notional} \times \frac{\text{current\_adl\_idx}}{\text{entry\_adl\_idx}}
$$

This proportionally reduces both the position's profit potential and risk exposure. See [Auto-Deleveraging](./auto-deleveraging.md).
