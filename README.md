# Alcovia — Offline-First Study App

## Quick Start

### 1. Backend
```bash
cd backend
npm install
npm run dev
```
Runs on http://localhost:3001

### 2. Frontend (Device A)
```bash
cd frontend
npm install
npx expo start --web
```
Open in browser — a deviceId is auto-generated and stored in localStorage.

### 3. Frontend (Device B)
Open a second browser tab in **Incognito mode** (or a different browser profile).
Navigate to the same Expo URL. A different deviceId is generated automatically.

### 4. n8n Workflow
- Install n8n: `npx n8n` (or use n8n Cloud free tier)
- Import `n8n-workflows/focus-success-workflow.json`
- Activate the workflow
- The webhook listens at `http://localhost:5678/webhook/focus-success`
- Notifications are logged to the `/mock-notify` endpoint on the backend

---

## Demo Scenarios

### Two-Device Conflict (Task)
1. Open Device A and Device B, seed data on both via Dev Panel → Seed
2. Both devices: Dev Panel → toggle Offline
3. Device A: Syllabus → tap a task to mark it `In Progress`
4. Device B: same task → tap to mark it `Done`
5. Both devices: toggle Online → Force Sync
6. **Expected**: Both devices show `Done` (higher status wins)

### Offline Focus Session
1. Toggle offline on Device A
2. Start a 25-min focus session (or use the timer; for demo you can edit selectedMinutes to 1)
3. Complete it
4. Toggle online — sync fires, coins/streak update, n8n notification appears in backend logs

### Idempotent Notification
1. Complete a focus session on Device A while offline
2. Complete the same effect on Device B (it will generate a different session, but try replaying via direct API call)
3. Check backend logs — `/mock-notify` is hit exactly once per session ID

---

## Conflict Cases Handled
| Scenario | Resolution |
|----------|-----------|
| Same task status changed on both devices concurrently | Higher status wins (done > in_progress > not_started) |
| Task deleted on one device, edited on another | Deletion wins |
| Same focus session synced from both devices | Deduplicated by session ID; rewards applied once |
| Same sync message arriving twice | Idempotent inserts; vector clock merge is idempotent |
| Rewards on offline session | Applied optimistically locally; server is authoritative post-sync |

## What's Left Out / Next Steps
- Real WhatsApp delivery (swap mock-notify URL for Twilio/AiSensy)
- Conflict surfaced to user (currently auto-resolved silently)
- Crash recovery for mid-session restarts (partially handled via AppState; full persistence would use SQLite on-device)
- Efficient delta sync (currently sends all unsynced; would use per-entity sequence numbers)
- 3+ device support (works architecturally, not stress-tested)
- Property/fuzz tests for convergence
