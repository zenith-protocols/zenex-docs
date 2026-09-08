---
title: FAQ
sidebar_position: 10
---

# FAQ

Short answers to the questions a reader asks first. Each answer names the page that carries the full version.

## What is Zenex?

Zenex is a perpetual futures exchange on Stellar Soroban. You post collateral and hold a leveraged long or short position on the price of an asset. The position has no expiry date, so you decide when it ends. For the parts a market is made of, see [What is Zenex](./getting-started/what-is-zenex.md).

## What do I need to start?

You need a wallet you can sign with, and a balance of the market's settlement token. That token is your collateral. The market pays every fee and every payout in it. For the trade form field by field, see [Start trading](./getting-started/start-trading.md).

## Who fills my order?

Any account can. You sign an order that names no execution price, and the account that fills it is the keeper. The keeper submits a signed price report and names which order to fill. The keeper sets nothing inside the order. The size, the margin, the trigger, the price bound, and the expiry stay as you signed them. For the work a keeper runs and the reward on each call, see [Keepers](./keepers.md).

## Where does the price come from?

Every fill, every liquidation, and every interest charge runs on a signed report from the one price stream the market is bound to. The market checks every report it acts on. A fill of your own order runs at the report the keeper submits with it, so that report sets your trigger and your bound. The owner of a delisted market can fix one flat settlement price. Every close then prices at that value, and the market reads no report. For the checks and the age limits, see [Prices](./markets/prices.md).

## What does a trade cost?

A fill pays a trade fee and an impact fee on the size it moves. Each order also carries one flat execution fee that pays the keeper. Borrowing interest falls on the crowded side of the market, and the thin side pays none. Funding passes between longs and shorts. For each charge and where it goes, see [Fees](./trading/fees.md).

## Which token pays the network fee?

The token you trade with. Zenex charges the network fee of your transaction in that token, so one balance covers your whole trade. You sign a ceiling on the amount, and a relayer sends the transaction and takes the fee inside that ceiling. For that ceiling and what a failed transaction costs, see [Fees](./trading/fees.md).

## What is the highest leverage I can use?

Each market sets its own ceiling. The less collateral a market asks for up front, the more leverage it allows. Your fill takes its costs out of the collateral you post, so an order at the exact ceiling is refused. Pick leverage below the ceiling. For the two margin lines, see [Margin and leverage](./trading/margin-and-leverage.md).

## Can I hold a long and a short in the same market?

Yes. You hold at most one long and at most one short in a market. Each side carries its own collateral, its own costs, and its own liquidation price. For how a later fill folds into the position you already hold, see [Positions](./trading/positions.md).

## How much can I lose?

A position can lose the margin behind it and never more. If the loss and the costs run past that margin, the vault absorbs the shortfall. A depositor carries a different exposure. One share can come to be worth less than you paid, because the vault pays out what traders win. For everything that can take your money, see [Risks](./risks.md).

## What can close my position without me?

A liquidation or an auto-deleveraging close. A liquidation closes the whole position once its equity falls under the maintenance margin's share of its size. It charges a liquidation fee out of the equity that survives the close, and the remainder reaches you. Seven days after a delist, a liquidation can close a healthy position as well, and it charges that same fee. Auto-deleveraging closes part or all of a winning position once that side's pending profit passes a share of the vault balance. For each trigger and what it costs, see [Liquidation](./trading/liquidation.md) and [Auto-deleveraging](./trading/adl.md).

## Which side pays funding?

The side the rate points at pays, and the other side earns. The rate builds toward the crowded side, so a crowded book ends with the crowd paying. If the crowd flips to the other side, the rate still points the old way. The thin side keeps paying until the rate crosses over. The market charges funding against the collateral behind your position. No part of it pays a keeper or the treasury. What no trader receives stays with the market. For the rate and its cap, see [Funding rate](./trading/funding-rate.md). For where that money goes at the end of a market's life, see [Market status](./markets/status.md).

## Where does the funding I earn go?

It goes to a claimable balance in your name, and not onto your position. A claim is a call you sign yourself. It pays the smaller of your balance and what the market's credit pool holds, and the rest stays claimable. For how that balance fills and pays out, see [Claimable credit](./trading/claimable-credit.md).

## Who is on the other side of my trade?

The market's vault. The depositors in that vault are together the counterparty to every position in the market. A vault serves one market alone, so a loss in one market cannot reach the depositors of another. For what the vault holds and what it pays, see [Vault](./vault/overview.md).

## How does a liquidity provider earn?

You deposit the market's settlement token and receive shares in that market's vault. The vault keeps part of the fees and the borrowing interest that traders pay, and it keeps what traders lose. It pays out what traders win. Your gain or your loss arrives as a change in what one share is worth. For what sets that value, see [Share value](./vault/share-value.md).

## Can I take my deposit out at any time?

You leave when you create a redeem order, and a keeper fills it. A redeem waits out a cooldown first. The market can also hold the fill back while the open positions need the liquidity, or while pending trader profit is high. For every gate on a fill, see [Deposits and redeems](./vault/depositing.md).

## Who can change a market's parameters?

The owner of that market, one market at a time. An owner is a key or a timelock contract. An owner replaces the whole parameter set in one call, and an owner can also replace the market's code. A timelock owner queues each change in public and waits out a fixed delay. Read the length of that delay before you treat it as protection. A change of the market's state lands at once under an owner of either kind. For every power an owner holds, see [Governance](./governance.md).

## What happens when a market is frozen?

A freeze stops every action in that market, for you and for the keepers. Your position, your margin, and your escrow stay where they are until the owner lifts the freeze. The freeze does not hold the price still. Borrowing interest and funding keep accruing for as long as it lasts. The first fill after the freeze settles that whole window, and a liquidation can follow at once. For the five states a market can be in, see [Market status](./markets/status.md).

## Is Zenex audited?

An independent security firm reviews the contracts, and Zenex publishes the report from each completed audit. An audit covers the code as it stood on the date of its report. **Audited code can still hold a defect.** For the reports available now, see [Audits](./audits.md).
