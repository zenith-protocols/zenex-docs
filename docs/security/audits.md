---
sidebar_position: 1
title: Audits
---

# Audits

Security is a foundational priority for Zenex. Smart contract audits are a core part of the protocol's security strategy, providing independent verification that the contracts behave as intended and that critical vulnerabilities have been identified and addressed.

## Current Status

Formal security audits for Zenex smart contracts are currently in preparation. This page will be updated with full audit reports, detailed findings, and remediation documentation as they become available. Each audit report will include the scope of contracts reviewed, the severity classification of any findings, and the steps taken to resolve each issue.

## Internal Security Practices

While external audits are being arranged, the protocol undergoes rigorous internal security review. This includes systematic threat modeling following the Stellar threat modeling framework, which maps every attack surface and documents the mitigations in place. The contract test suite includes comprehensive integration tests that exercise critical paths such as position lifecycle, fee accrual, liquidation, and auto-deleveraging across a range of market conditions. Property-based fuzzing is used to test invariants with randomized inputs, searching for edge cases that manual testing might miss.

The protocol's smart contracts are also designed with defensive patterns: all user inputs are validated at entry points, access control is enforced through Stellar's native authorization model, and critical addresses (vault, price verifier, treasury) are immutable after deployment.

## Reporting Vulnerabilities

If you discover a potential vulnerability in any Zenex smart contract, please report it through the [Bug Bounty](./bug-bounty.md) program. Responsible disclosure helps keep the protocol and its users safe.
