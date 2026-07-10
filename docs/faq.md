---
sidebar_position: 9
title: FAQ
---

# Frequently Asked Questions

### What is Zenex?

Zenex is a decentralized perpetual futures exchange built on Stellar Soroban. It lets traders open long and short leveraged positions on assets without intermediaries, expiry dates, or centralized custody of funds.

### What blockchain is Zenex built on?

Zenex is built on **Stellar Soroban**, Stellar's smart contract platform. Soroban provides fast finality, low transaction costs, and a robust execution environment for DeFi applications. The current deployment runs on **Stellar testnet**: trading uses test tokens, and the app guides new users through Stellar friendbot funding plus a built-in USDC faucet.

### How does a trade get executed?

You **create an order** signed by you, and a permissionless **keeper** fills it at a price it verifies against the market's oracle feed. Your order is price-free but sets the bounds a keeper must respect: a size, a slippage price bound, an expiration, and, for limit and stop orders, a trigger price. Your collateral, plus a small flat execution fee for the keeper, is escrowed into the trading contract when you create the order. Cancelling the order refunds the full escrow. A market order is one you expect a keeper to fill right away. A limit or stop order rests until its trigger price is crossed. See [Start Trading](./getting-started/start-trading.md).

### Can anyone run a keeper?

Yes. Keepers are permissionless: anyone can fill orders, run liquidations, and keep a market's accounting current, and they earn a fee for doing so. A keeper can only act within the limits your signed order allows and at a price verified against the oracle, so it cannot trade against you on its own terms. You can even fill your own order, in which case the keeper reward routes back to you.

### What wallets are supported?

Zenex supports several sign-in methods:

- **Social login** (Google, X, or Discord) via Privy, which creates a smart account in one click, no extension or seed phrase required. This is the first option in the Connect dialog.
- **Passkey-based smart wallets**: sign in with biometrics (Face ID, fingerprint, or a security key) directly from the browser, no extension needed.
- **Browser wallets**: **xBull**, **Freighter**, **Lobstr**, **Albedo**, **Hana**, **Ledger**, and **Hot Wallet**.
- **Ed25519 key import** (advanced): bring your own keypair.

### What is the maximum leverage?

Maximum leverage is a per-market parameter and equals one divided by that market's initial margin requirement. Higher leverage amplifies both gains and losses, so it is important to manage your risk carefully. See [Leverage](./trading/leverage.md) for more details.

### What are the trading fees?

A fill pays a **trade fee** that is split by its effect on market balance: the side that worsens the long/short imbalance pays a higher rate, and the side that improves it pays a lower one. A **price impact fee** applies to the part of a trade that pushes the book further out of balance. Each order also carries a small flat **execution fee** that pays the keeper who fills it. It is escrowed when you create the order and refunded if you cancel. Positions on the market's larger side also accrue **borrowing interest** over time, at a rate that rises with that side's use of the vault's capacity, and longs and shorts exchange a **funding rate** based on market imbalance. Fee rates are per-market parameters. For a detailed breakdown, see [Fees](./trading/fees.md).

### How do I receive funding I have earned?

Funding is held in an internal pool with a per-user claimable balance. When you are on the side that earns funding, it accrues to your claimable balance and you **claim** it when you want it.

### How does the vault work?

Each market has its own strategy vault, a liquidity pool that backs that market's trades and stands as the counterparty to every position. Depositors earn yield from trading fees, borrowing interest, and net trader losses. Deposits and redeems are routed through the trading contract as vault orders: they escrow first and a keeper fills them, minting or burning shares net of the vault fee. See [Vault Overview](./vault/overview.md) for more details.

### Can I get liquidated?

Yes. A position becomes liquidatable when its **equity falls below the maintenance margin**, a per-market parameter. A keeper then closes the whole position. If your remaining equity still covers the liquidation fee, no fee is charged and the equity is returned to you (a soft liquidation). If it does not, all remaining equity is forfeited to the vault (a hard liquidation). You can monitor your position health and add collateral to avoid liquidation. See [Liquidation](./trading/liquidation.md) for the full mechanics.

### What is the collateral token?

Each market has its own **settlement token**, chosen at deployment. All positions in a market are collateralized, denominated, and settled in that token. The initial Zenex markets settle in USDC, but the protocol supports any Stellar token as a market's settlement token.

### Is Zenex audited?

Zenex is committed to security and transparency. For information on audit status and reports, see the [Audits](./audits.md) page.

## Troubleshooting

### Why hasn't my order filled?

A resting order fills only when every condition holds at once: the market must have crossed your trigger price on the side of the spread the fill executes at, the verified price must sit within your slippage bound, and the order must not have expired. If those hold and it still rests, the usual causes are on the account or market side. A fill whose fees and initial margin your escrowed collateral cannot cover is rejected, and the order keeps resting. And a size-growing order is halted while openings are paused, while the side is flagged for [auto-deleveraging](./trading/adl.md), or while the fill would breach the market's utilization or open-interest caps.

### Why didn't my stop-loss or take-profit fire?

Triggers are judged against the verified oracle price on the side of the spread your close would execute at, not against the last trade you saw on a chart. An order can also only fill against a price published at or after the moment it was created, so a spike that happened before you placed it does not count. If the market gaps past your trigger, the order becomes eligible but your slippage bound still applies: a bound tighter than the gapped price rejects the fill until the price comes back within it. Keepers also need a fresh signed price (at most 15 seconds old), so fills land at the next verified update rather than the instant the chart touches your level.

### Why can't I close or reduce my position?

Newly added size is locked against decreases for a short period (30 seconds on testnet), and a full close is blocked while any locked notional remains. A partial close must also leave the remainder above the initial-margin floor, so a reduction that would leave too little collateral behind is rejected. Add collateral or close in full once the lock has lapsed. If the market is frozen, fills and liquidations, new orders, funding claims, and vault-order cancels are halted until the market is unfrozen. You can still cancel a resting trade order and recover its escrow.

### Why is my vault deposit or redeem still pending?

A redeem waits out a short cooldown from the moment you created the order before it can fill, and it is also blocked while either side's pending trader profit is too large relative to what would remain in the vault. A redeem is also held back while the market's open positions are using too much of the vault, since a fill may not leave open interest under-reserved. A deposit has no cooldown and no pending-PnL gate. The share price you deposit or redeem at already accounts for pending trader PnL. A deposit is blocked while it would push the vault past its balance cap, and one below the market's minimum deposit is rejected when you create it, so it never rests as pending. Every vault order fills in full at once and needs a verified price published after the order's creation, so a keeper must wait for the next price update. If you set a minimum-received bound on the order, a fill that would return less than it is rejected until the share price moves back in your favor. A resting vault order can be cancelled to recover its escrow at any time except while the market is frozen. See [Depositing](./vault/depositing.md).

### Why did I receive less profit than I expected?

A close settles net of costs: the trade fee on the closed size, accrued borrowing interest, and any funding your side owed. While the winning side's pending profit overhangs the vault, a [profit haircut](./trading/adl.md) also scales down realized gains. Funding you earned is never in the close payout at all. It accrues to a claimable balance that you claim separately.
