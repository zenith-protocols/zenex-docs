# Writing the Zenex docs

These rules keep each page useful to its reader. They preserve the audience,
source verification, and plain-language requirements of the docs-site standard.

## Three readers

| Tree | Reader and job | Include | Link elsewhere |
| --- | --- | --- | --- |
| `docs/` | Traders and liquidity providers deciding what to do. | Actions, permissions, costs, results, and risks in ordinary words. | Contract signatures, storage, formulas, and developer setup. |
| `integrations/` | Developers building an app, tool, or bot. | Working workflows, verified SDK examples, HTTP formats, signing responsibilities, and failure handling. | Complete contract reference and operator runbooks. |
| `technical/` | Developers and reviewers checking the contract rules. | Architecture, trust boundaries, complete interfaces, units, authorization, state, events, errors, and exact formulas. | Step-by-step integration advice. |

The regular docs include short how-to pages. Advice belongs where it helps the
reader act, including wallet setup, signature review, and transaction recovery.

Integrations source is currently unpublished. Keep it out of site navigation and
search. Validate its links and SDK examples before enabling it again.

## Give every page one job

Start with a sentence that answers the page's main question. Use a description
in front matter so search previews explain why the reader should open it.

A navigation hub routes readers to its children. Use one short paragraph and a
table or a few cards. Do not retell the child pages.

An architecture overview explains how the contracts work together. Preserve
responsibilities, authority, custody, shared dependencies, and the flow across
calls, then link to the detailed references. Label diagram arrows and distinguish
contract calls, token transfers, and authorization. Keep method inventories and
formulas in child pages; keep relationships that require several pages to
understand in the overview. Contract overviews also retain the authority and
dependency relationships needed to interpret their interfaces.

An ordinary page explains one decision or mechanism. Aim for 200 to 450 words.
Orders, liquidation, signing, and vault withdrawal can need 450 to 700 words.
These are review targets, not reasons to omit a material risk.

An integration guide demonstrates one complete workflow. Split independent
workflows into separate pages. Keep reference tables only when they help the
reader choose a method or interpret its result.

Technical length follows interface completeness. Keep every documented
argument, unit, authorization requirement, event field, and error condition.
Remove repeated narration before removing a fact.
Shorten technical pages by removing repeated mechanics, while preserving the
relationships and assumptions needed to understand the system.

## One home per fact

Explain a mechanism on its main page. Link to that explanation from the
quickstart, FAQ, hubs, and related mechanisms.

An architecture overview can summarize facts to explain their relationship.
Keep the complete mechanism in its reference, and link to it from the summary.

A warning can repeat the short consequence at the point of action. It should
link to the full rule. This exception keeps an important limit visible without
copying the whole mechanism.

Contract facts deepen across the three trees. Check the technical reference
against source first, then update the user-facing effect and integration flow.

## Place callouts where decisions happen

| Type | Use |
| --- | --- |
| `info` | A surprising rule or distinction the reader needs to interpret the result. |
| `warning` | A pitfall that can spend funds, broaden permission, block an exit, or create duplicate exposure. |
| `danger` | A direct material loss or funds being held, such as liquidation or a market freeze. |
| `tip` | A useful optional workflow improvement. |
| `note` | Limited context that does not affect the decision. |

Give the callout a concrete sentence-case title. Use one compact paragraph by
default. Add a paragraph break only for distinct ideas that need separation;
do not separate a risk from its immediate consequence or its reference link.

Keep the explanation concrete enough to stand on its own. State what triggers
the problem, what can happen, and what the reader is left with. Brevity must not
turn a warning into a slogan. For a stop loss, explain the keeper's fill, the
possible worse exit price, and the position's exposure until execution.

Keep each topic's explanation and instructions together, then place its warning
at the bottom of that section before the next heading. The reader should
understand the action and its result before reading the caveat. Follow GMX's
feature sections rather than inserting a banner between a short introductory
sentence and the actual instructions. Do not add filler to create a banner slot.

For reference pages, finish the rule, arguments, examples, or result the caveat
qualifies, then place the callout beside that complete topic. Informational
notes can follow their subject too. Do not collect unrelated warnings at the
bottom of a page. Keep ordinary explanations in the main text when a banner
adds no useful emphasis.

