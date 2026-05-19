---
sidebar_position: 2
title: Deposit Lock
---

# Deposit Lock

Every deposit or mint operation records a `DepositLock` for the recipient in persistent storage, containing the current timestamp and the number of locked shares:

```text
DepositLock[receiver] = { timestamp: current_timestamp, shares: locked_shares }
```

The recipient cannot withdraw, redeem, or transfer the locked shares until the lock period expires. The unlock time is computed as:

```text
unlock_time = deposit_lock.timestamp + lock_time
```

where `lock_time` is the global lock duration stored in instance storage.

## Lock Tracks the Receiver

The lock is applied to the **receiver** of the shares, not the caller who initiated the deposit. If Alice deposits on behalf of Bob, Bob is the one who becomes locked. Alice's own lock state is unaffected.

## New Deposits Accumulate Locked Shares

If a user deposits again while the previous lock is still active, the new shares are added to the existing locked count and the timestamp resets to the current block time. The user must wait the full lock duration again from the new timestamp.

If the previous lock has already expired, the lock resets to only the newly deposited shares. Expired locks do not carry over.

The `available_shares(user)` public query function returns the number of shares that a user can currently transfer, withdraw, or redeem. It subtracts the locked share count from the user's total balance when the lock is active, returning zero if the locked amount exceeds the balance.

## Transfer Lock Behavior

Only newly minted shares are locked. The lock tracks the receiver of a `deposit` or `mint` and is not a property of the shares themselves, so shares received via `transfer` or `transfer_from` arrive unlocked at the recipient.

Both `transfer` and `transfer_from` still require the **sender** to pass the lock check on their own balance. This prevents a locked user from sidestepping the restriction by moving shares to a second address and withdrawing from there.

## Error Codes

| Error | Code | Trigger |
|---|---|---|
| `SharesLocked` | 791 | Withdraw, redeem, or transfer attempted while the lock has not expired |
