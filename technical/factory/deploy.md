---
title: Deploy
sidebar_position: 2
---

# Deploy

This page covers `deploy` and `is_deployed`. `deploy` creates one strategy vault and one market as a pair in a single call. `is_deployed` reads the registry of markets that `deploy` writes. Any account may call `deploy`, and the signature of `admin` is the only authorization it needs. The call returns both addresses, records the market, and publishes one event.

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
| `config` | `Config` | The initial market configuration, 34 fields. |
| `vault_name` | `String` | The share token name. |
| `vault_symbol` | `String` | The share token symbol. |
| `vault_decimals_offset` | `u32` | The count of extra decimals that share-dec adds to the decimals of the settlement token. |

The factory declares `Config` as a mirror of the market's `Config`. Both use the same fields in the same order and the same XDR (External Data Representation, the Stellar encoding of contract values). That match lets the market constructor decode the value the factory hands it. [Config](../market/config.md) gives every field, its unit, and its bound.

The factory passes `token`, `oracle`, `feed_id`, and `config` unchanged to the two constructors. Every check on these values runs in the constructors. The market constructor checks that `feed_id` carries the `0x0003` prefix of a V3 stream and checks every `config` bound. If a check fails, the whole call aborts. The market stores `token` and `oracle` as given. The vault constructor calls `decimals` on `token`.

## Authorization

`admin.require_auth` is the first statement of the body. The host then needs the same address to authorize each of the two create-contract sub-invocations, because the factory builds both deployers with `with_address` under `admin`. So `admin` signs the top-level call and both sub-invocations. A signature from any other address fails the top-level call or a sub-invocation. This binding also stops another account from front-running a `salt`.

## Both addresses derive from `admin` and `salt`

`deploy` derives both addresses before either contract exists, so each constructor receives the address of the other.

```text
vault_salt     = sha256(salt || "vault")
market_address = deployed_address(network_id, admin, salt)
vault_address  = deployed_address(network_id, admin, vault_salt)
```

Where:

- `admin` is the `Address` argument to `deploy`. Both derivations use it.
- `salt` is the 32 raw bytes of the `BytesN<32>` argument.
- `"vault"` is the five ASCII bytes `0x76 0x61 0x75 0x6c 0x74`.
- `||` is byte concatenation. The preimage is 37 bytes.
- `sha256` is the host SHA-256 hash. Its 32-byte result is `vault_salt`.
- `network_id` is the 32-byte SHA-256 hash of the network passphrase.
- `deployed_address` is the host derivation over the network id, the `admin` address, and the salt.

The market address uses `salt` and the vault address uses `vault_salt`, so the two addresses of a pair always differ. A hash separates the two roles for a reason. A reversible change to `salt`, such as a bit flip, would pair two salts so that the vault of one lands on the market of the other. The factory address takes no part in the derivation. Two admins that pass the same `salt` get two distinct pairs. A caller cannot choose a `salt` whose vault address lands on a target address, because `sha256` resists a preimage search.

| Call | Result |
| --- | --- |
| `admin` A with `salt` S | Pair 1. The market address derives from `(A, S)` and the vault address from `A` and the hash of `S` with `"vault"`. |
| `admin` B with `salt` S | Pair 2, distinct from pair 1, because `admin` scopes each pair. |
| `admin` A with `salt` S a second time | Host trap, because a contract already exists at the derived market address. |

One `(admin, salt)` therefore yields one market and one vault across every factory.

## The vault deploys first and the market second

The factory creates the vault, then the market, then the registry entry. `deploy_v2` is the host call that creates a contract and runs its constructor.

1. `deploy_v2` on the vault deployer installs `vault_hash` from `FactoryInitMeta`. It passes the positional constructor tuple `(vault_name, vault_symbol, token, vault_decimals_offset, market_address)`. The vault stores the market address as its immutable strategy and makes no call to it.
2. `deploy_v2` on the market deployer installs `market_hash`. It passes the positional constructor tuple `(admin, token, vault_address, oracle, treasury, feed_id, config)`. `treasury` is the address held in `FactoryInitMeta`. The market stores the vault address and makes no call to it.
3. The factory writes the registry entry for the market address.
4. `deploy` publishes `Deploy` and returns the pair.

