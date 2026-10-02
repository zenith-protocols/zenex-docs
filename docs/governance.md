---
title: Governance
sidebar_position: 6
---

# Governance

Each market has one owner from the moment it is deployed. The owner is an account or a contract, and it decides which rules the market runs under. This page covers what an owner can change, how a timelock slows those changes, and how ownership ends.

One owner can own several markets, so one key can change the rules of every market you hold a position in. **The owner of a market is part of what you trust when you trade in it or supply liquidity to it.** Anyone can read the owner of a market from the market, and the wait of a timelock from the timelock. [Contract addresses](./deployments/contract-addresses.md) lists the markets.

## An owner sets the parameters and the state of a market

An owner replaces the whole parameter set of a market in one call. Every fee, every margin line, the leverage ceiling, the size limits, and the borrowing and funding curves move together. The protocol bounds each value, so no owner can push a fee past its ceiling. Read [Market parameters](./markets/market-parameters.md) for what the set covers. The settlement token, the price stream, the vault, and the oracle are fixed at deployment, and no call changes them.

A change to a borrowing or funding curve never reprices time that has already passed. It applies only right after the market updates its interest, so the earlier period keeps the old rates. A frozen market cannot update. There the owner can change the curves, and the first update after the freeze bills the whole frozen period at the new rates.

An owner also moves the market between five states: active, on ice, frozen, delisted, and retired. Each state closes some actions and leaves others open. [Market status](./markets/status.md) holds the five states, the wind-down clock, and what each state does to your position. In a delisted market the owner can also fix a flat settlement price for every close once the first day of the wind-down has ended. The owner can replace that price while the market stays delisted. The owner can retire a market only when every position is closed and every margin balance is out of it. Retirement is final.

## An owner can replace the code of a market

An owner replaces the code of a market in place. Your position, your margin, and your orders stay as they were, and the new code then acts on them. **This is the widest power an owner holds.** It repairs a defect in a live market. It also rewrites the rules that were in force when you opened your position.

## A timelock makes an owner's changes wait in public

An owner can pass a market to a timelock, a contract that holds each change in a public queue before it reaches the market. The timelock has an owner of its own, and that owner cannot reach the market directly. Each parameter change and each code replacement enters the queue with an unlock time. Anyone can read the queued change and its unlock time from the timelock.

Every entry waits the same fixed length. The owner of the timelock picks that length, from one second up to 60 days. A wait of one second gives you no time to react, so the length decides how much protection a timelock gives.

Once the wait ends, any account can apply the change. Until the change runs, the owner of the timelock can cancel it. The cancel window stays open after the unlock time. An unlock is therefore no promise that the change lands. A change to a borrowing or funding curve can also sit unlocked until the market next updates its interest.

The wait can change, but a shorter wait cannot arrive faster than the old one allows. The owner of the timelock records the new length, and it applies only after the wait in force at that moment. An owner that cuts a one-day wait to one minute therefore waits a full day before the one-minute wait applies. A second change replaces the first and restarts the day. The owner cannot cancel a recorded change to the wait, only replace it. The timelock announces the change publicly with its unlock time. Entries already in the queue keep the unlock time they were given.

A change of state is the exception. The owner of the timelock sends a new state to the market at once, with no queue and no wait. This lets the owner pause a market in an emergency. **A timelock gives you no warning before a freeze, a delist, or a retirement.** These states land in a single step under either kind of owner. Every other call goes through the queue, the flat settlement price included.

## Ownership ends by transfer or by giving it up

An owner can hand a market to a new owner. The new owner must accept before a deadline that the current owner sets. The current owner keeps every power until the acceptance and can withdraw the offer before then.

An owner can also give up ownership. That is permanent, and no later call restores it. The owner cannot give up while an offer to a new owner is open. Once given up, the parameters, the code, and the state of the market stay as they are for its life. An active market keeps trading under the rules in force at that moment. A market on ice keeps blocking new size. A delisted market stays delisted and keeps the price rule it has at that moment.

**A market given up while it is frozen stays frozen.** Every position and every deposit in it stays out of reach, because no fill, no cancel, and no claim runs in a frozen market. A market given up during a wind-down can never get a flat settlement price, or a new one.
