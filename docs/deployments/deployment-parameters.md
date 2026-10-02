---
sidebar_position: 2
title: Deployment parameters
---

# Deployment parameters

This page lists what each Zenex contract receives when it is deployed, and the limits the protocol puts on those values. It covers the factory, the market and its vault, the oracle, the treasury, and the timelock. [Market parameters](../markets/market-parameters.md) says what each market value does to your money and gives the values recorded for the testnet. [Contract addresses](./contract-addresses.md) gives the addresses. The contracts hold the values in force, so a value read from a contract outranks any figure in these pages.

## The factory deploys a market and its vault as one pair

Any account can ask the factory to deploy a pair. The account that authorizes the request becomes the owner of the market. The factory builds the pair from the market code, the vault code, and the treasury address that it holds at that moment. The factory has an owner of its own, and that owner can replace all three. A replacement reaches only the pairs deployed after it, because the factory keeps no authority over a pair once the pair exists.

A market that the factory lists was deployed by that factory, and the list says no more. The factory and the market do not check which settlement token or oracle the deployer names. Neither checks who owns the market. [Governance](../governance.md) covers what an owner holds.

A deployment request carries these inputs.

| Input | What it sets |
| --- | --- |
| Owner | The account that owns the market and holds its parameters, its state, and its code. |
| Settlement token | The token the market takes as margin and pays out in. The vault holds the same token. |
| Oracle | The oracle that checks the price reports of the market. One oracle can serve several markets. |
| Price stream | The one price stream from Chainlink Data Streams that the market prices from. It must be a version 3 stream, the version the oracle decodes. |
| Starting parameters | The full parameter set that the market opens with. The bounds in the next section apply to it. |
| Share name and symbol | The labels of the vault share token. |
| Extra share decimals | The decimals the share token carries beyond those of the settlement token. The limit is 10. |

The market opens in the active state. It keeps the settlement token, the vault, the oracle, the treasury, and the price stream from the moment it exists. [Markets](../markets/overview.md) says why those stay fixed under an open position.

## The market refuses a parameter set that breaks a bound

The market checks the starting parameters at deployment and checks every replacement that its owner makes later. A set that breaks a bound, or puts two related values in the wrong order, is refused whole. The bounds are part of the market code, so only a replacement of that code changes them. A market owner can choose any value inside them.

### Ceilings and floors

Every fee, rate, margin, and profit limit is zero or more. The table gives the range that the protocol accepts for each value with a fixed bound.

| Value | Range |
| --- | --- |
| Keeper share of fees | 0% to 50% |
| Each of the two trade fee rates | 0% to 1% of the size a fill moves |
| Each of the two vault fee rates | 0% to 1% of the assets a fill moves |
| Impact fee rate on a fill | up to 10% of the size the fill moves |
| Utilization cap for an increase, measured against half the vault balance | above 0% to 1000% |
| Utilization cap for a redeem, measured against half the vault balance | the increase cap to 1000% |
| Initial margin | 0.1% to 50%, which is 1000x down to 2x leverage |
| Liquidation fee | 0% to 25% of the size that closes |
| Decrease lock on new size | 15 seconds to 1 day |
| Redeem cooldown | 0 seconds to 30 days |
| Borrowing rate at full utilization | up to 1000% a year |
| Funding cap | up to 1000% a year in either direction |
| Auto-deleveraging trigger, as pending profit against half the vault balance | 45% to below 100% |
| Auto-deleveraging clear target, on the same measure | 40% to the trigger |
| Profit cap level, on the same measure | the trigger to below 100% |

The size limits, the execution fee, the smallest deposit, and the vault balance cap have a floor and no protocol ceiling. The owner of a market can therefore set them as high as it chooses.

### Ordering rules

Related values must keep a fixed order. Each rule below carries the reason that the protocol enforces it.

