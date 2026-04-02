---
sidebar_position: 5
title: Frontend Integration
---

# Frontend Integration

This guide covers the key considerations for building a trading frontend that connects to the Zenex perpetual futures protocol on Stellar Soroban. The `zenex-trade` repository contains the reference frontend implementation built with React, Vite, and TypeScript. While you are free to use any frontend framework, the patterns described here apply universally.

:::note
This guide provides architectural guidance and integration patterns. Specific SDK method signatures and configuration details may evolve before the production release. Refer to the `zenex-sdk-js` repository for the latest API surface.
:::

## Wallet Connection

Zenex supports two primary wallet types for signing transactions on Stellar.

**Browser extension wallets** such as Freighter provide a standard interface for Stellar transaction signing. The frontend requests the user's public key, constructs a transaction, and passes it to the wallet extension for signing. The signed transaction is then submitted to the network. This is the simplest integration path and works well for desktop users.

**Smart accounts** with passkey (WebAuthn) authentication allow users to sign transactions using biometric authentication (fingerprint, Face ID) without managing private keys. The `soroban-smart-account` contracts support multi-signer configurations with both Ed25519 keys and WebAuthn credentials. Smart accounts provide a smoother onboarding experience, especially on mobile, because users do not need to install a browser extension or manage a recovery phrase.

The frontend should support both wallet types and present the appropriate connection flow based on the user's device and preference.

## Transaction Flow

Every user action that modifies on-chain state follows the same general flow: construct the transaction, sign it, and submit it to the network.

**Construction.** The frontend assembles the contract call parameters (function name, arguments) and creates a Soroban transaction. The `zenex-sdk-js` SDK handles the low-level XDR encoding and Soroban transaction assembly. Before submission, the transaction is simulated against the Soroban RPC to estimate resource usage and detect any errors before committing.

**Signing.** The constructed transaction is passed to the connected wallet (extension or smart account) for signing. The wallet returns the signed transaction envelope.

**Submission.** The signed transaction can be submitted in two ways. Direct submission sends the transaction to the Soroban RPC at `https://soroban-testnet.stellar.org`. This requires the user's account to hold XLM for transaction fees. Relayed submission sends the transaction to the Zenex relayer at `https://relayer.zenithprotocols.com`, which submits it on the user's behalf and covers the XLM fees. Relayed submission enables a gasless experience where users only need the collateral token (e.g., USDC) and do not need to acquire XLM.

After submission, the frontend should poll for transaction confirmation (typically 5 to 6 seconds on Stellar) and then refresh the relevant UI state.

## Reading On-Chain State

The frontend needs to read contract state to display positions, market data, account balances, and protocol configuration. There are two approaches.

**Soroban RPC queries** call the contract's read-only functions directly. These provide guaranteed-fresh data with no indexing delay. The trading contract exposes `get_position`, `get_user_positions`, `get_market`, `get_markets`, `get_config`, and `get_status`. The vault contract exposes `total_assets`, `balance_of`, and share token metadata. The SDK wraps these calls with typed return values.

**API queries** to the Zenex backend provide pre-processed data that may be more convenient for certain UI components. Historical trade data, aggregated statistics, and the leaderboard are only available through the API because they require indexed historical state that is not efficiently queryable on-chain.

For the trading UI, the recommended pattern is to use Soroban RPC for current positions and market state (ensuring freshness) and the backend API for historical data and analytics.

## Price Feeds

The frontend needs real-time price data for two purposes: displaying current prices to the user, and submitting fresh price payloads with transactions.

**Display prices** are obtained by connecting to the Zenex pricer service (`zenex-pricer`), which relays Pyth Lazer prices over WebSocket. The pricer provides a continuous stream of price updates for all supported trading pairs. The frontend subscribes to the feeds it needs and updates the UI in real time.

**Transaction prices** must be Pyth Lazer signed payloads that the on-chain price verifier can authenticate. When the user submits a transaction that requires price data (opening a market position, closing a position, modifying collateral), the frontend must include a recent signed price payload. The price verifier enforces a `max_staleness` parameter, so the payload must be fresh at the time the transaction executes on-chain (not just at construction time).

The typical pattern is to grab the latest signed payload from the pricer connection immediately before constructing the transaction, then submit promptly. Given Stellar's short block times, the window between payload acquisition and on-chain execution is usually well within the staleness limit.

## Position Management UI

The core trading UI needs to display and manage the following position states.

**Pending limit orders** (`filled = false`) are positions waiting for a keeper to fill them when the price reaches the user's limit. The UI should show the limit price, collateral committed, and notional size. Users can cancel pending orders via `cancel_position`.

**Active positions** (`filled = true`) are open positions with live PnL. The UI should compute and display unrealized PnL, current equity, effective leverage, accrued funding, and accrued borrowing. Computing these values requires the current market price, the position's entry price, the current funding and borrowing indices from `MarketData`, and the position's snapshotted indices.

**Stop-loss and take-profit** prices are displayed alongside active positions. Users set or update these via `set_triggers`. The UI should validate that TP is above entry for longs (below for shorts) and that SL is below entry for longs (above for shorts).

**Closed and liquidated positions** are displayed in a trade history view, sourced from the backend API or indexed events.

## Computing Unrealized PnL

For display purposes, the frontend should compute approximate PnL locally rather than making a contract call for every price tick. The PnL formula for a position is:

$$
\text{pnl} = \text{notional} \times \frac{\text{current\_price} - \text{entry\_price}}{\text{entry\_price}} \times \text{direction}
$$

Where direction is +1 for longs and -1 for shorts, and the division uses the price scalar derived from the oracle exponent. Equity is then:

$$
\text{equity} = \text{col} + \text{pnl} - \text{total\_fee}
$$

Accrued fees (funding and borrowing) can be approximated from the current market indices and the position's snapshotted indices. This local computation provides instant UI updates on every price tick without any network calls.

## Event Indexing

For displaying trade history, position events, and protocol activity, the frontend can consume data from the Zenex indexer. The indexer receives Mercury webhook events from the Stellar network and writes structured records to the D1 database, which the backend API exposes as queryable endpoints.

Events indexed include position opens, fills, closes, liquidations, auto-deleveraging, funding rate updates, and status changes. The frontend queries these through the backend API for rendering trade history, activity feeds, and analytics dashboards.

## Error Handling

Transaction failures on Soroban return error codes from the contract's `TradingError` enum. The frontend should map these codes to user-friendly messages. Common errors include insufficient collateral, leverage exceeding the market's maximum, position too small or too large, utilization cap exceeded, contract status preventing the action, and price staleness. The simulation step (which happens before signing) catches most of these errors before the user signs the transaction, allowing the frontend to display the error immediately rather than after a failed on-chain submission.

## Reference Implementation

The `zenex-trade` repository contains the production frontend for the Zenex protocol. It is built with React, Vite, and TypeScript, and demonstrates all of the patterns described above: wallet connection (both extension and smart account), transaction construction and submission via the SDK, real-time price display via the pricer WebSocket, local PnL computation, and historical data from the backend API. It serves as the canonical reference for frontend integrators.
