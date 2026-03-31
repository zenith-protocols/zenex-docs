---
sidebar_position: 2
title: Deposit Lock
---

# Deposit Lock

Every deposit or mint operation records the recipient's timestamp in persistent storage:

```text
LastDepositTime[receiver] = current_timestamp
```

The recipient cannot withdraw, redeem, or transfer shares until the lock period expires. The unlock time is computed as:

```text
unlock_time = last_deposit_time + lock_time
```

where `lock_time` is the global lock duration stored in instance storage.

## Lock Tracks the Receiver

The lock is applied to the **receiver** of the shares, not the caller who initiated the deposit. If Alice deposits on behalf of Bob, Bob is the one who becomes locked. Alice's own lock state is unaffected.

## New Deposits Reset the Timer

If a user deposits again while still locked, the timer restarts from the current block timestamp. There is no accumulation or extension relative to the previous lock. The new deposit simply overwrites `LastDepositTime` with the current timestamp, so the user must wait the full lock duration again from that point.

## Transfer Lock Behavior

Both `transfer` and `transfer_from` require the **sender** to pass the lock check. This prevents a locked user from circumventing the withdrawal restriction by moving shares to a second address and withdrawing from there.

However, shares received via transfer (not deposit) carry no lock of their own. A user who receives shares through a transfer and has never personally deposited into the vault is never locked. The lock is tied exclusively to the act of depositing, not to the shares themselves.

## Error Codes

| Error | Code | Trigger |
|---|---|---|
| `SharesLocked` | 421 | Withdraw, redeem, or transfer attempted while the lock has not expired |
