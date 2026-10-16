---
title: Audit reports
description: Check published security review coverage and its limits.
---

# Audit reports

The contracts deployed on mainnet have not had an independent audit. The one published report covers Zenex V1, an earlier design that was never deployed. The contracts in [Deployments](./deployments.md) are V2, a rewrite that no auditor has reviewed.

## Zellic: Zenex V1

| | |
| --- | --- |
| Reviewer | [Zellic](https://www.zellic.io) |
| Review period | 21 May to 2 June 2026. Report dated 16 June 2026. |
| Code reviewed | Zenex V1 contracts at commit `7c011de` |
| Contracts in scope | Trading, now Market. StrategyVault, now Vault. PriceVerifier, replaced by Oracle. Factory, Governance and Treasury keep their names. |
| Out of scope | Front end, infrastructure, and key custody |
| Findings | 27. By impact: 2 critical, 4 high, 11 medium, 6 low, 4 informational. |
| Remediation | The report records V1 fixes for 13 findings, 2 of them partial. Zellic recommended a full reassessment after remediation. None has taken place. |
| Report | [Zellic V1 audit report (PDF)](pathname:///audits/zellic-zenex-v1.pdf) |

The report is published unchanged. Its code references point to V1 files and functions, and most of them no longer exist. The severity column below is each finding's own rating, which can differ from its impact rating in the summary.

## What changed between V1 and V2

V1 was one Trading contract that served every market from a shared StrategyVault, priced through a Pyth Lazer verifier. V2 replaced it:

- **One vault per market.** Each market is its own contract with its own vault. A loss in one market cannot draw on another market's liquidity.
- **A new oracle.** Prices come from Chainlink Data Streams through a separate oracle contract. The Pyth verifier was removed.
- **Keeper-executed orders.** Opens, closes and vault deposits and redemptions are orders that a keeper fills at a later price.
- **Auto-deleveraging as a normal close.** ADL settles a partial close and pays out realised profit. The V1 deleveraging index is gone.
- **Retirement instead of deletion.** A market cannot be deleted. It winds down, and it can retire only once every position is closed.

The table below records where each V1 finding stands in the deployed V2 code. Zenex prepared it. Zellic has not reviewed it.

## Findings and their V2 status

The Zellic column is the status the report records for V1. **Fixed** and **Partially fixed** list the V1 fix commits the report records. **Acknowledged** means Zenex accepted the finding without a V1 fix in the report.

The V2 status is Zenex's assessment of the deployed code. **Fixed** means the V1 fix carries into V2. **Redesigned** means V2 handles the problem with a different mechanism. **Accepted** means the risk remains by design.

| # | Severity | Finding | Zellic (V1) | V2 status | How V2 handles it |
| --- | --- | --- | --- | --- | --- |
| 3.1 | Critical | Negative collateral allows withdrawal of unrealized profit | Fixed (`acf96701`) | Redesigned | Margin changes are non-negative amounts. A withdrawal keeps the initial margin, and unrealised profit does not count towards it. |
| 3.2 | Critical | Stale entry-price notionals understate open interest | Acknowledged | Redesigned | Vault capacity is checked against the long side at the live price and the short side's largest possible payout. The open interest cap still sums entry notional. |
| 3.3 | High | Funding-rate formula lacks convergence, a cap and stabilisation | Acknowledged | Redesigned | Funding moves gradually with the long and short imbalance and has a hard cap. See [Funding rate](./trading/funding-rate.md). |
| 3.4 | High | Oracle price life-cycle mismatch across trading flows | Acknowledged | Fixed | A fill cannot use a price older than the order or the position's last price. Trade prices must be recent. See [Prices](./markets/prices.md). |
| 3.5 | High | Delisted positions refunded without PnL settlement | Partially fixed (`418275f8`, `0ff44111`) | Redesigned | A delisted market settles positions at a final price or closes them, and it can retire only with no positions left. See [Market status](./markets/status.md). |
| 3.6 | High | ADL threshold uses uncapped net PnL | Acknowledged | Redesigned | ADL triggers on each side's own profit. A side's losses count only up to its posted margin. |
| 3.7 | Medium | Liquidity counted for utilization can still be withdrawn | Acknowledged | Redesigned | Redemptions are keeper orders. A redemption that would leave open positions unbacked does not fill. |
| 3.8 | Medium | Idle market accrual charges retroactive fees | Fixed (`c8293a07`) | Fixed | The accrual clock advances on every priced call, including when the market is empty. |
| 3.9 | Medium | Missing price-data validation | Acknowledged | Redesigned | The oracle rejects non-positive or crossed prices, the wrong feed, and stale or future reports. |
| 3.10 | Medium | Stale funding rate after an imbalance flips | Partially fixed (`7780f821`) | Redesigned | The rate is recalculated on every priced call. It turns towards the new side gradually by design. |
| 3.11 | Medium | Reliance on a single oracle | Acknowledged | Accepted | Zenex relies on one price provider. Exposure caps limit the damage from a bad price, and the owner can freeze a market. |
| 3.12 | Medium | No liquidation safety buffer | Acknowledged | Redesigned | Liquidation starts at a maintenance margin set above the liquidation fee and below the initial margin. See [Liquidation](./trading/liquidation.md). |
| 3.13 | High | Positions can open when the contract is not active | Fixed (`00e2ee08`) | Fixed | A fill that adds size requires an active market. |
| 3.14 | High | Market margin can be set arbitrarily low | Fixed (`d814a768`) | Fixed | Initial margin has a protocol floor of 0.1%. The deployed market's setting is in [Deployments](./deployments.md). |
| 3.15 | Medium | Borrowing accrual misses vault-balance changes | Fixed (`ff90b8ae`) | Redesigned | Each market has its own vault, and deposits and redemptions pass through the market, which accrues first. |
| 3.16 | Medium | Borrowing configuration changes apply retroactively | Acknowledged | Fixed | A rate change is rejected unless the market accrued in the same ledger. |
| 3.17 | High | Shared signer keys allow signature replay | Fixed (`4991fefd`) | Redesigned | A user signs the whole call, including the account address. Orders carry no price data to replay. |
| 3.18 | Medium | Unbound oracle exponent breaks price accounting | Acknowledged | Redesigned | Chainlink reports carry no exponent, and each market's feed is fixed at deployment and checked on every report. |
| 3.19 | Low | Incorrect rounding direction | Fixed (`3a1deb32`) | Fixed | Fees and funding round in the protocol's favour. |
| 3.20 | Low | ADL cuts winning positions without settling PnL | Acknowledged as intended | Redesigned | ADL is a settled partial close. Realised profit and freed margin go to the trader. See [Auto-deleveraging](./trading/adl.md). |
| 3.21 | Low | Base fee is discontinuous across the dominant-side boundary | Acknowledged | Fixed | A trade that crosses the boundary pays the lower rate on the rebalancing part and the higher rate on the rest. See [Fees](./trading/fees.md). |
| 3.22 | Low | Incomplete TP/SL validation | Fixed (`4869d20c`) | Redesigned | Take-profit and stop-loss are separate close orders with positive trigger prices. A trigger already crossed fills on the next keeper pass. |
| 3.23 | Informational | PriceVerifier does not extend its storage lifetime | Fixed (`f5097052`) | Fixed | The oracle and the other contracts renew their storage lifetime on use. |
| 3.24 | Informational | Contract deployment can be front-run | Fixed (`8027aa44`) | Fixed | Factory deployment addresses derive from the authorising admin. |
| 3.25 | Informational | Market existence not checked when adding collateral | Fixed (`acf96701`) | Redesigned | Each market is its own contract and cannot be deleted. A retired market rejects new orders. |
| 3.26 | Informational | Actual leverage can differ from the trader's expectation | Acknowledged | Accepted | Opening fees come out of the posted margin, so effective leverage is slightly above the requested value. See [Margin and leverage](./trading/margin-and-leverage.md). |
| 3.27 | Low | Insufficient test coverage | Acknowledged | Addressed | V2 has unit, integration, fuzz and mutation testing. |

## What the deployed code relies on

Without an independent review of V2, its assurance comes from Zenex's own work:

- An internal threat model, reviewed against every V1 finding above.
- Unit, integration, fuzz and mutation tests.
- Testnet soak campaigns with automated traders, keepers and liquidations.
- Low launch limits on position size, open interest and vault utilization, shown in [Deployments](./deployments.md). They reduce market exposure but do not cap the loss from a contract flaw.

The owner can still upgrade the market and oracle code. Read [Governance](./governance.md).

:::danger Unaudited code holds your funds
A flaw in the V2 contracts can cost traders their margin and liquidity providers their deposits. A flaw that bypasses the launch limits is not bounded by them. No independent reviewer has checked V2 for such flaws. Read [Risks](./risks.md) before committing funds.
:::

## Reporting a vulnerability

Report a suspected vulnerability privately to the Zenex team through a direct message on [Discord](https://discord.gg/HJ4JPEtYcR). Do not disclose it publicly until it has been resolved.
