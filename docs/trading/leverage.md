---
sidebar_position: 5
title: Leverage
---

# Leverage

By using leverage, users can amplify their position with capital from the vault. This increases potential profit, but also potential losses and liquidation risk. Users are therefore advised to use leverage responsibly, and monitor highly leveraged positions carefully.

**How leverage works**

When opening a position with leverage, the user effectively draws on the vault to amplify their own exposure. For example: a user opens a position with a notional size of \$100, but posts only \$10 of collateral. The remaining \$90 of exposure is backed by the vault. If the price rises 10% and the user closes the position, they receive their \$10 collateral plus \$10 of profit, and the vault is made whole. In this case the user has doubled the \$10 collateral after only a 10% move in the price. A 10% move the other way would instead wipe out the collateral.

**Initial margin and maximum leverage**

The maximum leverage depends on the market's initial margin parameter, which is set per market by governance. When opening or increasing a position, your collateral must be at least the initial margin's share of the notional size.

For example, a market with a 1% initial margin requires at least 10 USDC of collateral behind a 1,000 USDC position, so the most leverage available is 100x. A market with a 5% initial margin instead requires at least 50 USDC of collateral behind that same 1,000 USDC position, capping leverage at 20x. Different markets set different initial margins, so the leverage ceiling varies by market.

**Initial versus maintenance margin**

Two margin levels govern a position. The initial margin is the floor checked when you open or increase: your collateral, measured before any unrealized profit or loss, must cover it. The maintenance margin is a lower floor checked against your live equity (collateral plus unrealized PnL). It is the hard line for liquidation, and it is always set below the initial margin. The gap between the two is the buffer that absorbs adverse price moves and accruing costs before a position becomes liquidatable. How the maintenance margin drives liquidation is described [here](./liquidation.md).

Higher leverage means a smaller buffer and greater sensitivity: the same price move consumes a larger share of a thinly collateralized position's equity, so a highly leveraged position reaches its maintenance margin after a smaller adverse move. After a position is open, its effective leverage drifts with accrued fees and PnL, which is why it pays to monitor and top up collateral when needed.
