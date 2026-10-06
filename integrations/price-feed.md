---
title: Signed price reports
sidebar_label: Execution prices
description: Fetch a signed Data Streams report, obtain the oracle-adjusted price, and submit keeper actions.
---

# Signed price reports

Execution uses a signed Chainlink Data Streams report. The oracle verifies it, checks its feed and time window, and returns the effective bid and ask.

Most interfaces can use [the hosted relay](./relay) for immediate execution. A keeper or direct executor needs access to signed reports.

## Fetch the full report

Use the market's `feedId` from configuration. Fetch the report from the Data Streams service with your own server-side credentials. Pass the report's complete `fullReport` bytes to the market call. Keep the signed envelope intact. A decoded price is not a replacement.

For report access and schema details, follow [Chainlink's fetch and decode guide](https://docs.chain.link/data-streams/tutorials/ts-sdk-fetch). The Zenex ticker endpoint exposes decoded display fields. It does not provide the full signed report.

:::warning Keep price credentials on your server
Browser clients use display-price endpoints. Never ship Data Streams credentials in a frontend bundle.
:::

## Get an effective price for an estimate

The oracle can narrow the report's spread. Use its verified return for a preview that includes the deployed spread setting. Use `network` and `market` from [Quickstart](./quickstart.md). The input `reportBytes` is the complete signed report from your Data Streams response.

```ts
import {
  OracleContract, Price, simulateAndParse,
} from "@zenith-protocols/zenex-sdk";

const oracle = new OracleContract(market.oracle);
const verified = await simulateAndParse(
  network, oracle.verifyPrice(reportBytes, market.feedId),
  OracleContract.parsers.verifyPrice,
);
const { bid, ask, publish_time } = verified.result;
const price = new Price(bid, ask, publish_time);
```

`reportBytes` is the complete signed report as a `Buffer` or `Uint8Array`. The market's feed ID is 32 bytes. The SDK's estimate layer expects 18-decimal prices. Check stream precision when you add a market.

A successful simulation checks that report against the current oracle. The transaction must still verify its report at execution.

:::warning Preserve bid, ask, and observation time
`Price.from` creates a zero-spread display approximation. It cannot reproduce a spread-aware execution price or validate a report.
:::

## Submit a keeper action

Use the appropriate `MarketContract` operation:

| Operation | Inputs beyond the price report |
| --- | --- |
| `executeOrder` | Keeper recipient, owner, order ID |
| `executeVaultOrder` | Keeper recipient, owner, order ID |
| `executeLiquidation` | Keeper recipient, owner, side |
| `executeAdl` | Keeper recipient, owner, side, amount |
| `updateAdlState` | No additional input |
| `accrue` | No additional input |

The operation builder accepts report bytes as its price input. The transaction source signs and pays the network fee on a direct submission. The `keeper` address receives the execution reward. It is not an authorizer.

Use strict router batches when every call must succeed. Use isolated outcomes when the caller can handle individual failures. For complete signatures and gates, read [market orders](/technical/market/orders), [liquidation](/technical/market/liquidation), and [auto-deleveraging](/technical/market/auto-deleveraging).

## Handle time and price gates

| Condition | What to do |
| --- | --- |
| Wrong feed | Correct the report source |
| Stale or expired report | Fetch a fresh report before another attempt |
| Report too far ahead | Check report and ledger clocks |
| Trigger or price bound not met | Leave the order pending |
| Market gate blocks execution | Refresh market state and show the specific reason |

Order fills use the strict trade window. Protective liquidation, auto-deleveraging, and accrual use the protective window. Both enforce the forward-time allowance. Positions and vault orders also impose report-time conditions. A report accepted by the oracle can still fail a market gate. Read [oracle verification](/technical/oracle/verify-price) for exact time rules and errors. Read [Deployments](/deployments) for current settings.
