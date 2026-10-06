---
title: Wallets and direct transactions
sidebar_label: Wallets and direct calls
description: Connect a signer, build a direct Stellar transaction, and distinguish envelope signatures from contract authorizations.
---

# Wallets and direct transactions

A wallet supplies an owner address and signs its actions. The SDK builds calls. Your application chooses the submission path.

## Choose the signature your flow needs

| Flow | Wallet signs | Transaction source |
| --- | --- | --- |
| Direct account transaction | Prepared transaction envelope | User's Stellar account |
| Hosted relay | Soroban authorization entries | Relayer account |
| Smart-wallet relay | Entries accepted by the smart wallet's authorization rules | Relayer account |

Check the wallet's capabilities before you present a relay option. A transaction-signing wallet can use direct submission when it cannot sign authorization entries. Keep private keys and passkey material in the signer. Pass public addresses, signed entries, and signed envelopes to services. Read [what users sign](/account/signing) for the review your interface should show.

## Smart wallets and automation

An automated program can sign for its own Stellar account. Its public address owns its orders and positions.

For a contract owner, use the smart wallet's account library. It manages account creation, verifier signatures, and session rules. Zenex calls use that owner's contract address. A session rule can authorize a local session key until its expiry. The deployed policy pins its markets, settlement token, fee forwarder, and fee recipient.

Protect the session key. Remove the wallet's context rule on chain to revoke its authority, then wait for confirmation. A local disconnect does not revoke it. Use [the session policy reference](/technical/session-policy) for its exact authorization scope. Use [one-click trading](/account/one-click-trading) for the user-facing consent flow.

:::warning The session policy has no amount cap
The policy restricts call destinations. It allows market actions without a spending limit. A transaction's relay fee cap does not limit later session trades.
:::

## Prepare a direct account transaction

This function prepares a router batch for a Stellar account. Use the user's account as `source`.

```ts
import { TransactionBuilder, rpc, xdr } from "@stellar/stellar-sdk";
import {
  MarketRouterContract, parseError, type Call, type Network,
} from "@zenith-protocols/zenex-sdk";

async function prepareDirect(
  network: Network, source: string, routerId: string, calls: Call[],
): Promise<string> {
  const server = new rpc.Server(network.rpc, network.opts);
  const account = await server.getAccount(source);
  const operation = new MarketRouterContract(routerId).multicall(calls);
  const transaction = new TransactionBuilder(account, {
    networkPassphrase: network.passphrase, fee: "100",
  }).addOperation(xdr.Operation.fromXDR(operation, "base64")).setTimeout(180).build();
  const simulation = await server.simulateTransaction(
    transaction, undefined, "record_allow_nonroot",
  );
  if (rpc.Api.isSimulationError(simulation)) throw parseError(simulation);
  if (rpc.Api.isSimulationRestore(simulation)) throw new Error("Restore state first");
  return rpc.assembleTransaction(transaction, simulation).build().toXDR();
}
```

Send the result to the wallet's transaction-signing method. Decode its returned envelope with the same network passphrase. Submit it through Stellar RPC. The user's envelope signature covers source-account authorization below the router. `record_allow_nonroot` allows simulation to discover that nested authorization.

The example inclusion fee is 100 stroops. Assembly adds the simulated resource fee. Choose an inclusion fee for your application's fee policy. For Soroban simulation details, consult [Stellar transaction simulation](https://developers.stellar.org/docs/learn/fundamentals/contract-development/contract-interactions/transaction-simulation).

A different source account needs separate user authorization entries. A contract owner needs its smart wallet's signing flow. Use [the relay guide](./relay) for that boundary.

:::warning Simulate before the wallet signs
The prepared envelope includes its footprint and resource fee. Rebuild and request a new signature if those transaction fields change.
:::

## Select batch behavior

| SDK method | Confirmed result |
| --- | --- |
| `multicall` | Every call succeeds or the whole batch reverts |
| `multicallTry` | Each call returns an individual outcome |
| `createAndFill` | Creates the batch and fills its first order atomically |
| `createAndTryFill` | Creates the batch and reports whether its first order filled |

`createAndFill` needs a signed price report. Its first call must create the order it fills. Other created orders remain pending. The SDK marks `createAndTryFill` as a low-level compatibility method. Use the strict `createAndFill` path when the interface promises an immediate fill.

Inspect every `CallOutcome` from `multicallTry`. `ok` selects `value` or `error`. A host failure can abort the whole transaction.

The router collects no relay fee. Read [router batching](/technical/router/batching) for the contract rules.

## Confirm the result

Store the transaction hash before you wait. `sendTransaction` acceptance means submission. Poll `getTransaction` for a confirmed result.

On success, refresh chain state and inspect the relevant order or fill. A confirmed create-only transaction can leave an order pending.

On failure, decode contract errors with `parseError`. Preserve raw RPC diagnostics when its result is unknown. Read [pending and failed transactions](/account/transactions) for the status your interface should show.

:::warning Resolve an uncertain submission before repeating it
A timeout can happen after the network accepts the transaction. Check its hash and current state before you create another order.
:::
