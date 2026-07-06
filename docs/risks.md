---
sidebar_position: 10
title: Risks
---

# Risks

Using Zenex involves real financial risk. This page describes the main categories of risk that traders and vault depositors should understand before using the protocol. No mitigation eliminates risk entirely, and you should never commit more capital than you can afford to lose.

## Smart Contract Risk

Zenex operates through smart contracts deployed on Stellar Soroban. Each market's trading contract is immutable: once deployed it executes autonomously and has no upgrade path, so a logic change means deploying a fresh trading and vault pair rather than patching a live one. This immutability gives strong guarantees about how a market behaves, but it also means any bug or vulnerability in the code could lead to unexpected behavior or loss of funds. The protocol undergoes internal review, threat modeling, integration testing, and property-based fuzzing. Independent security audits are planned and will be published when complete. No amount of review can guarantee the absence of all defects.

## Oracle and Price Verification Risk

All prices on Zenex come from Pyth Lazer oracle feeds. Keepers submit signed price updates, which a market's price verifier checks against the market's immutable feed anchors before any fill, liquidation, or accrual. The protocol trusts these feeds to determine entries, exits, liquidations, and fees. If the oracle delivers an incorrect price, whether from a data-source failure, network delay, or manipulation, positions could be filled or closed at wrong prices and liquidations could trigger inappropriately. The verifier includes safeguards such as staleness checks, confidence-interval validation, and feed and exponent checks, but these reduce rather than eliminate oracle risk.

## Keeper Liveness Risk

Because you do not fill your own trades, execution depends on keepers. A keeper is needed to fill your orders, run liquidations, deleverage winning positions, and fill vault deposits and redeems. Keepers are permissionless and incentivized by fees, so in normal conditions there is competition to do this work. But if keepers are unavailable or unwilling to act, for example during network congestion or an unprofitable gas environment, your order may not fill promptly, a stop-loss may fill later than you expected, or a liquidation may be delayed. Delayed liquidation can deepen a shortfall that the vault ultimately absorbs. Your protection is that a keeper can only ever fill within the bounds of your signed order and at a verified price.

## Liquidity and Solvency Risk

Each market's vault has a finite pool of liquidity, and trader profits are paid from it. When many traders are profitable at once, particularly during a strong directional move, the vault's capacity to pay all winners can be strained. Zenex defends the vault in two layers, both configured per market. A **realized-profit haircut** scales down a closing winner's profit while the winning side's pending profit is large relative to the vault, retaining the withheld share in the vault. **Auto-deleveraging (ADL)** flags a winning side whose pending profit grows beyond a higher threshold, blocking new opens on that side and letting a keeper reduce winning positions back toward a safe level. These mechanisms protect solvency, but they mean that in extreme scenarios a profitable position can have its realized upside capped or be partially closed before you choose to close it.

## Counterparty Risk for Vault Depositors

Vault depositors provide the liquidity that backs every trade in their market, so they collectively take the opposite side of every position. When traders lose, those losses flow into the vault as yield. When traders win, their profits come out of the vault. If net trader profitability is high over a sustained period, the vault's value declines and depositors may redeem for less than they deposited. If a position closes with a shortfall past its freed margin, that **bad debt is absorbed by the vault**, reducing share value for everyone. Depositors should understand they are taking directional risk against the aggregate trading population.

## Vault Order, Cooldown, and Gate Risk

Deposits and redeems are not instant. They are routed through the trading contract as vault orders that escrow first and are filled later by a keeper, and each is subject to a cooldown and to safety gates set per market by governance. A deposit can be gated while pending trader losses would let it snipe the pool, and a redeem can be gated while pending trader profits would let it drain the pool or while withdrawing would leave too little liquidity to back open positions. This means you may not be able to withdraw exactly when you want, and your redeem may rest until conditions clear. You can cancel a resting order to recover your escrowed assets or shares, but the value you eventually realize still depends on the vault's state when the order fills.

## Liquidation Risk for Traders

Leveraged trading amplifies both gains and losses. If the market moves against your position and your equity falls below the maintenance margin, a keeper can close the whole position. Whether you keep anything depends on the tier: in a soft liquidation, enough equity remains to cover the liquidation fee and the leftover is returned to you; in a hard liquidation, the remainder is forfeited to the vault. Higher leverage means a smaller adverse move can trigger liquidation. Liquidation closes the entire position on that side; there is no partial liquidation. Traders should monitor positions actively, use stop-loss orders, and size leverage to their risk tolerance.

## Wind-Down Risk

A market can be delisted and, eventually, retired by its owner through governance. When a market is **delisted**, new openings stop and, after a grace window, a flat terminal settlement price is set. Once a force-close deadline passes, a keeper may close any remaining position at that terminal price regardless of its health, which can close your position at a level you did not choose. When a market is **retired**, only funding claims and direct vault redemptions remain. If you hold a position or unclaimed funding in a market that is winding down, act within the published windows so you are not settled or closed on the protocol's timeline instead of your own.

## Regulatory Risk

Decentralized finance protocols operate in a rapidly evolving regulatory environment. Laws and regulations governing digital assets, derivatives, and decentralized exchanges vary by jurisdiction and are subject to change. There is no guarantee that Zenex or protocols like it will remain accessible or legal in all jurisdictions. Users are responsible for understanding and complying with the laws applicable to them.
