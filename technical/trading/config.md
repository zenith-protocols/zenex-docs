---
sidebar_position: 13
title: Config
---

# Config

The global `Config` is the instance-storage singleton holding every tunable trading parameter: fees, margins, locks, caps, and the borrowing and funding curves. It is set in full at deployment (a constructor argument) and replaced wholesale by the owner-gated `set_config`. Fractional values are `SCALAR_18`, rate parameters are per second, and amounts are token decimals (token-dec).

```rust
#[contracttype]
pub struct Config {
    // --- sizing and fees ---
    pub keeper_rate: i128,           // keeper share of trade and vault fill fees (SCALAR_18)
    pub min_position_notional: i128, // minimum position notional, token-dec
    pub max_position_notional: i128, // maximum position notional, token-dec
    pub max_open_interest: i128,     // per-side open-interest ceiling, token-dec; >= max_position_notional
    pub min_order_notional: i128,    // minimum |notional| per order, token-dec (dust floor); <= min_position_notional
    pub min_order_collateral: i128,  // minimum |collateral| per order, token-dec (dust floor)
    pub exec_fee: i128,              // flat keeper execution fee escrowed per order at creation, token-dec
    pub fee_dom: i128,               // dominant-side trade fee (SCALAR_18)
    pub fee_non_dom: i128,           // non-dominant trade fee (SCALAR_18)
    pub impact_scalar: i128,         // impact fee = notional * min(notional / impact_scalar, MAX_IMPACT_RATE); every fill (token-dec)

    // --- utilization caps (SCALAR_18; util = open interest / vault) ---
    pub max_util_open: i128,     // opens blocked above this; also each side's borrow-reserve denominator (side capacity = max_util_open * vault / 2)
    pub max_util_withdraw: i128, // withdrawals blocked above this; >= max_util_open

    // --- margin ---
    pub init_margin: i128,        // initial margin; max leverage = 1/init_margin (SCALAR_18)
    pub maintenance_margin: i128, // hard liquidation floor, < init_margin (SCALAR_18)
    pub liq_fee: i128,            // liquidation fee (SCALAR_18)

    // --- position lifecycle ---
    pub notional_lock: u64, // decrease lock on newly added notional, seconds

    // --- borrowing (kink model over reserve utilization) ---
    pub target_util: i128,           // kink utilization on the normalized [0,1] reserve curve (SCALAR_18); < 1
    pub borrow_rate: i128,           // borrowing-rate slope below the kink (SCALAR_18, per second)
    pub increased_borrow_rate: i128, // borrowing rate at full utilization (SCALAR_18, per second); >= borrow_rate

    // --- funding velocity ---
    pub funding_increase: i128,           // velocity acceleration as skew widens (SCALAR_18, per second^2)
    pub funding_decrease: i128,           // velocity decay inside the decay band (SCALAR_18, per second^2)
    pub threshold_stable_funding: i128,   // skew band within which the rate holds (SCALAR_18)
    pub threshold_decrease_funding: i128, // skew band within which the rate decays (SCALAR_18); <= threshold_stable_funding
    pub funding_min: i128,                // charged-rate floor (SCALAR_18, per second)
    pub funding_max: i128,                // saved-rate hard cap (SCALAR_18, per second)

    // --- risk / ADL (each a side-pending-PnL factor of half the vault balance) ---
    pub adl_max_pnl: i128,      // ADL trigger that arms a side (SCALAR_18)
    pub adl_clear_target: i128, // ADL clear target on the same measure (SCALAR_18)
    pub max_pnl_trader: i128,   // realized-profit haircut threshold; also the per-side profit cap in share-pricing PnL (SCALAR_18)
    pub max_pnl_withdraw: i128, // redeem gate: redeems blocked while a side's pending PnL exceeds this fraction of half the post-redeem balance (SCALAR_18)

    // --- vault orders ---
    pub redeem_lock: u64,        // redeem cooldown from a vault order's created_at, seconds; 0 = fill as soon as a post-creation price exists
    pub deposit_fee: i128,       // deposit fill fee rate on moved assets (SCALAR_18)
    pub redeem_fee: i128,        // redeem fill fee rate on moved assets (SCALAR_18)
    pub min_deposit: i128,       // minimum assets per deposit vault order, checked at creation, token-dec
    pub max_vault_balance: i128, // vault balance ceiling enforced on deposit fills, token-dec
}
```

## Validation

