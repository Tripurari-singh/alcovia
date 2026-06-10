# DECISIONS.md — Alcovia Sync Architecture

## Data / Sync Model

### On-device storage
Each device uses AsyncStorage with a per-device namespace (`alcovia_{deviceId}`). The deviceId is generated once and persisted in localStorage (web) or a static value (native). This ensures two browser tabs or two phones have completely separate local state.

### Server storage
SQLite via better-sqlite3. WAL mode for concurrent reads. Single `student_001` hardcoded.

### Sync protocol: Push-then-Pull (append-log style)
1. **Push**: device sends all unsynced local changes to server endpoints.
2. **Pull**: device fetches all server state changed since `lastSyncAt`.
3. **Merge**: client and server both resolve conflicts deterministically.

---

## Conflict Resolution

### Focus Sessions (append-only, idempotent by session ID)
Sessions are immutable once created. The server inserts on first receipt, ignores subsequent arrivals with the same `id`. Rewards (`reward_applied = 1`) are applied atomically in SQLite with a guard: `IF reward_applied = 0`. This means even if both devices sync the same session, coins/streak advance exactly once.

### Tasks (Vector Clocks)
Each task carries a vector clock `device_clock: { deviceId: lamportTime }`. On every local edit, the device ticks its own counter.

**Resolution rules (applied identically on client and server):**
- **A strictly after B**: A's version wins (overwrite).
- **B strictly after A**: B's version wins.
- **Concurrent (neither dominates)**: merge vector clocks, apply semantic rule:
  - If either side deleted the task → **deletion wins** (soft-delete is irreversible without an explicit "restore" action).
  - Otherwise → **higher status wins** (done > in_progress > not_started), because a student progressing forward is the dominant intent.

**Why this converges:** Both server and client apply the exact same deterministic merge function. After a full push-pull cycle, all clocks are merged to the same maximum, and the same winning value is stored everywhere. Two devices with diverged state will, after syncing through the server, hold identical task states.

### Subjects & Chapters (Logical timestamp / LTS wins)
These change rarely (seeded once, rarely edited). We use `updated_at` (server milliseconds timestamp, applied at write time). This is safe because subjects/chapters are not concurrently edited in normal use; conflicts here are rare enough that LTS is acceptable.

**Wall-clock caveat**: We do NOT use wall-clock time for task conflict resolution precisely because device clocks disagree. Tasks use vector clocks. Subjects/chapters accept the LTS tradeoff deliberately (noted below).

---

## Why Two Devices Always End Up Identical

1. Every entity has a globally unique `id` (UUID v4, generated on the creating device).
2. The server is the single source of truth for merged state.
3. After push+pull, both devices have seen the same server state.
4. The merge function is **pure and deterministic**: given the same two versions, it always produces the same result regardless of which device runs it.
5. Vector clocks track causality accurately even when device clocks drift.

---

## Idempotency

### Backend (Express)
- **Focus sessions**: `INSERT OR IGNORE` semantics — duplicate session IDs are silently dropped. Reward application checks `reward_applied = 0` before running, preventing double-coin awards.
- **n8n webhook**: `notification_sent = 1` is set before firing the webhook (within the same logical block). Even if the webhook call fails and is retried, the flag prevents a second fire. If two devices sync the same session simultaneously, SQLite's row lock ensures only one writer sets `notification_sent = 1`.
- **Tasks**: Merge is idempotent — applying the same incoming VC twice yields the same result (merge is commutative and idempotent).

### n8n Workflow
The workflow deduplicates on `sessionId` (passed in the webhook payload). The backend guarantees `notification_sent` is set to 1 before calling n8n, so the same session cannot trigger n8n twice from the backend. Even if n8n received a duplicate (e.g. manual replay), the `Has Session ID?` node validates the payload but the backend guard is the primary deduplication layer.

---

## Tradeoff Made

**Optimistic local rewards vs. server authority on coins/streak.**

When a student completes a session offline, we immediately update `coins` and `streak` on-device for instant feedback. When sync happens, the server's authoritative values are pulled and overwrite the local student state.

*Problem*: If the device awarded coins optimistically and the server disagrees (e.g. session was already counted from a second device), the local count may momentarily show the wrong number before sync corrects it.

*Why we accepted it*: Immediate feedback is critical for student motivation — a 30-second delay to confirm online is a worse UX. After sync, the server's correct count is applied. The student might see a brief flash of +50 that then doesn't persist, but this is rare (offline sessions from two devices on the same day) and the corrected value is always shown post-sync.

*Better alternative (not implemented)*: Pessimistic locking with a "pending reward" badge shown until sync confirms. This would require more UI states.
