---
sidebar_position: 4
title: Glossary
---

# Glossary

A reference of key terms used throughout the Zenex documentation.

| Term | Definition |
|------|-----------|
| **Perpetual futures (perps)** | Derivative contracts that let you speculate on an asset's price without expiry |
| **Market** | A single trading pair on Zenex. Each market is its own trading contract paired with its own vault and oracle feed |
| **Settlement token** | The token a market uses as collateral and for every fee and PnL figure. Positions in a market are denominated and settled in it |
| **Oracle** | The price feed (Pyth Lazer) a market is bound to. Keepers submit signed price updates that the contract verifies before any fill |
| **Order** | A price-free instruction you sign to open, close, or adjust a position. It carries size, collateral, a price bound, an expiration, and (for triggers) a trigger price. A keeper fills it |
| **Keeper** | A permissionless actor that fills orders, runs liquidations, deleverages, and advances accrual, earning a fee. Anyone can run one |
| **Price bound** | A one-sided slippage limit on an order. A keeper may only fill at a price at least as good as the bound |
| **Trigger** | A price condition on a closing order (stop-loss or take-profit). The order becomes fillable once the market crosses the trigger |
| **Netted position** | Your single position per side in a market. You hold at most one long and one short per market, and every order adjusts that one position. There are no position ids or counters |
| **Collateral** | Funds posted to back a position and absorb losses. Pulled from your token allowance at fill time |
| **Leverage** | Multiplier that amplifies exposure beyond posted collateral. Maximum leverage is one divided by the initial margin |
| **Notional size** | The total value of a position (collateral x leverage) |
| **Open interest (OI)** | The sum of position sizes on one side of a market. Long OI and short OI are tracked separately |
| **Margin (initial / maintenance)** | Initial margin is the collateral required to open and sets max leverage. Maintenance margin is the lower floor below which a position can be liquidated |
| **PnL** | Profit and Loss, the unrealized gain or loss on an open position. Implied from size and price, not stored |
| **Equity** | Collateral plus unrealized PnL, net of fees. Determines position health |
| **Notional lock** | A short window during which newly added size cannot be decreased or closed. A further increase resets the lock |
| **Liquidation** | Forced closure of a position by a keeper when equity falls below the maintenance margin. A soft liquidation returns leftover equity to the trader; a hard one forfeits it to the vault |
| **Skew-split fee** | The base trade fee, split so the side that worsens the long/short balance pays more than the side that improves it |
| **Impact fee** | A fee charged only on the part of a trade that pushes the book further out of balance |
| **Borrowing interest (kink model)** | Time-based interest paid by open positions to the vault. The rate follows a kink curve that steepens once utilization passes a target level |
| **Funding rate** | A continuously accruing cost between longs and shorts that anchors the perpetual price. It accelerates toward the dominant side and decays back toward balance |
| **Funding pool / claim** | Funding is held in an internal pool with per-user claimable balances. Funding you earn is claimed with a claim action rather than credited automatically |
| **ADL (Auto-deleveraging)** | Safety mechanism that reduces winning positions on a flagged side when their profit grows too large relative to the vault |
| **Profit haircut** | A scaling applied to a closing winner's realized profit while the winning side's pending profit is large relative to the vault. The withheld share stays with the vault |
| **Vault** | The strategy vault paired with a market. Holds the liquidity that backs trades and acts as counterparty to every position |
| **Strategy vault** | The vault contract deployed alongside a market by the factory. Its immutable strategy is that market's trading contract |
| **Vault order** | A deposit or redeem routed through the trading contract. It escrows at creation and a keeper fills it, subject to cooldowns and gates |
| **Vault shares** | Token representing proportional ownership of a vault's assets. Minted or burned net of the vault fee when a vault order fills |
| **Utilization** | Ratio of reserved liquidity to available vault capacity. Drives borrowing interest and caps opens and withdrawals |
| **Terminal price** | A flat settlement price set on a delisted market once its grace window passes. The market then prices every position at it |
| **Factory** | The contract that deploys a new trading and vault pair together for a chosen oracle feed |
| **Smart Account** | A passkey- or social-login-controlled on-chain account created without a seed phrase or browser extension. Enables Quick Trading via session keys |
| **Quick Trading** | A UI feature (also called session keys) that authorizes a temporary signing key on a smart account so orders can be created without a per-transaction wallet prompt |
| **Passkey** | A WebAuthn credential stored in the user's device or password manager that signs transactions for a smart account in place of a seed phrase |
| **Browser Wallet** | A Stellar wallet provided by a browser extension or hardware device (Freighter, xBull, Lobstr, Albedo, Hana, Ledger, Hot Wallet) that signs transactions directly |
