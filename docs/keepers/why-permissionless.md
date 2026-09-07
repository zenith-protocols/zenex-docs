---
sidebar_position: 2
title: Why Permissionless
---

# Why Keeper Execution Is Permissionless

Every execution entry point on a Zenex market is callable by anyone. `execute_order`, `execute_liquidation`, `execute_adl`, `execute_vault_order`, and the maintenance pokes `update_adl_state` and `accrue` check no allowlist, no role, and no registration. The `keeper` argument the fill entries take is only the reward recipient: the contract never authenticates it, so naming an address as keeper requires no signature from that address. This page explains why that is a deliberate design decision rather than a missing access check.

### What the Contract Actually Checks

Permissionless does not mean unchecked. A keeper call succeeds only when everything that matters has been verified, and none of it depends on who the caller is:

- **The price is proven, not chosen.** Every execution call carries a signed Chainlink Data Streams report. The oracle delegates the DON signature check to Chainlink's verifier contract, then enforces the market's immutable stream anchor, the report's own validity window, and the staleness window for the call class. A keeper cannot substitute another market's stream, an expired report, or a stale one.
- **The trader consented in advance.** An order's escrow is the trader's signature: size, direction, slippage bound, expiration, and trigger were all fixed when the order was created, and a fill that violates any of them traps. The keeper's only freedom is which valid, recent report to attach and when to submit.
- **Eligibility is computed on-chain.** A liquidation call on a healthy position fails with `NotLiquidatable`. An ADL close on an unflagged side fails. A fill that would breach margin, utilization, or open-interest checks fails. The caller cannot make work exist; it can only execute work the market's own state has made eligible.
- **Time is bounded on both ends.** Anti-replay floors (an order's creation time, a position's last-marked `priced_at`) and the forward-only price cache mean no in-window report can rewind a position to a price the market has already superseded.

With every substantive check enforced by the contract, an allowlist would not remove any power a keeper actually holds. It would only decide who is allowed to do the protocol's safety-critical work.

### Liveness Is a Solvency Property

Liquidation is not a convenience feature. A position that stays open past its maintenance margin during a crash accrues losses the vault must absorb, so liquidation liveness is directly a solvency property of the vault. The same holds for auto-deleveraging, which is the market's last defense when a winning side's pending profit outgrows what the vault can pay.

Gating execution to an approved set of keepers would make that set a single point of failure: an outage of the approved fleet during exactly the volatility that produces liquidations would convert operator downtime into depositor losses. Under permissionless execution, any party able to fetch a signed report and submit a transaction can step in, and the wide `close_staleness` window means a rescue liquidation still lands even through a feed gap.

The same logic protects traders. Order execution has an escape hatch the protocol treats as load-bearing: the market router's `create_and_fill` flow lets a trader fill their own order with `keeper = user`, round-tripping the reward back to themselves. If every keeper stalls, a trader can still open, close, or trigger their own position. An execution allowlist would remove exactly this — every fill would then depend on someone else's infrastructure.

### Incentives Do the Recruiting

Permissionless execution works because the work pays, per call, to whoever does it first:

- Filling a trade or vault order pays the `keeper_rate` cut of the fill's fee plus the flat `exec_fee` the order escrowed at creation.
- A liquidation pays the `keeper_rate` cut of the close's trade fee and of the liquidation fee.
- An ADL close pays the `keeper_rate` cut of its trade fee.

Only the first valid transaction to land collects; competitors lose nothing beyond a small amount of gas. That race is not just an efficiency mechanism — it is itself a safety property. The close-class staleness window is wider than the fill window by design, so a lone privileged keeper could in principle wait inside that window for a price more favorable to itself. With open competition it cannot: any keeper that hesitates hands the reward to a competitor executing at the freshest report. Competition converts the window's tolerance into pressure toward the best available price.

The unrewarded pokes (`accrue`, `update_adl_state`) stay permissionless for the same liveness reason, and in practice ride along with rewarded work: any keeper marking positions already holds the state and the fresh report those calls need.

### No Keeper Key, No Key to Steal

Because the keeper argument is unauthenticated, executing requires no keeper-held signing key at all: the reward address is named, not proven. The reference `zenex-keeper` daemon exploits this fully — it holds no Stellar signing key and hands submission to relay infrastructure, naming its payout address as the keeper. An allowlist enforced by `require_auth` on the keeper would reverse this: every keeper would need a hot key online to sign every execution, adding a compromise surface to the most latency-sensitive path in the protocol and gaining nothing the contract's own checks do not already provide.

It would also add cost exactly where the protocol can least afford it. Liquidations are already the heaviest calls a market makes (a settlement touches the position, both accrual indices, the vault, and the treasury), and an access check is extra ledger reads and writes on that same worst-case path.

### What Permissionless Does Not Mean

It does not mean the protocol depends on strangers showing up. Zenex operates keepers, and in calm conditions they win most races simply by being fast. Permissionlessness is the guarantee about what happens when they do not: no operator failure, censorship, or exclusion can stop a valid order from filling, an underwater position from closing, or the vault from being defended. Anyone can be that backstop — including you, for your own orders.
