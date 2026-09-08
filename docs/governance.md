---
title: Governance
sidebar_position: 6
---

# Governance

Every market has one owner, set at deployment. The owner is an account or a contract, and it holds the parameters, the state, and the code of the market. One owner can hold several markets, so one owner can hold the rules of every market you have a position in. The owner of a market is part of what you trust when you trade in it or supply liquidity to it. **Before you commit funds to a market, find out who owns it and what limits that owner accepts.**

## What an owner can change

An owner replaces the whole parameter set of a market in one call. Every fee, every margin line, the leverage ceiling, the size limits, and the borrowing and funding curves move together in that call. Read [Market parameters](./markets/market-parameters.md) for what the set covers.

An owner also sets the state of the market. The owner can stop every fill that opens a position or adds size to one, freeze the market, or delist it for wind-down. Retirement is a state of its own, and no state follows it. The owner can retire a market only after every position is closed and every margin balance is out of it. One day after a delist, the owner can fix a flat settlement price. From then on, the market prices every close, every liquidation, and every vault fill at that price. Until the owner sets it, those fills take the price from the feed. The owner can replace the flat settlement price while the market stays delisted. Read [Market status](./markets/status.md) for what each state does to your position.

## The code of a market can be replaced

An owner replaces the code of a market in place. The stored state survives the replacement, so your position, your margin, and your orders stay as they were. The rules that act on them are then the new rules. **This is the widest power an owner holds.** It repairs a defect in a live market. It also rewrites the rules you accepted when you opened your position.

## A market owned by a timelock

An owner can pass a market to a timelock contract. The timelock has an owner of its own, and that owner cannot reach the market directly. Each parameter change and each code replacement goes into a public queue and waits.

The timelock fixes the unlock time of a change at the moment it records the change, and publishes that time on chain. Anyone can read the whole queued change and its unlock time from the timelock. The wait is one fixed length for that timelock. It can be as short as one second and as long as 60 days. Read the wait of a market's timelock before you treat it as protection.

Once the wait ends, any account can apply the change. Until the moment it runs, the owner of the timelock can cancel it. The cancel window stays open past the unlock time, so a queued change can sit unlocked and never land.

A change to the wait itself sits outside the queue. The owner records the change, and it then waits the length in force at that moment. A second change to the wait replaces the one on record. An owner that cuts a one-day wait to one minute waits a full day before the one-minute wait applies.

A change of state is the exception. The owner of the timelock forwards a new state to the market at once, with no queue and no wait. A freeze therefore lands in a single transaction under either kind of owner. Every other call the owner makes, a change to the flat settlement price included, goes into the queue and waits.

## Where ownership ends

An owner can hand a market to a new owner. The transfer completes only when the new owner accepts it, and the current owner keeps every power until then.

An owner can also give up ownership. That is permanent, and no later call restores it. The parameters, the code, and the state of the market are then fixed for its life. Trades go on under the rules in force at that moment, as far as the state allows.

**A market given up while it is frozen stays frozen.** Every position and every deposit in it stays out of reach, because no fill, no cancel, and no claim runs in a frozen market. On a market given up in wind-down, no account can set or replace the flat settlement price again.
