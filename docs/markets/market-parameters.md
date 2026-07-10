---
sidebar_position: 2
title: Market Parameters
---

# Market Parameters

Each market on Zenex is a standalone trading contract with its own **Config**. The Config holds every tunable value that controls fees, leverage, risk limits, and the interest curves for that market. Because each market is its own contract, these are **per-market parameters** that can be adjusted over time: what you see below is configured independently for every deployed pair.

The values themselves depend on the asset's liquidity and volatility, so this page describes what each group of parameters does. The live values for any market can always be read from its contract, material changes flow through the protocol's [parameter-change process](../governance/parameter-changes.md), and the [current testnet values](#current-testnet-values) are listed at the end of this page.

### Sizing and Trade Fees

- **Position size bounds**: a minimum and maximum notional size for a position, and a per-side open-interest ceiling that caps how large the long or short book can grow.
- **Order dust floors**: a minimum order notional and a minimum order collateral, below which an order is rejected so tiny fills cannot spam the book.
- **Skew-split trade fee**: two base fee rates, one for the side that worsens the market's long/short imbalance and an equal or lower one for the side that improves it. The [trade fee](../trading/fees.md) is charged pro-rata across the size a fill moves.
- **Impact scalar**: sets the [price impact fee](../trading/fees.md), charged on every fill at a rate that grows with the fill's size and caps at 10%. A larger scalar means a gentler curve and a smaller fee.
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

The **initial margin** and **maintenance margin** together define the leverage envelope: the initial margin caps leverage at entry, and the maintenance margin sets how far a position can deteriorate before [liquidation](../trading/liquidation.md). The **skew-split trade fee** and **impact fee** combine into the total cost of a fill: the trade fee rewards trades that balance the book, and the impact fee makes large fills pay a higher rate than small ones. The **borrowing** and **funding** curves work against utilization and skew respectively, compensating the vault for reserved liquidity and nudging the long/short book back toward balance.

### Current Testnet Values

The testnet deployment currently lists a single **XLM** market, settled in USDC, with the starting configuration below. Every value is a per-market parameter and can change through the [parameter-change process](../governance/parameter-changes.md), so the market's contract is always the source of truth.

| Parameter | Value |
|---|---|
| Maximum leverage | 100x (1% initial margin) |
| Maintenance margin | 0.75% of notional |
| Liquidation fee rate | 0.5% of notional |
| Trade fee | 0.06% on the imbalance-worsening side, 0.04% on the improving side |
| Impact scalar | 100,000 USDC (a 1,000 USDC fill pays a 1% impact fee) |
| Keeper share of fees | 10% |
| Position size | 20 to 1,000,000 USDC notional |
| Per-side open interest cap | 10,000,000 USDC |
| Minimum order | 2 USDC notional and 2 USDC collateral |
| Fresh-size decrease lock | 30 seconds |
| Utilization caps | 80% for opens, 90% for vault withdrawals |
| Borrowing interest | about 2.5% per year at the 50% target utilization, rising to about 15% per year at full utilization |
| Funding rate cap | about 25% per year in either direction |
| ADL thresholds | arms at 50% of half the vault balance, deleverages back to 40% |
| Profit-haircut threshold | 90% on the same measure |
| Vault fill fee | 0.1% |
| Minimum vault deposit | 10 USDC |
| Redeem cooldown | 60 seconds |
| Withdraw PnL gate | 15% |
| Vault balance cap | 10,000,000 USDC |
| Order execution fee | flat per-order keeper fee, read from the market's contract |

One fee parameter lives outside the per-market table. The treasury's share of protocol fees is a single protocol-wide rate stored on the treasury contract shared by every market deployed through the factory, and that contract is the source of truth for its current value.
