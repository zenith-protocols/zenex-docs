---
title: Deploy
sidebar_position: 2
---

# Deploy

`deploy` creates one strategy vault and one market as a pair, in one call. Any address calls it. The `admin` argument authorizes the call, owns the new market, and is the address both contract addresses derive from. The call returns the two addresses, records the market in the factory's registry, and publishes one event. `is_deployed` reads that registry back.

## The call

```rust
fn deploy(
    e: Env,
    admin: Address,
    salt: BytesN<32>,
    token: Address,
    oracle: Address,
    feed_id: BytesN<32>,
    config: Config,
    vault_name: String,
    vault_symbol: String,
    vault_decimals_offset: u32,
) -> (Address, Address);
```

The return is the pair `(market, vault)`, in that order.

| Argument | Type | What it carries |
| --- | --- | --- |
| `admin` | `Address` | The authorizer of the deployment and the owner of the new market. |
| `salt` | `BytesN<32>` | 32 raw bytes. The market address salt, and the source of the vault salt. |
| `token` | `Address` | The settlement token of both contracts. |
| `oracle` | `Address` | The oracle contract the market calls for a price. |
| `feed_id` | `BytesN<32>` | 32 raw bytes. The market's price stream id, immutable on the market. |
| `config` | `Config` | The market's initial configuration, 34 fields. |
| `vault_name` | `String` | The share token name. |
| `vault_symbol` | `String` | The share token symbol. |
| `vault_decimals_offset` | `u32` | The count of extra share decimals over the settlement token's own decimals. |

The factory declares `Config` as a mirror of the market's `Config`. The mirror has the same fields in the same order and the same XDR encoding. The market constructor decodes the value the factory hands it. [Config](../market/config.md) gives every field, its unit, and its bound.

The factory passes `token`, `oracle`, `feed_id`, and `config` straight to the two constructors, and every check on the four values runs there. The market constructor checks the `feed_id` prefix and every `config` bound, and a failed check aborts the whole call. The addresses `token` and `oracle` reach storage as given. The vault constructor calls `decimals` on `token`.

## Authorization

`admin.require_auth` is the first statement of the body. The host then needs the same address to authorize each of the two create-contract sub-invocations, because both deployers are built with `with_address` under `admin`. So `admin` signs the top-level call plus the two sub-invocations. The `admin` argument is the only authorizer of a deploy, and any address can hold that role.

The factory owner controls `set_init_meta` and `upgrade`. [Init meta and constructor](./init-meta.md) covers the first, and [Ownership and upgrade](../ownership.md) covers the second.

## Addresses

`deploy` derives both addresses before either contract exists, so each constructor receives the address of the other.

```text
vault_salt     = sha256(salt || "vault")
market_address = deployed_address(network_id, admin, salt)
vault_address  = deployed_address(network_id, admin, vault_salt)
```

- `admin`: the `Address` argument to `deploy`. Both derivations use it.
- `salt`: the 32 raw bytes of the `BytesN<32>` argument.
- `"vault"`: the five ASCII bytes `0x76 0x61 0x75 0x6c 0x74`.
- `||`: byte concatenation. The preimage is 37 bytes.
- `sha256`: the host SHA-256. Its 32-byte result is `vault_salt`.
- `network_id`: the 32-byte SHA-256 hash of the network passphrase.
- `deployed_address`: the host derivation over the network id, the `admin` address, and the salt. `deploy` builds each deployer with `with_address` under `admin` and reads the address with `deployed_address`.

An address pair depends on `admin` and `salt` and not on the factory address. Two admins that pass the same `salt` get two distinct pairs. No `(admin, salt)` pair derives an address that a pair from another admin also derives. The vault salt comes out of a hash, so one `salt` never fills both roles. A caller cannot pick a `salt` whose derived vault address lands on a chosen address, because `sha256` resists a preimage search.

## Deploy order

`deploy` creates the vault first and the market second. Both addresses exist before either deploy, so each constructor receives its counterpart address as an argument and stores it at creation.

1. `deploy_v2` on the vault deployer installs `vault_hash` from `FactoryInitMeta` and passes the positional constructor tuple `(vault_name, vault_symbol, token, vault_decimals_offset, market_address)`. The vault stores the market address as its immutable strategy and makes no call to it.
2. `deploy_v2` on the market deployer installs `market_hash` and passes the positional constructor tuple `(admin, token, vault_address, oracle, treasury, feed_id, config)`. `treasury` is the address held in `FactoryInitMeta`. The market stores the vault address and makes no call to it.
3. A crate-internal storage helper writes the registry entry for the market address.
4. `deploy` publishes `Deploy` and returns the pair.

