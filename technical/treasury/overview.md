---
sidebar_position: 1
title: Treasury
---

# Treasury

The `TreasuryContract` holds one rate, the treasury's share of every protocol fee, and a balance in every token that reaches its address. The market reads that rate at each settlement and funds the treasury with a plain token transfer to its address. The owner is the only party that moves tokens back out, and each withdrawal names the token contract to move. The page below gives the four entries the contract defines. [Ownership and upgrade](../ownership.md) gives the four `Ownable` entries that the same contract exports.

| Page | What it holds |
| --- | --- |
| [Fee rate and withdrawal](./fee-rate.md) | The fee rate with its scale and bound, the four entries that set it at deploy, read it, change it, and move tokens out, their errors, and their invariants. |