- **Trade fees.** The fee on the part of a fill that widens the gap between the sides is at least the fee on the narrowing part. The side that pushes the market out of balance never pays less.
- **Sizes.** The smallest position is above zero and below the largest position. The cap on the total size of one side is at least the largest position, so one full-size position always fits.
- **Order floors.** The smallest order size is above zero and at most the smallest position size. A full position can then close in a single order.
- **Execution fee.** The execution fee is at most the smallest order margin. No order carries a flat fee above the least margin it may post.
- **Impact fee.** The impact fee on the smallest position stays at or under 0.1% of its size, whatever growth the owner sets. A minimum-size fill therefore never pays a steep rate.
- **Margins.** The liquidation fee is below the maintenance margin, and the maintenance margin is below the initial margin. The gap leaves an equity band in which a liquidation returns a remainder.
- **Fresh positions.** The initial margin is above the maintenance margin, plus the lower trade fee, plus 0.1%. A new position of the smallest size is never liquidatable at birth.
- **Decrease lock.** The lower limit of the lock equals the longest strict age limit that the oracle accepts. One accepted price can therefore never open and close the same size.
- **Utilization.** The cap for a redeem is at least the cap for an increase. The gap between them keeps vault liquidity behind the open positions.
- **Borrowing curve.** The bend sits below full utilization. The rate at full utilization is at least the slope below the bend.
- **Funding.** The wind-down level is at most the build-up level, and the build-up level is at most 100%. The minimum funding charge is at most the cap.
- **Profit limits.** The clear target is at most the trigger, and the trigger is at most the profit cap level. Auto-deleveraging therefore starts before the profit cap applies. The redeem block level is above zero and at most the clear target, so a permitted redeem can neither arm auto-deleveraging nor keep it armed.
- **Deposit floor.** The smallest deposit is above zero and at most 1% of the vault balance cap. A higher floor can then never block every deposit.

### A change to interest or funding waits for an accrual

A change to a borrowing value or a funding value lands only in a ledger in which the market has already accrued. Accrual charges the interest and funding owed up to that ledger. The open utilization cap counts as a borrowing value, because it sets the capacity that the borrowing rate is measured against. The time before the change is therefore priced at the old values. A frozen market skips this step. The first accrual after the freeze prices the whole frozen window at the new values.

## The vault takes one authorized caller at deployment

The vault is deployed in the same call as its market. It receives the values below. Read [Vault](../vault/overview.md) for how it holds liquidity and issues shares.

| Input | What it sets |
| --- | --- |
| Name and symbol | The labels of the share token. |
| Settlement token | The token the vault holds. It is the token of the market. |
| Extra share decimals | The decimals of the share token beyond those of the settlement token. The limit is 10. The extra decimals make the share price hard to inflate with a direct donation of tokens. |
| Authorized market | The one contract that can move the vault's assets. It is the market deployed with the vault. |

The vault carries no fee, no deposit floor, and no cooldown of its own. The market applies those from its own parameter set.

## The oracle is deployed apart from the factory

The oracle is deployed on its own, and any number of markets can name it. Every market that names it shares the settings below. [Prices](../markets/prices.md) covers how the market applies them to a report.

| Input | What it sets |
| --- | --- |
| Owner | The account that can change the two age limits and the spread narrowing. |
| Verifier | The Chainlink Data Streams verifier contract that holds the set of signing publishers. No oracle call changes it. Only an upgrade of the oracle code can. |
| Strict age limit | The oldest price that a fill of a trade order or a vault order accepts. It ranges from 3 to 15 seconds. |
| Wider age limit | The oldest price that a liquidation, an auto-deleveraging update or close, or an accrual accepts. A gap in the stream then cannot stop those calls. It ranges from the strict limit to 120 seconds. |
| Spread narrowing | The share of the spread that the oracle removes from a quote, taken evenly from both sides. It ranges from 0% to 100%. |

## The treasury sets one fee share for every market

The treasury is deployed on its own, and the factory hands its address to each new market. It receives two inputs. The owner is the account that can change the share and withdraw the treasury's balance to any recipient. The share is the fraction of protocol fees that the treasury takes. It ranges from 0% to 50%.

The owner can change the share at any time. The new share applies to the next fee that the market settles. [Fees](../trading/fees.md) says which charges the share covers and how the keeper and the vault split the rest.

## A timelock can own a market

The timelock is optional. It is deployed on its own and then made the owner of a market. It receives an owner and one wait. The wait ranges from 1 second to 60 days, and it sets how long every queued change waits before anyone can apply it. A change to the wait itself waits out the wait in force. A change of market state is the exception and skips the queue. [Governance](../governance.md) covers the queue and what it means for a market you trade in.

## The factory derives both addresses before either contract exists

The market needs the address of its vault at construction, and the vault needs the address of its market. Neither contract can exist first. The factory resolves this by deriving both addresses from the owner's address and a value the deployer picks, before it deploys anything. It then deploys the vault with the market address, and the market with the vault address. No linking step follows. Both contracts are fully configured from their first ledger, and the vault accepts asset movements from its market alone. The market address comes from the owner and the value the deployer picks. The vault address comes from the same owner and a second value that the factory computes from the first. [Contract addresses](./contract-addresses.md) says what the two inputs are and why no other account can take an address. The [factory pages](/technical/factory/deploy) give the exact derivation.

## What the bounds mean for you

The bounds cap the worst case and do not fix a value. Two markets can sit at opposite ends of the same range. The owner of a market can replace its values at any time inside the bounds. A timelock delays that replacement when the market has one.
