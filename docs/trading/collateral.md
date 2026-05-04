---
sidebar_position: 2
title: Collateral
---

# Collateral

Upon opening a position, users deposit collateral to protect the vault from exposure if the trade takes a loss. After opening, users can still deposit and withdraw collateral to manage their position. As can be read [here](./liquidation.md), the higher the collateral, the lower the risk of liquidation (and vice versa). Note: at the opening of a position, the collateral is subject to the following lower bound:

$$
collateral \geq margin \times notionalSize
$$

The `margin` (initial margin) is set per market and determines the maximum leverage. The exact settings per asset can be seen [here](../markets/supported-assets.md).

**Collateral token**

The underlying collateral for a vault is the so-called 'vault token'. This means that the token that is accepted as collateral depends solely on the vault, and not on the asset that you're trading on.
