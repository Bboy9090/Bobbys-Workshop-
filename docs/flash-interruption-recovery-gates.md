# Qualified flashing: interruption recovery and release gates

Status: **design and acceptance criteria only**. This document does not authorize physical writes or change signed builds.

## Existing verified virtual coverage
- Qualified write success requires an explicit accepted write result.
- Post-write target re-enumeration runs only after a successful write.
- Synthetic BrokenPipe write failure never launches post-write target verification.
- Disconnected targets exhaust a bounded retry policy and fail closed.

## Required operator-visible transaction states
1. `PREFLIGHT`: device identity, exact serial, firmware provenance/hash, partition allowlist, USB transport, and qualification grant checked.
2. `WRITE_IN_PROGRESS`: do not unplug; mutation may be partial.
3. `WRITE_INTERRUPTED_UNKNOWN_STATE`: any transport interruption, timeout, process crash, or ambiguous write acknowledgment. Never label successful. Disable automatic reflash and disable post-write success verification.
4. `AWAITING_REENUMERATION`: only after unambiguous successful write acknowledgment.
5. `POST_WRITE_VERIFIED`: the same target serial returns and required read-only checks pass. This is not equivalent to boot success.
6. `BLOCKED_REQUIRES_REVIEW`: firmware mismatch, missing target, revoked/expired grant, unsafe partition, or insufficient evidence.

## Durable evidence to implement before production qualification
Capture a transaction ID; start/end timestamps; application/executor build fingerprints; device model, selected serial and read-only hardware identifiers; mode transitions; package identity, source, SHA-256 and target partition; redacted exact command arguments; qualified grant reference without secret material; transport/exit status; write acceptance evidence; re-enumeration attempt count; terminal state and explicit uncertainty reason. Persist append-only state transitions with flush semantics suitable for crash recovery. Scrub secrets and personal device data. Never record raw credential tokens.

On restart, any transaction without a trustworthy terminal state must reopen as `WRITE_INTERRUPTED_UNKNOWN_STATE`, not as succeeded, and cannot resume a write automatically.

## Operator guidance on interruption
Present: **Write interrupted; target contents may be incomplete. Do not reboot or retry automatically.** Keep the device connected where safe, capture read-only identifiers and logs, recheck exact firmware and device model, then require an explicit reviewed recovery path. Do not imply that re-enumeration proves partition integrity. Escalate uncertain partitions to an authorized recovery procedure.

## Acceptance matrix
| Scenario | Required result |
| --- | --- |
| Clean virtual write and same target returns | Post-write verified (read-only validation still required) |
| Write reports FAILED despite zero exit code | Block and preserve failure evidence |
| BrokenPipe/disconnect during write | Unknown state; zero post-write verification calls; zero automatic retry |
| Timeout or process crash while writing | Unknown state persisted and restored after restart |
| Successful write but target absent after bounded retries | Block; never claim success |
| Different serial appears | Reject wrong target; block |
| Package hash or model mismatch | Fail preflight before any write |
| Missing/expired/incorrect grant | Fail preflight |
| Evidence sink fails during transaction | Fail closed; flag evidence incomplete |
| UI refreshed or application restarted | Prior ambiguous operation remains blocked, never resumed automatically |

## Release decision
This matrix is **not implemented or passed** merely by adding this document. Require test code, local results, fresh CI for the actual head, evidence-review signoff, model-specific supported recovery SOP, authorized sacrificial lab device, and controlled physical verification before lifting device write restrictions. Galaxy A17 physical flashing remains unqualified.