`FactoryInitMeta` at the moment of the call fixes the code and the treasury of that pair.

## Registry

```rust
fn is_deployed(e: Env, market: Address) -> bool;
```

Any address calls `is_deployed` without a signature. It returns `true` while the `Pools` entry for `market` is present in the ledger. `deploy` is the only writer of that entry, so a `true` answer means this factory deployed that address. A call that finds the entry also extends the entry's lease under the rule below, so `is_deployed` can write to the ledger. The call returns `false` for an address this factory never deployed. The ledger archives an entry whose lease runs out. A call that reaches an archived entry fails at the host, and a restore at the ledger level puts the entry back.

The factory records the market address. A caller reads the vault address from the `Deploy` event, from `get_vault` on the market, or by a repeat of the derivation above.

## Storage

| Key | Class | Value | Written by | Read by |
| --- | --- | --- | --- | --- |
| `FactoryDataKey::Pools(Address)` | persistent | `bool`, `true` while present | `deploy` | `is_deployed` |

`deploy` sets the lease, and `is_deployed` extends it on a call that finds the entry. Whenever the remaining time to live sits below `LEDGER_THRESHOLD_POOL`, 1,728,000 ledgers, `extend_ttl` raises it to `LEDGER_BUMP_POOL`, 2,073,600 ledgers. At about five seconds per ledger those are about 100 days and about 120 days.

`FactoryDataKey` carries `export = false`, so the exported contract spec holds no entry for it. Its one variant is `Pools(Address)`. A client that reads the ledger entry directly builds the key from the variant symbol `Pools` and the market address.

`deploy` and `is_deployed` renew the factory's own instance lease as their first storage operation. [Init meta and constructor](./init-meta.md) gives the threshold and the bump for that lease.

## Event

`deploy` publishes one event, after both contracts exist and after the registry write.

| Event | Topics after the name | Data |
| --- | --- | --- |
| `deploy` | `trading: Address`, `vault: Address` | empty |

The first topic is the event name symbol, the `Deploy` struct name in lower snake case. Both fields carry `#[topic]`, so they follow as the remaining topics in declaration order. The struct declares no data field, so the data map is empty. `trading` is the deployed market address and `vault` is the deployed strategy-vault address.

## Failures

Every failure of `deploy` comes from the host or from one of the two constructors.

| Condition | Result |
| --- | --- |
| A contract already exists at either derived address | Host trap, with no contract error code. A repeat of `(admin, salt)` is one way to reach it. Any earlier contract at `deployed_address(network_id, admin, salt)` or at the derived vault address is another, whatever created it. |
| `admin` did not authorize the call or one of the two sub-invocations | Host authorization failure, with no contract error code. |
| `feed_id` is not a V3 stream id, or a `config` value breaks a bound, a positivity rule, or an ordering rule | `MarketError::InvalidConfig` (700) from the market constructor. |
| A `config` field inside the sign check of `Config::check_valid` is negative | `MarketError::NegativeValueNotAllowed` (710) from the market constructor. |
| `vault_decimals_offset` is above `MAX_DECIMALS_OFFSET`, 10 decimals | `VaultTokenError::VaultMaxDecimalsOffsetExceeded` (409) from the vault constructor. |
| The sum of the settlement token's decimals and `vault_decimals_offset` overflows `u32` | `VaultTokenError::MathOverflow` (410) from the vault constructor. |
| `token` does not answer the token interface | The vault constructor reads `decimals` on `token`, and the call fails at the host. |

The sign check covers 24 of the 34 fields. A negative value in one of the other `i128` fields fails that field's own positivity or ordering rule, and the code is 700. [Errors](../market/errors.md) holds the market's code table, and [Config](../market/config.md) names the fields in each rule. [Constructor and share token](../vault/share-token.md) holds the vault constructor's arguments and codes.

## Invariants

A `deploy` either creates both contracts, writes the registry entry, and publishes the event, or it changes nothing. A constructor error, a host trap, and a failed authorization each revert the whole call, including the registry write.

The pair `(admin, salt)` determines both addresses, and the factory address is no part of the derivation. A `deploy` traps at the host whenever a contract already holds either address. One `(admin, salt)` yields one market and one vault across every factory.

Authority over a new pair sits with `admin` and the market. `admin` owns the market and holds its configuration and upgrade entries. The market is the vault's registered strategy and the only address that moves the vault's assets. A later `set_init_meta` on the factory reaches deploys that follow it.
