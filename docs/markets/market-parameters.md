---
sidebar_position: 3
title: Market Parameters
---

# Market Parameters

Each market on Zenex is a standalone trading contract with its own **Config**. The Config holds every tunable value that controls fees, leverage, risk limits, and the interest curves for that market. Because each market is its own contract, these are **per-market parameters** that can be adjusted over time: what you see below is configured independently for every deployed pair.

The values themselves depend on the asset's liquidity and volatility, so this page describes what each group of parameters does rather than quoting specific numbers. The live values for any market can always be read from its contract, and material changes flow through the protocol's [parameter-change process](../governance/parameter-changes.md).

### Sizing and Trade Fees

- **Position size bounds**: a minimum and maximum notional size for a position, and a per-side open-interest ceiling that caps how large the long or short book can grow.
- **Order dust floors**: a minimum order notional and a minimum order collateral, below which an order is rejected so tiny fills cannot spam the book.
- **Skew-split trade fee**: two base fee rates, one for the side that worsens the market's long/short imbalance and an equal or lower one for the side that improves it. The [trade fee](../trading/fees.md) is charged pro-rata across the size a fill moves.
- **Impact fee divisor**: sets the [price impact fee](../trading/fees.md), charged only on the portion of a trade that pushes the book further out of balance. A larger divisor means a smaller impact fee.
- **Keeper rate**: the keeper's share of the trade fee, paid to whoever fills the order.
- **Execution fee**: a flat fee escrowed when any order (trade or vault) is created, paid to the keeper that fills it and refunded if the order is cancelled.

### Utilization Caps

- **Open utilization cap**: the fraction of its half of vault liquidity that each side's open positions may reserve. The same per-side capacity is the denominator for that side's borrowing curve.
- **Withdraw utilization cap**: a cap at least as high as the open cap that governs vault withdrawals, ensuring a minimum of liquidity always remains to back open positions.

### Margin and Leverage

- **Initial margin**: the collateral required to open, expressed as a fraction of notional. Maximum [leverage](../trading/margin-and-leverage.md) is one divided by the initial margin.
- **Maintenance margin**: the hard [liquidation](../trading/liquidation.md) floor, always lower than the initial margin. The gap between the two is the safety buffer before a position becomes liquidatable.
- **Liquidation fee**: sets the boundary between a soft liquidation and a hard one. If remaining equity covers the fee, the liquidation is soft, no fee is charged, and the equity returns to the trader. Below that line the fee is taken and the remainder is forfeited to the protocol.

### Position Lifecycle Lock

- **Notional lock**: a short period, measured in seconds, during which newly added size cannot be decreased or closed. A further increase folds into the live lock and resets its deadline. This blocks same-ledger open-and-close games around fees and funding.

### Borrowing Curve (Kink Model)

- **Target utilization (the kink)**: the utilization point where the borrowing rate steepens.
- **Base borrowing rate**: sets how fast the per-second rate climbs with utilization below the kink.
- **Increased borrowing rate**: the steeper rate the curve reaches at full utilization. Only the dominant side of the book pays borrowing interest, at a kink rate driven by that side's own utilization of its half of vault capacity. See [Borrowing Interest](../trading/borrowing-interest.md).

### Funding Curve (Velocity Model)

- **Funding increase and decrease rates**: how fast the [funding rate](../trading/funding-rate.md) accelerates toward the dominant side, and how fast it decays back toward zero.
- **Stable and decrease thresholds**: the skew levels that decide whether funding accelerates, holds, or decays.
- **Funding minimum and maximum**: a floor on the charged funding magnitude and a hard cap on the stored rate.

### ADL and Profit Risk

- **ADL thresholds**: the winning-side profit level (measured against half the vault balance, each side against its own half) that arms [auto-deleveraging](../trading/adl.md), and the target, at or below that level, it deleverages back toward.
- **Profit-haircut threshold**: the profit level, on the same half-vault measure, at which a closing winner's realized gain is scaled down, with the withheld share retained by the vault. The same threshold caps each side's pending profit when vault shares are priced at deposit and redeem fills.

### Vault-Order Parameters

- **Vault fee**: the fee taken on each deposit or redeem fill, split between keeper, treasury, and vault.
- **Redeem cooldown**: a minimum wait period, measured from when the redeem order was created, before a queued redeem can fill. Deposits have no cooldown and fill as soon as a fresh price is available.
- **Withdraw PnL gate**: blocks a redeem while either side's pending trader profit exceeds a set fraction of half the remaining vault balance, so a redeem cannot drain liquidity that open winners are owed. Deposits carry no equivalent gate because every deposit and redeem is priced against pending trader PnL at fill.
- **Minimum deposit** and **maximum vault balance**: the smallest deposit a vault order may queue, and the ceiling on total vault balance checked when a deposit fills. Redeems have no minimum, and a vault order always fills in full.

### How Parameters Interact

The **initial margin** and **maintenance margin** together define the leverage envelope: the initial margin caps leverage at entry, and the maintenance margin sets how far a position can deteriorate before [liquidation](../trading/liquidation.md). The **skew-split trade fee** and **impact fee** combine into the total cost of a fill, and both reward trades that balance the book over trades that unbalance it. The **borrowing** and **funding** curves work against utilization and skew respectively, compensating the vault for reserved liquidity and nudging the long/short book back toward balance.
