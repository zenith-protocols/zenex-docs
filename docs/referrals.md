---
title: Referrals
sidebar_position: 9
---

# Referrals

The referral program pays you a bonus on the points that the traders you bring to Zenex earn from trading. This page covers how you get a share link, how the app attributes a trader to you, and what each side earns.

## Your share link comes from the app

Connect your account to the app. The app gives you a share link for that account. Send the link to a trader you want to bring. The app also shows how many referees are attributed to you.

## The first attribution fixes the referrer for good

A trader opens your link and connects an account. That account signs one transaction, and the attribution counts once the network confirms the transaction. The record is an event on chain, so anyone can read it. The app then shows the trader as your referee, and it shows you as the referrer on the trader's side.

The app can trail the confirmation by a short time. It reads new attributions from the chain, and a background run repeats that read every hour.

An account has one referrer, and the first attribution the account signs sets it. If the account opens a second link later, it keeps its first referrer. The contract does not block a second attribution, but the app counts only the first. You cannot move a referee to another referrer. A referee cannot switch either.

The referrer must be a different account from the referee, and the contract rejects an attribution that names the signer as its own referrer. This rule means you cannot earn a bonus on your own trading.

## You earn a percentage on top of your referees' points

For every point a referee earns from trading, you earn a bonus. The bonus is a percentage of that point, and it adds to your own points. It continues for as long as the referee trades, because the attribution has no end date.

The referee keeps every point that their own trading earns. Your bonus comes on top and takes nothing from the referee.

## What this means for you

A referee's first signed attribution decides the referrer, so the first link a trader uses is the link that counts. A trader who has already used another link stays with that referrer, and your link earns you nothing from that trader.
