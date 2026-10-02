---
title: Vault
sidebar_position: 1
---

# Vault

A vault is the pool of liquidity behind one market. It holds a balance of the market's settlement token, and that balance backs every position the market carries. The market and its vault are deployed together as a pair, so each market has exactly one vault.

Traders open positions against the vault. The vault pays a trader who closes in profit and keeps what a trader loses. The liquidity providers of the vault are therefore, together, the counterparty to every position in that market. You take that role when you deposit, and your exposure is to that one market alone.

The vault gives you shares in return for your deposit. The fill of your deposit sets how many shares you receive, and that count stays fixed afterwards. What moves is the value of one share, which rises and falls with what the market gains or loses. To see what you can lose as a liquidity provider, read the [risks page](../risks.md).

## In this section

| Page | What it covers |
| --- | --- |
| [Deposits and redeems](./depositing.md) | How you enter and leave the vault, what each step costs, and why a fill can be refused. |
| [Share value](./share-value.md) | What one share is worth at the moment a keeper fills your order, and what moves that value. |
