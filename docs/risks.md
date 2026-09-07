---
sidebar_position: 10
title: Risks
---

# Risks

Using Zenex involves real financial risk. This page describes the main categories of risk that traders and vault depositors should understand before using the protocol. No mitigation eliminates risk entirely, and you should never commit more capital than you can afford to lose.

## Smart Contract Risk

Zenex operates through smart contracts deployed on Stellar Soroban. A market contract is upgradeable by its owner, which is how a defect can be fixed in place, but it also means the owner key (or the governance timelock it can be placed behind) is part of the trust model: whoever holds it can change the code a market runs. The vault holding depositor collateral is deliberately not upgradeable — every mutation is gated by its market contract, so a vault defect is contained by freezing the market and winding it down rather than by replacing vault code under live collateral. None of this removes the underlying risk: any bug or vulnerability in the code could lead to unexpected behavior or loss of funds, and no amount of review or testing can guarantee the absence of all defects.

## Oracle and Price Verification Risk

All prices on Zenex come from a signed price stream, one immutable stream per market. Keepers submit signed reports, and the market's oracle contract checks the publisher signatures, the stream id, the report's expiry, the age of its observation, and the sanity of its bid and ask before any fill, liquidation, or accrual. The protocol trusts that stream to determine entries, exits, liquidations, and fees. If it delivers an incorrect price, whether from a data-source failure, network delay, or manipulation, positions could be filled or closed at wrong prices and liquidations could trigger inappropriately. Those checks reduce rather than eliminate oracle risk.

## Keeper Liveness Risk

Because you do not fill your own trades, execution depends on keepers. A keeper is needed to fill your orders, run liquidations, deleverage winning positions, and fill vault deposits and redeems. Keepers are permissionless and incentivized by fees, so in normal conditions there is competition to do this work. But if keepers are unavailable or unwilling to act, for example during network congestion or when network fees outweigh the keeper reward, your order may not fill promptly, a stop-loss may fill later than you expected, or a liquidation may be delayed. Delayed liquidation can deepen a shortfall that the vault ultimately absorbs. Your protection is that a keeper can only ever fill within the bounds of your signed order and at a verified price.

## Liquidity and Solvency Risk

Each market's vault has a finite pool of liquidity, and trader profits are paid from it. When many traders are profitable at once, particularly during a strong directional move, the vault's capacity to pay all winners can be strained. Zenex defends the vault in two layers, both configured per market. **Auto-deleveraging (ADL)** flags a winning side whose pending profit grows too large relative to the vault, blocking new opens on that side and letting a keeper reduce winning positions back toward a safe level. A **realized-profit haircut** provides a second layer at an equal or higher threshold: while the winning side's pending profit exceeds it, a closing winner's realized profit is scaled down and the withheld share stays in the vault. These mechanisms protect solvency, but they mean that in extreme scenarios a profitable position can have its realized upside capped or be partially closed before you choose to close it.

## Counterparty Risk for Vault Depositors

Vault depositors provide the liquidity that backs every trade in their market, so they collectively take the opposite side of every position. When traders lose, those losses flow into the vault as yield. When traders win, their profits come out of the vault. If net trader profitability is high over a sustained period, the vault's value declines and depositors may redeem for less than they deposited. If a position closes with a shortfall past its freed margin, that **bad debt is absorbed by the vault**, reducing share value for everyone. Depositors should understand they are taking directional risk against the aggregate trading population.

## Vault Order and Redeem Cooldown Risk

Deposits and redeems settle in two steps: you place a vault order that escrows your assets or shares in the market contract, and a keeper fills it later at a verified price. Redeems are subject to a per-market cooldown before they can fill, and both deposits and redeems face safety checks at fill time. A deposit prices its shares against the vault's current state including pending trader profit and loss, with the mark set adverse to the depositor, so you cannot capture value from losses that have not yet realized, and the fill fails if it would push the vault past its size cap. A redeem can be gated while pending trader profits would let it drain the pool or while withdrawing would leave too little liquidity to back open positions. This means you may not be able to withdraw exactly when you want, and your redeem may rest until conditions clear. You can cancel a resting order to recover your escrowed assets or shares, except while the market is under an emergency freeze. The value you eventually realize still depends on the vault's state when the order fills.

## Liquidation Risk for Traders

Leveraged trading amplifies both gains and losses. If the market moves against your position and your equity falls below the maintenance margin, a keeper can close the whole position. The close charges a liquidation fee, capped at the equity that survives its other costs, and returns whatever is left to you, so a position that has deteriorated close to insolvency gets little or nothing back. Higher leverage means a smaller adverse move can trigger liquidation. Liquidation closes the entire position on that side, with no partial liquidation. Traders should monitor positions actively, use stop-loss orders, and size leverage to their risk tolerance.

## Wind-Down Risk

A market can be delisted and, eventually, retired by the market owner. When a market is **delisted**, new openings stop. After a grace window a flat terminal settlement price can be set, and once the force-close deadline passes a keeper may close any remaining position regardless of its health, at the terminal price if one has been set and otherwise at a live verified price. Either way, your position can be closed at a level you did not choose. When a market is **retired**, only funding claims, cancels of resting orders and vault orders (recovering any escrow), and direct vault redemptions remain. If you hold a position or unclaimed funding in a market that is winding down, act within the published windows so you are not settled or closed on the protocol's timeline instead of your own.

## Regulatory Risk

Decentralized finance protocols operate in a rapidly evolving regulatory environment. Laws and regulations governing digital assets, derivatives, and decentralized exchanges vary by jurisdiction and are subject to change. There is no guarantee that Zenex or protocols like it will remain accessible or legal in all jurisdictions. Users are responsible for understanding and complying with the laws applicable to them.
