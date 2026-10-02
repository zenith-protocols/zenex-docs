---
sidebar_position: 1
title: Treasury
---

# Treasury

The `TreasuryContract` is the protocol's fee sink. It stores the rate that sets the treasury's share of each fee the market splits and receives the tokens that the market pays it at settlement. Its owner is the only party that moves those tokens out again. The contract defines four entries, `__constructor`, `get_rate`, `set_rate`, and `withdraw`, and it publishes an event for each of `set_rate` and `withdraw`. One child page holds all of them. The four `Ownable` entries the same contract exports are on the [ownership section](./fee-rate.md#ownership) of that page.

| Page | What it holds |
| --- | --- |
| [Fee rate and withdrawal](./fee-rate.md) | The four entries, the fee rate with its scale and bound, the storage and its time to live (TTL), the errors, the events, and the invariants. |
