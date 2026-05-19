# Zenex Docs

Docusaurus site for the Zenex perpetuals protocol. Three independent doc trees, each with its own audience and depth. Source for the protocol itself is in `../zenex-contracts/`. Every concrete claim in this repo must hold against that source.

## Doc trees

| Tree | Audience | What goes here |
|---|---|---|
| `docs/` | Traders and LPs | User-facing concepts: what positions are, what fees apply, what risks exist. No function signatures, no fee formulas with variables. |
| `technical/` | Integrators, auditors | Contract surface and protocol mechanics. Function signatures, storage layout, error codes, formulas, event payloads. Audit-grade accuracy required. |
| `integrations/` | SDK / wrapper / keeper / indexer authors | How to call the contracts and decode their output. SDK method tables, wire formats, hosting notes. |

If a fact lives in two trees it should only deepen, not contradict. The user-facing fee page can say "you pay a base fee" while the technical fee page gives the formula. They cannot disagree on whether dominant or non-dominant pays funding.

## Style

**Function names in code spans, no parentheses.** Write `verify_price` not `verify_price()`. Parentheses imply call syntax. We are referring to the function by name. Group related variants under the simpler name where the distinction does not add reader value (`verify_price` covers the singular and plural variants).

**Stellar terminology, not Ethereum.** No "EOA". Use "account" or "keypair-controlled account" or just "key". Stellar accounts and Soroban contracts are distinct on this chain. Let context carry the distinction.

**Soroban forbids reentrancy at the host level.** Do not justify architectural choices with "reentrancy protection" or "reentrancy analysis". Pick a different rationale: explicit call graph, storage-ownership clarity, simpler reasoning about state mutations.

**Prefer one paragraph to five bullets** for narrative explanation. Reference tables (function lists, error codes, storage keys) are bullets/tables. Mechanics and rationale are prose.

**Shortest correct description wins.** Don't restate what a function name and signature already say. Reach for a paragraph when type names leave something unsaid: unit conventions, side effects, preconditions, invariants that span multiple calls.

**The reader has not lived through the decisions.** Do not write "previously this validated entry price, now it does not", "the old signature was X", "we removed the per-user cap". State the current behavior as a fact. Contrast with old behavior belongs in commit messages and PR descriptions.

## Verification expectations

Every claim in `technical/` and `integrations/` must be checkable against `../zenex-contracts/`. Before asserting:

- Function signatures: grep the trait in `trading/src/contract.rs` (or the relevant crate's `lib.rs` / `contract.rs`)
- Error codes: `trading/src/errors.rs`, `governance/src/errors.rs`, `strategy-vault/src/strategy.rs`, etc.
- Storage keys and TTLs: each crate's `src/storage.rs`
- Constants: each crate's `src/constants.rs`
- Cross-contract interfaces: `trading/src/dependencies/*.rs`

## What not to do here

- **No em-dashes (`—`) or en-dashes (`–`).** Reach for a period, a comma, parentheses, or split into two sentences. They read as AI-generated prose. CLI flags like `--persist-to` are fine. This rule is about prose.
- **No semicolons in prose.** Same reasoning: they read as AI cadence and the same job is done better by a period or by restructuring the sentence. Code samples are exempt.
- **No integrator advice in `technical/` docs.** Technical pages document what the contract does. SDK defaults, recommended values, builder cautions, and frontend UX guidance belong in `integrations/`. The line: if it's a fact about the protocol, it goes in `technical/`. If it's a suggestion about how to call it, it goes in `integrations/`.
- **No internal-process commentary.** This is a public docs site. No mentions of "the audit", "the auditor asked for", "this was a critical fix", "we discovered in testing".
- **No code dumps.** Function bodies live in the contract source. This site shows signatures and explains behavior. The exception is short illustrative snippets (5-10 lines) for an SDK example.
- **No half-documented features.** If `min_deposit` is in the constructor but undocumented anywhere, either add it or do not document the constructor at all. Partial reference docs mislead worse than missing ones.
- **No emoji** unless the user has explicitly asked.