The Risks page summarizes consequences but does not replace warnings beside
the relevant signature, permission, order field, or withdrawal. Avoid several
consecutive callouts or generic warnings on every page.

Describe the risk that remains after the app's calculations and safeguards.
Do not ask users to compensate for work the app already does. When a preview
can differ from execution, name the resulting effect in either direction.
Check which safeguards the app applies to that exact order type or workflow.
Do not imply that a configurable contract feature is enabled in the app.
Keep narrow contract edge cases in Technical or focused troubleshooting rather
than leading an ordinary walkthrough with them.

For trading fees, the app already accounts for the estimate. The remaining
uncertainty is the fee at the fill, which changes net collateral and leverage.
Do not frame this as a need to manually leave room for those fees.

## Sources

Use the latest fetched `origin/main`, rather than assuming a sibling working
branch is main. Record the revisions used for a substantial review.

| Repository | Authority |
| --- | --- |
| `zenex-contracts` | Core market, vault, oracle, factory, treasury, and governance behavior. |
| `zenex-util-contracts` | Router, fee forwarder, session policy, wallet factory, and referral attribution. |
| `zenex-sdk-js` | Exported TypeScript names, arguments, return types, and package requirements. |
| `zenex-trade` | Supported wallet flows, app controls, signature presentation, and submission handling. |
| `zenex-backend` | Public config, data API, relay proxy routes, and access restrictions. |
| `relayer-plugin-zenex` | Relay preparation, fee calculation, signed scope, and submission semantics. |
| `zenex-indexer` | Ingestion, projection, event decoding, and freshness metadata. |

Check SDK names in exports and code. A README or release candidate alone does
not establish that a method exists on main. Verify installation instructions.
Do not promise an npm release without checking the registry.

Verify routes and JSON shapes from handlers and runtime dependencies. A service
type declaration can lag its actual response.

Published pages name verified symbols rather than internal file paths. Use
source links only when they help the reader check a claim.

## Live values

`docs/deployments.md` is generated. Never edit it by hand. Change its generator
or reviewed record, then run `npm run deployments` with a mainnet RPC endpoint.

The generator checks chain state, public app config, and reviewed code hashes.
Other pages link to Deployments for live addresses, rates, owners, and settings.
Examples clearly identify illustrative amounts and validate network matching.

## Language and layout

Use short active sentences, ordinary words, and sentence-case headings. Aim for
20 words per instruction and 25 per description. Accuracy takes priority.

Group related sentences into a compact paragraph. A paragraph break should
signal a new idea, not just a new sentence. Avoid runs of isolated one-sentence
paragraphs and separate link-only lines when the link belongs to the preceding
explanation. Keep distinct choices, steps, and definitions easy to scan.

Describe the relay's discretion alongside its limits: the signed maximum
caps the relay fee, and order terms, any price bound, and oracle freshness
checks constrain the fill. Do not suggest that the backend can freely change
signed order terms or spend arbitrary amounts. A market-order slippage bound
does not imply that the app's limit and stop orders have one. Keep follow-up
instructions in the workflow rather than adding them to the trust warning.

Use one term for one concept. Distinguish transaction confirmation from order
creation and fill. Distinguish a relay fee from an order execution fee. Distinguish
signature expiry, order expiry, and session expiry.

Keep formulas in Technical. Define every variable and unit beside its exact
contract formula. Use atomic `bigint` inputs in integration examples. Display
estimates must not become transaction amounts.

Use tables for comparable choices or outcomes. Use numbered steps for a
workflow. Use a small diagram only when it makes roles or stages clearer.

Avoid history, internal review narratives, marketing promises, emojis, and
unverified safety claims. Keep wallet secrets and operator details out of public
examples. Keep proposed sibling-repository docs in `local-drafts/`.

## Check before publishing

Run `npm run typecheck`, `npm run build`, and `git diff --check`. The build must
reject broken pages and anchors in both published trees.

Compile changed integration snippets against the documented SDK revision.
Exercise read-only examples when a suitable endpoint is available.

Inspect a production build on desktop and mobile. Check all landing pages,
sidebar order, search, callouts, diagrams, tables, and the most consequential
workflow. Preserve shared URLs or add a redirect when a route changes.

The preview can override the canonical origin with `DOCS_SITE_URL`. The default
production origin remains `https://docs.zenex.trade`.
