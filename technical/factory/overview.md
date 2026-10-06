---
sidebar_position: 1
title: Factory
description: Find the factory references for atomic deployment and the settings used for new markets.
---

# Factory

`FactoryContract` deploys a market and its strategy vault atomically. The caller supplies the market inputs. The factory owner controls code hashes, the treasury binding, and factory upgrades.

| Page | What it holds |
| --- | --- |
| [Deploy](./deploy.md) | `deploy`, deterministic addresses, authorization, deployment order, receipts, and `is_deployed`. |
| [Init meta and constructor](./init-meta.md) | Constructor, deployment settings, ownership, upgrades, events, and storage. |
