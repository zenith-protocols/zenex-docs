---
sidebar_position: 2
title: Leverage
---

# Leverage

By using leverage, users can amplify their position with borrowed funds. This increases potential profit, but also potential losses and liquidation risk. Users are therefore advised to use leverage responsibly, and monitor highly leveraged positions carefully.

**How leverage works**

When opening a position with leverage, the user essentially borrows funds from the protocol to amplify his own exposure. For example: A user can open a position with a notional size of \$100, but only deposit a collateral of \$10. The user then effectively 'borrows' \$90 from the vault. If the price increases with 10% and the user closes the position, the payout is \$10 plus the collateral, and the \$90 is returned to the vault. In this case the user has doubled the \$10 collateral, after only a 10% change in the price. However, a 10% price shift the other way would have led to the user losing all the collateral.

**Leverage limits**

Currently the maximum leverage when opening a position on Zenex is 100x. This is achieved through the initial margin and maintenance margin. It works as follows: Upon opening a position, the following condition has to be satisfied:

$$
collateral >initialMargin*notionalSize
$$

So if the initial margin is 0.01, the collateral has to be at least 1% of the notional size, and thus users can only have up to 100x leverage. After the position is opened, the maximum leverage is governed by the maintenance margin, fee buffer and PnL as described [here](./liquidation.md).