The constructor and `set_config` validate the whole struct and trap on the first violated rule: `NegativeValueNotAllowed` (710) when any rate, fee, margin, threshold, or floor is negative, `InvalidConfig` (700) for everything below.

**Absolute bounds.**

| Field | Bound |
|---|---|
| `keeper_rate` | `<= MAX_KEEPER_RATE` (50%) |
| `fee_dom`, `fee_non_dom`, `deposit_fee`, `redeem_fee` | `<= MAX_FEE_RATE` (1%) |
| `impact_scalar` | `> 0` |
| `max_util_open`, `max_util_withdraw` | `<= MAX_UTIL` (1000%) |
| `init_margin` | in `[MIN_MARGIN, MAX_MARGIN]` (0.1% to 50%, so max leverage 2x to 1000x) |
| `liq_fee` | `<= MAX_LIQ_FEE` (25%) |
| `notional_lock` | in `[MIN_NOTIONAL_LOCK, MAX_NOTIONAL_LOCK]` (15 seconds to 1 day) |
| `redeem_lock` | `<= MAX_REDEEM_LOCK` (30 days) |
| `target_util` | `< SCALAR_18` (100%) |
| `increased_borrow_rate` | `<= MAX_BORROW_RATE` (1000% per year, expressed per second) |
| `funding_max`, `funding_increase`, `funding_decrease` | `<= MAX_FUNDING_RATE` (1000% per year, expressed per second) |
| `threshold_stable_funding` | `<= SCALAR_18` (skew is a fraction) |

The `notional_lock` floor exists so the decrease lock outlasts the price verifier's staleness window, otherwise an accepted stale price could open and close the same size. The shared funding bound keeps `funding_increase * elapsed` and `funding_decrease * elapsed` far from overflow, and a full-skew step of `MAX_FUNDING_RATE` per second already reaches any valid cap in one second.

**Ordering and shape.**

- Sizing: `0 < min_position_notional < max_position_notional <= max_open_interest`, so the per-side ceiling admits at least one maximum-size position.
- Dust floors: `min_order_notional > 0`, `min_order_collateral > 0`, and `min_order_notional <= min_position_notional`, else a minimum-size position could not be closed in one order.
- Trade fees: `fee_dom >= fee_non_dom`, the dominant side pays at least as much as the non-dominant side.
- Utilization: `0 < max_util_open <= max_util_withdraw`. The band between the two caps is withdrawal-only headroom that keeps a minimum of liquidity behind open positions.
- Margin ladder: `0 <= liq_fee < maintenance_margin < init_margin`. `liq_fee = 0` is a valid no-penalty configuration.
- Borrowing curve: `borrow_rate <= increased_borrow_rate`, the kink can only steepen.
- Funding: `threshold_decrease_funding <= threshold_stable_funding` (the decay band sits inside the stable band) and `funding_min <= funding_max`.
- Solvency ladder: `MIN_ADL_CLEAR` (40%) `<= adl_clear_target <= adl_max_pnl`, `MIN_ADL_TRIGGER` (45%) `<= adl_max_pnl <= max_pnl_trader < 100%`, and `0 < max_pnl_withdraw <= max_pnl_trader`. Every rung is a side-pending-PnL factor of half the vault balance. The clear target sits below the trigger for hysteresis, the trigger at or below the haircut threshold so ADL de-risks before the haircut engages, and the band floors keep a config change from arming ADL against modest open winners.
- Vault sizing: `min_deposit > 0`, `max_vault_balance > 0`, and `min_deposit * MIN_DEPOSIT_DIVISOR (100) <= max_vault_balance`, so raising the deposit floor can never block every fill.

## Applying Changes

`set_config` is owner-only and replaces the whole struct after validation. Two guards tie rate changes to accrual, so no parameter change can reprice an un-accrued interval:

- **Funding parameters** (`funding_increase`, `funding_decrease`, `threshold_stable_funding`, `threshold_decrease_funding`, `funding_min`, `funding_max`): funding accrual is price-free, so `set_config` first accrues funding to the current timestamp under the outgoing parameters, then applies the new values.
- **Borrowing parameters** (`target_util`, `borrow_rate`, `increased_borrow_rate`, and `max_util_open`, the borrow-reserve denominator): borrowing accrual is price-bearing and cannot run inside `set_config`, so the call requires a same-ledger `accrue`, else it traps `BorrowingNotAccrued` (703).

Every successful call emits `config_update` carrying the full new configuration. See [Events](./events.md).
