---
sidebar_position: 10
title: Risks
---

# Risks

Using Zenex involves real financial risk. This page describes the main categories of risk that traders and vault depositors should understand before using the protocol. No risk mitigation strategy eliminates risk entirely, and you should never commit more capital than you can afford to lose.

## Smart Contract Risk

Zenex operates through smart contracts deployed on Stellar Soroban. Once deployed, these contracts execute autonomously and cannot be modified. While this immutability provides strong guarantees about how the protocol behaves, it also means that any bugs or vulnerabilities in the code could lead to unexpected behavior or loss of funds. The protocol undergoes thorough internal review, threat modeling, integration testing, and property-based fuzzing. Independent security audits are planned and will be published when complete. However, no amount of review can guarantee the absence of all defects.

## Oracle Risk

All prices on Zenex come from Pyth Lazer oracle feeds. The protocol trusts these price feeds to determine position entries, exits, liquidations, and fee calculations. If the oracle delivers an incorrect price, whether due to a data source failure, network delay, or manipulation, positions could be opened or closed at wrong prices, and liquidations could be triggered inappropriately. The price verifier contract includes safeguards such as staleness checks and confidence interval validation, but these measures reduce rather than eliminate oracle risk.

## Liquidity Risk

The vault has a finite pool of collateral. When traders are profitable, their gains are paid from the vault. If many traders are profitable at the same time, particularly during a strong directional move, the vault's capacity to pay all winners may be strained. Zenex includes a circuit breaker that pauses new position openings when the net unrealized profit-and-loss across all positions reaches 95% of the vault balance. If it exceeds 100% (i.e., net trader PnL rises above the vault balance), the protocol triggers auto-deleveraging, which proportionally reduces the notional size of all winning positions to bring the system back to solvency. While this mechanism prevents protocol insolvency, it means that in extreme scenarios, profitable positions may have their upside capped.

## Counterparty Risk for Vault Depositors

Vault depositors provide the liquidity that backs all trades on the protocol. In effect, depositors collectively take the opposite side of every position. When traders lose money, those losses flow into the vault as yield for depositors. When traders make money, their profits come out of the vault. If net trader profitability is high over a sustained period, the vault's total value will decline, and depositors may withdraw less than they deposited. Vault depositors should understand that they are taking on directional risk against the aggregate trading population.

## Liquidation Risk for Traders

Leveraged trading amplifies both gains and losses. If the market moves against your position and your equity falls below the liquidation threshold, your position will be closed by a keeper and all remaining collateral will be forfeited. Higher leverage means a smaller adverse price movement can trigger liquidation. There is no partial liquidation on Zenex; once the threshold is breached, the entire position is closed. Traders should monitor their positions actively, use stop-loss orders, and size their leverage according to their risk tolerance.

## Regulatory Risk

Decentralized finance protocols operate in a rapidly evolving regulatory environment. Laws and regulations governing digital assets, derivatives, and decentralized exchanges vary by jurisdiction and are subject to change. There is no guarantee that Zenex or protocols like it will remain accessible or legal in all jurisdictions. Users are responsible for understanding and complying with the laws applicable to them.
