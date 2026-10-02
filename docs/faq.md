---
title: FAQ
sidebar_position: 10
---

# FAQ

This page answers the questions a trader or liquidity provider asks first. Each answer stays short and names the page that carries the full version.

## What is Zenex?

Zenex is a perpetual futures exchange on Stellar's Soroban smart contract platform. You post collateral and hold a leveraged long or short position on the price of an asset. The position has no expiry date. It stays open until you close it or the market closes it for you. For the parts a market is made of, see [What is Zenex](./getting-started/what-is-zenex.md).

## What do I need to start?

You need a wallet you can sign with, and a balance of the market's settlement token. That token is your collateral, and the market pays every fee and every payout in it. For the trade form field by field, see [Start trading](./getting-started/start-trading.md).

## Who fills my order?

Any account can. You sign an order with your terms and no execution price, and the account that fills it is the keeper. The keeper submits a signed price report and names which order to fill. The size, the margin, the trigger, the price bound, and the expiry stay as you signed them. The keeper earns a share of the fees on the fill plus the execution fee you escrowed. For the work a keeper runs and the reward on each call, see [Keepers](./keepers.md).

## Where does the price come from?

Every fill, every liquidation, and every interest charge runs on a signed report from the one price stream the market is bound to. The market checks each report before it acts. When a keeper fills your order, the market tests the price from that report against your trigger and your price bound.

One day after a delist, the owner of the market can set a flat settlement price. While that price is set, every close, liquidation, interest charge, and vault fill runs at it, and the market reads no report. For the checks and the age limits, see [Prices](./markets/prices.md).

## What does a trade cost?

A fill pays a trade fee and an impact fee on the size it moves. Each order also carries one flat execution fee that pays the keeper. Borrowing interest accrues on the crowded side of the market. Funding passes between longs and shorts. For each charge and where it goes, see [Fees](./trading/fees.md).

## Which token pays the network fee?

The token you trade with. Every transaction costs a network fee, and a relayer takes it in that token, so one balance covers your whole trade. The relayer is the service that sends your signed transaction to the network. Your signature names the fee token and a ceiling on the amount, and the relayer picks the amount inside that ceiling. For the ceiling and what a failed transaction costs, see [Fees](./trading/fees.md).

## What is the highest leverage I can use?

Each market sets its own ceiling through its initial margin, the share of your size that your posted collateral must cover. The less collateral a market asks for, the more leverage it allows. The fill takes its costs out of the collateral you post. An order that opens a side at the exact ceiling is therefore refused. The highest leverage that fills sits below it. A second line, the maintenance margin, marks liquidation. For both lines, see [Margin and leverage](./trading/margin-and-leverage.md).

## Can I hold a long and a short in the same market?

Yes. You hold at most one long and at most one short in a market. Each side carries its own collateral, its own costs, and its own liquidation price. For how a later fill folds into the position you already hold, see [Positions](./trading/positions.md).

## How much can I lose?

A position can lose the margin behind it and never more. If the loss and the costs run past that margin, the vault absorbs the shortfall. A liquidity provider carries a different exposure. One share can come to be worth less than you paid, because the vault pays out what traders win. For everything that can take your money, see [Risks](./risks.md).

## What can close my position without me?

A liquidation or an auto-deleveraging (ADL) close. A liquidation closes the whole position once its equity falls under the maintenance margin's share of its size. Equity is what the position would return if it closed now. A liquidation fee comes out of the equity that survives the close, and the remainder reaches you. Seven days after a delist, a liquidation can close a healthy position as well.

ADL closes part or all of a winning position once the pending profit on its side passes a share of half the vault balance. For each trigger and what it costs, see [Liquidation](./trading/liquidation.md) and [Auto-deleveraging](./trading/adl.md).

## Which side pays funding?

The side the rate points at pays, and the other side earns. A positive rate means longs pay shorts, and a negative rate means shorts pay longs. The rate builds toward the crowded side, so the crowd usually pays. After the crowd flips, the rate keeps its old direction until it crosses zero, so the thin side pays in the meantime. The payer settles funding out of the position at its next change. If nobody holds the earning side, the payment stays in the market. For the rate and its cap, see [Funding rate](./trading/funding-rate.md).

## Where does the funding I earn go?

It goes to your claimable credit, apart from your position. A claim is a call you sign yourself, and you choose when to make it. It pays the smaller of your credit and what the market holds for claims, and the rest stays claimable. For how that balance fills and pays out, see [Claimable credit](./trading/claimable-credit.md).

## Who is on the other side of my trade?

The market's vault. The liquidity providers in that vault are together the counterparty to every position in the market. A vault serves one market alone, so a loss in one market cannot reach the liquidity providers of another. For what the vault holds and what it pays, see [Vault](./vault/overview.md).

## How does a liquidity provider earn?

You deposit the market's settlement token and receive shares in that market's vault. The vault keeps part of the fees and the borrowing interest that traders pay, and it keeps what traders lose. It pays out what traders win. Your gain or your loss arrives as a change in what one share is worth. For what sets that value, see [Share value](./vault/share-value.md).

## Can I take my deposit out at any time?

You leave through a redeem order, which a keeper fills after a cooldown. The market refuses the fill for now while the open positions need the liquidity, or while pending trader profit is high. If the payout would fall under the minimum received you set, the market rejects the order. Your shares come back, the keeper keeps the execution fee, and the order ends. You can cancel before the fill unless the market is frozen. On a retired market, a redeem pays out at once. For every gate on a fill, see [Deposits and redeems](./vault/depositing.md).

## Who can change a market's parameters?

The owner of that market, one market at a time. The owner is an account or a timelock contract. The owner replaces the whole parameter set, sets the market's state, such as a freeze or a delist, and can replace the market's code. A timelock owner queues each parameter change and each code replacement in public, then waits out a fixed delay. That delay runs from one second to 60 days, and the timelock publishes it on chain. A timelock therefore protects you only as far as its delay is long. A freeze or a delist lands at once under an owner of either kind. For every power an owner holds, see [Governance](./governance.md).

## What happens when a market is frozen?

A freeze stops every action in that market, for you and for the keepers. Your position, your margin, and your order escrow stay where they are until the owner lifts the freeze. **A freeze does not pause the price or the clocks.** Borrowing interest and funding accrue on elapsed time. They keep building for as long as the freeze lasts. The first fill after the freeze settles that whole window. If the price moved against you, a liquidation can follow at once. For the five states a market can be in, see [Market status](./markets/status.md).

## Is Zenex audited?

Not yet. No audit of the contracts you trade against has finished, and [Audits](./audits.md) lists the report from each audit once one does. An audit covers the code as it stood on the date of its report. **Code that passes an audit can still hold a defect.**
