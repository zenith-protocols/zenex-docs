---
title: Relayed transactions
sidebar_label: Hosted relay
description: Prepare, review, sign, submit, and confirm a transaction through the Zenex backend.
---

# Relayed transactions

The hosted relay submits a transaction for the user. The user signs contract authorizations, including a token approval capped at the maximum relay fee. The relayer pays Stellar in XLM. The backend forwards relay requests. The relayer prepares the call, refreshes its execution price, and submits it through the fee forwarder and router.

:::info Hosted access
Transaction routes use the service's access, origin, and regional policies. Confirm access for your integration before you depend on them.
:::

## Choose execution behavior

The mainnet API base is `https://api.zenex.trade`. Keep the base URL aligned with your [deployment](/deployments).

| Prepare route | Router behavior | Fee authorization |
| --- | --- | --- |
| `POST /v1/tx/relay/prepare/calls` | Strict batch, with no immediate fill | `forward` |
| `POST /v1/tx/relay/prepare/fill` | Strict batch and first-order fill | `forward_dynamic` |
| `POST /v1/tx/relay/prepare/try-fill` | Strict batch and an isolated first-order fill attempt | `forward_dynamic` |

Use `fill` to create and fill a market order in the same transaction when the interface promises immediate execution. Use `calls` to create resting orders or perform price-free actions. A failed immediate fill through `try-fill` can leave orders pending. Your interface must show that result.

## Prepare

Encode each SDK `Call` as a base64 XDR `ScVal`. Use a fresh ledger for authorization expiration. Continue the [SDK order example](./sdk.md#build-and-preview-an-order) with its `network`, `currentMarket`, `user`, and `call`. This example prepares an immediate fill.

```ts
import { rpc } from "@stellar/stellar-sdk";
import { callToScVal, parseAtomic } from "@zenith-protocols/zenex-sdk";

const apiBase = "https://api.zenex.trade";
const relayServer = new rpc.Server(network.rpc, network.opts);
const { sequence } = await relayServer.getLatestLedger();
const request = {
  user: user.userId,
  calls: [callToScVal(call).toXDR("base64")],
  expirationLedger: sequence + 60,
  maxFeeAmountAtomic: parseAtomic("0.50", currentMarket.assetDecimals).toString(),
  feedId: "0x" + currentMarket.feedId.toString("hex"),
};
const preparationResponse = await fetch(apiBase + "/v1/tx/relay/prepare/fill", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(request),
});
if (!preparationResponse.ok) throw new Error("Relay preparation failed");
const prepared = await preparationResponse.json();
```

The cap and lifetime are example choices. Verify the returned fee token and decimals against your expected deployment.

| Request field | Meaning |
| --- | --- |
| `user` | Owner address |
| `calls` | Base64 XDR encoded call descriptors |
| `expirationLedger` | Expiration for user authorization and fee approval |
| `maxFeeAmountAtomic` | Maximum fee, as decimal text in fee-token atomic units |
| `feedId` | Market feed, required for `fill` and `try-fill` |

Order expiration is a separate field within the order. Expiration of relay authorization does not cancel an order already created.

The prepare response contains `func`, `authEntries`, `outcome`, and `feeTerms`. Each authorization includes its `xdr`, `payloadHash`, `signer`, and `signatureExpirationLedger`. `outcome` describes the discovery simulation. Market state can change before submission.

:::warning Review the fee-token approval
The signed authorization includes a token approval for the fee forwarder up to the cap. The relay fee is collected when the transaction executes.
:::

## Review and sign

Decode the prepared invocation and every authorization entry before you ask the wallet to sign. Match them to your original intent. Check the owner, network, contract addresses, action arguments, fee recipient, cap, and expiration. Recompute the authorization payload hash from its XDR and network.

`forward` binds the fee token, cap, expiration, recipient, target contract, target function, and target arguments. `forward_dynamic` binds those fee terms and the target contract and function. It omits target arguments. Nested market authorizations bind the user's market actions.

The actual relay fee is excluded from both signed argument sets. The forwarder enforces a positive fee within the signed cap. The prepare invocation contains a placeholder fee. Show the cap as a maximum, not a final fee quote.

Successful collection consumes the temporary allowance. A reverting target rolls back fee collection. A successful target can still contain an unsuccessful isolated fill attempt. For exact signed arguments, read [fee forwarding](/technical/router/fee-abstraction).

Use your wallet's authorization-entry signing method. Keep the prepared nonce, invocation, and expiration intact. Return signed entry XDRs, not transaction envelopes.

:::warning The backend selects the fee and price report
The backend chooses the actual relay fee and a valid signed price report. Contracts enforce the signed fee cap, authorized order terms, and the oracle's feed and freshness checks. Any order price bound also constrains the fill price. These authorizations do not permit arbitrary spending.
:::

## Submit and confirm

Send the prepared `func` and signed entries to `POST /v1/tx/relay/submit`:

```json
{
  "func": "<prepared HostFunction XDR>",
  "auth": ["<signed authorization entry XDR>"],
  "feedId": "<market feed ID for a priced call>"
}
```

The relayer refreshes the signed report and calculates its fee before submission. It refuses a fee above the cap or an authorization too close to expiration.

Submission returns `transactionId`, `status: "pending"`, and a nullable `hash`. Store the ID. Poll:

```text
GET /v1/tx/transactions/<transactionId>?relayer=fund
```

The status response forwards the relayer's transaction record. Once a hash is available, confirm the chain result through Stellar RPC. Show separate states for submission, confirmed transaction, and filled or pending order. Refresh chain state after confirmation. History can lag behind it.

:::warning Resolve an uncertain handoff
If submission times out, the relayer may already have accepted it. Check the transaction record and chain state before you prepare a duplicate action.
:::

## Broadcast a signed transaction

`POST /v1/tx/relay/broadcast` accepts a fully signed transaction envelope as `{ "xdr": "..." }`. It forwards the envelope unchanged. Its transaction source pays the XLM fee.
