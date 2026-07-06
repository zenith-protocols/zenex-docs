---
sidebar_position: 3
title: Market Parameters
---

# Market Parameters

Each market on Zenex is a standalone trading contract with its own **Config**. The Config holds every tunable value that controls fees, leverage, risk limits, and the interest curves for that market. Because each market is its own contract, these parameters are set **per market by governance** and can be adjusted over time. There are no protocol-wide parameters that apply across markets: what you see below is configured independently for every deployed pair.

The values themselves depend on the asset's liquidity and volatility, so this page describes what each group of parameters does rather than quoting specific numbers. The live values for any market can always be read from its contract, and material changes flow through the [governance](../governance/parameter-changes.md) process.

### Sizing and Trade Fees

- **Position size bounds**: a minimum and maximum notional size for a position, and a per-side open-interest ceiling that caps how large the long or short book can grow.
- **Order dust floors**: a minimum order notional and a minimum order collateral, below which an order is rejected so tiny fills cannot spam the book.
- **Skew-split trade fee**: two base fee rates, one for the side that worsens the market's long/short imbalance and a lower one for the side that improves it. The [trade fee](../trading/fees.md) is charged pro-rata across the size a fill moves.
- **Impact fee divisor**: sets the [price impact fee](../trading/fees.md), charged only on the portion of a trade that pushes the book further out of balance. A larger divisor means a smaller impact fee.
- **Keeper rate**: the keeper's share of the trade fee, paid to whoever fills the order.

### Utilization Caps

- **Open utilization cap**: the fraction of vault liquidity that open positions may reserve. It also serves as the denominator for the borrowing curve.
- **Withdraw utilization cap**: a higher cap that governs vault withdrawals, ensuring a minimum of liquidity always remains to back open positions.

### Margin and Leverage

- **Initial margin**: the collateral required to open, expressed as a fraction of notional. Maximum [leverage](../trading/leverage.md) is one divided by the initial margin.
- **Maintenance margin**: the hard [liquidation](../trading/liquidation.md) floor, always lower than the initial margin. The gap between the two is the safety buffer before a position becomes liquidatable.
- **Liquidation fee**: the fee taken at liquidation, which also sets the boundary between a soft liquidation (remaining equity returned to the trader) and a hard one (remaining equity forfeited to the vault).

### Position Lifecycle Lock

- **Notional lock**: a short period, measured in seconds, during which newly added size cannot be decreased or closed. A further increase folds into the live lock and resets its deadline. This blocks same-block open-and-close games around fees and funding.

### Borrowing Curve (Kink Model)

- **Target utilization (the kink)**: the utilization point where the borrowing rate steepens.
- **Base borrowing rate**: the per-second rate applied below the kink.
- **Increased borrowing rate**: the steeper rate the curve reaches at full utilization. Both sides of the book pay the same kink rate, since open interest on either side reserves vault capacity. See [Borrowing Interest](../trading/borrowing-interest.md).

### Funding Curve (Velocity Model)

- **Funding increase and decrease rates**: how fast the [funding rate](../trading/funding-rate.md) accelerates toward the dominant side, and how fast it decays back toward zero.
- **Stable and decrease thresholds**: the skew levels that decide whether funding accelerates, holds, or decays.
- **Funding minimum and maximum**: a floor on the charged funding magnitude and a hard cap on the stored rate.

### ADL and Profit Risk

- **ADL thresholds**: the winning-side profit level (relative to the vault) that arms [auto-deleveraging](../trading/liquidation.md), and the lower target it deleverages back toward.
- **Profit-haircut threshold**: the profit level at which a closing winner's realized gain is scaled down, with the withheld share retained by the vault.

### Vault-Order Parameters

- **Vault fee**: the fee taken on each deposit or redeem fill, split between keeper, treasury, and vault.
- **Deposit and redeem cooldowns**: minimum wait periods before a queued deposit or redeem can fill.
- **Instant-deposit tolerance**: how close to fair value shares must be for a deposit to skip the cooldown.
- **Deposit and withdraw PnL gates**: limits on share mispricing that block deposits or redeems while pending trader PnL would let them snipe or drain the pool.
- **Minimum deposit** and **maximum vault balance**: the smallest deposit that clears, and the ceiling on total vault balance.

### How Parameters Interact

The **initial margin** and **maintenance margin** together define the leverage envelope: the initial margin caps leverage at entry, and the maintenance margin sets how far a position can deteriorate before [liquidation](../trading/liquidation.md). The **skew-split trade fee** and **impact fee** combine into the total cost of a fill, and both reward trades that balance the book over trades that unbalance it. The **borrowing** and **funding** curves work against utilization and skew respectively, compensating the vault for reserved liquidity and nudging the long/short book back toward balance.
