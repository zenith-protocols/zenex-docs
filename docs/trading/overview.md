---
sidebar_position: 1
title: Trading Overview
---

# Trading Overview

Trading on Zenex means opening leveraged positions on asset prices. You never buy or sell the underlying asset. Instead, you take a directional bet using the vault's collateral token as margin, and your profit or loss is determined by how the price moves from your entry point. This page covers the core concepts you need to understand before placing your first trade.

Every trade happens in two steps. You create an order and sign it with your own key, and a keeper fills it against a verified oracle price. Nobody, including the keeper, can change the terms you signed, and your collateral only moves once the fill actually happens.

## Position Basics

Every position on Zenex has a direction, a size, and collateral backing it. When you go long, you profit if the asset price rises. When you go short, you profit if the price falls. The collateral you post is your margin, and the notional value is the total size of your exposure. Leverage is the ratio between your notional and your collateral. For example, posting 500 in collateral for a 5,000 notional position gives you 10x leverage.

Higher leverage means greater sensitivity to price movements. A 1% price move translates to a 10% change in equity at 10x leverage, a 20% change at 20x, and so on. The maximum leverage available depends on the market's initial margin parameter, which is set per market by governance. A market with a 1% initial margin allows up to 100x leverage, while a 5% initial margin caps leverage at 20x.

## One Market Per Contract

Each Zenex market is its own isolated trading contract paired with its own strategy vault. The contract address you interact with is the market itself, and each market's risk and liquidity stay fully contained within its own pair. The trading contract is immutable, so a logic change ships as a fresh contract and vault pair.

Within a single market your exposure is netted per side. You hold at most one long position and at most one short position, addressed as your long or your short. Every fill folds into the matching side: an increase blends into the open position, a decrease realizes against it. A side is open while it carries size and closed once its size returns to zero.

## Orders and Keeper Fills

Zenex splits trading into two steps: you create an order, and a keeper fills it.

When you create an order you sign it with your own key, but you never name a price. Orders are price-free. You describe what you want (a direction, a size, some collateral, an optional trigger, a slippage bound, and an expiration) and the order rests on-chain until it can be filled. A keeper then fills the order against a verified oracle price. Keepers are open bots that anyone can run: the keeper is only the party that submits the price and collects the keeper reward, it is never able to change the terms you signed.

Because you consented up front through a collateral allowance, the keeper cannot pull more than your order permits. Collateral moves at the moment of the fill, not when you create the order. For an order that grows your position, the collateral is drawn from your token allowance when the keeper fills it. For an order that shrinks your position, fees and proceeds are settled out of the position at the fill.

## Order Types

All orders are one of two kinds under the hood: an increase (grow the position and add collateral) or a decrease (shrink size or withdraw collateral). The familiar trading actions map onto these as follows.

A market order is an increase with no trigger. It fills at the next verified price the keeper submits, as long as that price sits within the slippage bound you set. This is the simplest way to enter, and it can even be created and filled in the same ledger as a single atomic step.

A limit order is an increase that carries a trigger price. It stays resting until the market reaches your trigger, at which point a keeper may fill it. Each order specifies whether its trigger fires as the price rises to your level or falls to it. A classic limit entry fires as the price falls to your level for a long and rises to it for a short. The trigger and the slippage bound are both judged against the price your fill actually touches.

Take-profit and stop-loss are ordinary decrease orders that carry a trigger, resting on-chain like any other order rather than existing as a separate object attached to a position. A take-profit fires on the profitable side of your entry, a stop-loss on the losing side. You can size them to close the whole position or only part of it, and a keeper fills them when the trigger is crossed.

## Slippage and Expiration

Two safeguards travel with every order.

The price bound is a one-sided slippage limit. A buy leg caps the price it will accept and rejects a fill above it, a sell leg floors the price and rejects a fill below it. If the verified price is worse than your bound, the fill is rejected rather than executed at a bad price. Leaving the bound unset means the fill is unbounded.

The expiration is a ledger sequence, not a wall-clock time. Your order is fillable while the current ledger is at or below the expiration you set. An expiration already in the past is rejected at creation, and an expiration beyond the network's storage horizon is rejected as well, since the order could not outlive its own on-chain lifetime.

## Position Lifecycle

A position follows a clear lifecycle from the first fill to the close.

The side opens when a keeper fills your first increase. At that point the protocol records your implied entry price (notional divided by the base tokens bought), your posted collateral, and a snapshot of the funding and borrowing indices so that continuous costs can be measured from that moment. Every later increase on the same side blends into the same position and re-blends the implied entry.

While the side is open you manage it by creating more orders. An increase with fresh collateral lowers your effective leverage and pushes your liquidation price away. A collateral-only decrease raises leverage, as long as you stay inside the margin limits. A resting take-profit or stop-loss lets a keeper close for you when a trigger is crossed.

The side closes when a decrease reduces it to zero, either through a full-close order you create or through a triggered take-profit or stop-loss a keeper fills. It can also be closed for you by a liquidation if your equity falls below the maintenance margin, or by auto-deleveraging if your winning side grows too large for the vault to safely back. A partial decrease realizes profit or loss on the portion closed and leaves the rest of the position intact.

## The Decrease Lock

Freshly added notional is locked against decreases for a short window set per market by governance. When you increase a position, the newly added size cannot be closed or withdrawn until its lock elapses, and a further increase folds into the live lock and resets its deadline. A partial decrease can only touch the unlocked fraction, and a full close is blocked while any locked notional remains.

This lock, together with the oracle anti-replay rule (an order can only fill against a price published at or after the order was created, with the single exception of a market order filled in its creation ledger), ensures every position carries real market risk. It prevents a trader from opening and immediately closing across a single oracle update to extract a risk-free difference. Liquidations are exempt: if your equity falls below the maintenance margin, keepers can close the position regardless of the lock.

## Fee Overview

Zenex charges four itemized costs, and all of them settle out of your collateral at the fill.

The trade fee is charged on every fill. It is split by how your trade affects the market's balance: the leg that pushes the long and short sizes further apart pays the dominant-side rate, while the leg that brings them closer pays the lower non-dominant rate. This encourages balanced markets.

The impact fee is charged only on the worsening leg, the part of a trade that pushes the book further out of balance. Balancing trades do not pay it. It scales with the worsening notional and reflects the cost a large order would impose on a traditional order book.

Borrowing interest accrues continuously and is paid by both sides, since open interest on either side reserves vault capacity. The rate follows a kink model that stays low while vault utilization is modest and climbs steeply as capacity fills.

Funding is a continuous transfer between longs and shorts driven by the market's imbalance. Its sign follows the crowded side (a positive rate means longs pay shorts). Earned funding accrues to a claimable balance that you withdraw with a separate claim, rather than being credited to your position automatically.

For a detailed breakdown of how each cost works, see the [Fees](./fees.md), [Borrowing Interest](./borrowing-interest.md), and [Funding Rate](./funding-rate.md) pages.