The market is the only address that deposits into, redeems from, or withdraws from the vault. `FactoryInitMeta` at the moment of the call fixes the code and the treasury of the pair. The factory owner replaces it with `set_init_meta`, so the `admin` of a new pair trusts the owner for both. [Init meta and constructor](./init-meta.md) covers that call and the [owner surface](./init-meta.md#owner-surface) covers `upgrade`.

## The registry records markets only

```rust
fn is_deployed(e: Env, market: Address) -> bool;
```

Any account calls `is_deployed` without a signature. It returns `true` while the `Pools` entry for `market` is present in the ledger. `deploy` is the only writer of that entry, so a `true` answer means this factory deployed that market.

The call returns `false` for any address that is not a registered market. That covers an address this factory never deployed. It also covers the vault of a pair this factory did deploy, because `deploy` registers only the market address. A caller reads the vault address from the `Deploy` event, from `get_vault` on the market, or by repeating the derivation above.

A call that finds the entry extends the entry's time to live (TTL), so `is_deployed` can write to the ledger. The ledger archives an entry whose TTL runs out. A call that reaches an archived entry fails at the host and does not return `false`. A failed call therefore proves nothing about a market. A restore of the entry at the ledger level makes `is_deployed` return `true` again.

## Storage

| Key | Tier | Value | Written by | Read by |
| --- | --- | --- | --- | --- |
| `FactoryDataKey::Pools(Address)` | persistent | `bool`, `true` while present | `deploy` | `is_deployed` |

`deploy` sets the TTL of the entry, and `is_deployed` extends it on a call that finds the entry. If the remaining TTL is below `LEDGER_THRESHOLD_POOL`, 1,728,000 ledgers, `extend_ttl` raises it to `LEDGER_BUMP_POOL`, 2,073,600 ledgers. At about five seconds per ledger those are about 100 days and about 120 days.

No entry point or event reaches `FactoryDataKey`, so spec shaking strips it from the exported contract spec. The type also carries `export = false`, which the SDK treats as a deprecated no-op. Its one variant is `Pools(Address)`. A client that reads the ledger entry directly builds the key from the variant symbol `Pools` and the market address.

`deploy` and `is_deployed` extend the factory's instance TTL as their first storage operation. [Init meta and constructor](./init-meta.md) gives the threshold and the bump.

## Event

`deploy` publishes one event, after both contracts exist and after the registry write.

| Event | Topics after the name | Data |
| --- | --- | --- |
| `deploy` | `trading: Address`, `vault: Address` | empty |

The first topic is the event name symbol, the `Deploy` struct name in lower snake case. Both fields carry `#[topic]`, so they follow as the remaining topics in declaration order. The struct declares no data field, so the data map is empty. `trading` is the deployed market address. The topic keeps that name so an indexer decodes past events by topic name. `vault` is the deployed strategy vault address.

## Failures

Every failure of `deploy` traps in the host. The host reports the failure as `Error(Context, InvalidAction)`, and the contract error code of a constructor rejection remains in host diagnostic events. The codes in the table are diagnostic causes, and the caller does not receive them as the result.

| Condition | Diagnostic cause |
| --- | --- |
| A contract already exists at either derived address | `Error(Storage, ExistingValue)`, with no contract error code. A repeat of `(admin, salt)` reaches it. Any earlier contract at `deployed_address(network_id, admin, salt)` or at the derived vault address reaches it too, whatever created it. |
| `admin` did not authorize the call or one of the two sub-invocations | `Error(Auth, InvalidAction)`, with no contract error code. |
| `vault_hash` or `market_hash` in `FactoryInitMeta` names WebAssembly (WASM) code that is not installed | `Error(Storage, MissingValue)`, with no contract error code. |
| `vault_hash` or `market_hash` names code that does not fit its constructor tuple | `Error(WasmVm, UnexpectedSize)`, with no contract error code. |
| `feed_id` is not a V3 stream id, or a `config` value breaks a bound, a positivity rule, or an ordering rule | `MarketError::InvalidConfig` (700) from the market constructor. |
| A `config` field inside the sign check of `Config::check_valid` is negative | `MarketError::NegativeValueNotAllowed` (710) from the market constructor. |
| `vault_decimals_offset` is above `MAX_DECIMALS_OFFSET`, 10 decimals | `VaultTokenError::VaultMaxDecimalsOffsetExceeded` (409) from the vault constructor. |
| The sum of the decimals of `token` and `vault_decimals_offset` overflows `u32` | `VaultTokenError::MathOverflow` (410) from the vault constructor. |
| `token` is not a live contract | `Error(Storage, MissingValue)` from the `decimals` call of the vault constructor. |
| `token` is a contract with no `decimals` function | `Error(WasmVm, MissingValue)` from the `decimals` call of the vault constructor. |
| `decimals` on `token` returns a value that does not decode as `u32` | `Error(WasmVm, InvalidAction)` from the `decimals` call of the vault constructor. |

The sign check covers 24 of the 34 fields. Two of the other ten are `u64` fields and cannot be negative. A negative value in one of the other eight `i128` fields fails the positivity, bound, or ordering rule of that field. The diagnostic cause is then 700. [Errors](../market/errors.md) holds the code table of the market, and [Config](../market/config.md) names the fields in each rule. [Constructor and share token](../vault/share-token.md) holds the constructor arguments and codes of the vault.

## Invariants

A `deploy` either creates both contracts, writes the registry entry, and publishes the event, or it changes nothing. A constructor rejection, a host trap, and a failed authorization each revert the whole call, including a vault that already exists in that call. A failed call leaves the ledger unchanged and publishes no event. The same `(admin, salt)` is still free, so a corrected retry succeeds.

Both addresses are fixed by `(admin, salt)` alone, so a caller knows them before the call runs. The market and the vault each hold the address of the other from the moment of creation.
