# Cosmodex — Data Lineage Audit

_Audit date: 2026-06-29. Scope: every cross-document link in the Firestore model and whether **create / update / delete** keeps it consistent (no orphan documents, no dangling references)._

## Storage model
All data lives under `users/{uid}/…`. Collections:
`tasks` (embeds `subtasks[]`), `calEvents`, `milestoneProjects`, `milestoneEvents` (embeds `activities[]`), `milestone_lists`, `habits`, `habitLogs` (one doc per date, holds per-habit entries), `values`, `stacks`, `behaviours`, `routines`, `hbSettings`, `weeklyReviews`, `lists` (embeds `items[]`/subitems), `focusBuckets` (embeds `items[]`), `holidays`, `weeklyPlans`, `monthlyPlans`, `config/categories`, `config/people`.

Two kinds of link:
- **Containment** (child lives inside/with a parent) — must **cascade-delete** or it leaves orphan documents. 🔴 if broken.
- **Reference** (a field points at another doc's id) — deleting the target leaves a **dangling id**. The UI mostly tolerates these (falls back), so 🟡 unless it loses data.

---

## Lineage map & status

| # | Link | On create | On parent delete | On child delete | Status |
|---|---|---|---|---|---|
| 1 | **task ↔ calEvent** (`task.calEventId` / `calEvent.taskId`) | Created together (orb quick-add; scheduling a task) | **delete task → deletes calEvent** ✓ | **delete calEvent → unschedules task** (clears `calEventId`, keeps task) | 🟢 *see design note A* |
| 2 | **subtask ↔ calEvent** (`subtask.calEventId`) | On scheduling a subtask | delete task → deletes all subtask calEvents ✓ | deleteSubtask → deletes its calEvent ✓ | 🟢 |
| 3 | **task ↔ milestone** (`task.projectId`, `milestoneEvent.activities[].taskId`) | Linked when added to a milestone | delete project → cascades events + lists + tasks + calEvents ✓; delete event → cascades tasks + calEvents ✓ *(fixed today)* | delete task → removed from milestone activities ✓ | 🟢 |
| 4 | **task → people** (`task.people[]` → `config/people`) | On assignment | removing a person from config does **not** clean `task.people[]` | n/a | 🟡 dangling id (UI tolerates) |
| 5 | **task → category** (`task.category` → `config/categories`) | On assignment | `deleteCategory` does **not** reassign/clear tasks | n/a | 🟡 dangling key (shows raw key) |
| 6 | **habit ↔ habitLogs** | Logs written per date | **`habitDelete` does NOT delete the habit's entries in `habitLogs`** | n/a | 🔴→🟡 orphan log data (ghosts in stats) |
| 7 | **habit → value** (`habit.valueId` → `values`) | On assignment | `deleteValue` does **not** clear `habit.valueId` | n/a | 🟡 dangling id (UI tolerates) |
| 8 | **stack → habits** (`stack.habitIds[]`) | On grouping | delete stack → habits untouched ✓ | `habitDelete` does **not** remove id from `stack.habitIds[]` | 🟡 dangling id |
| 9 | **list → items / subitems** | Embedded array | delete list → items die with it ✓ | n/a | 🟢 (no orphans possible) |
| 10 | **focusBucket → items** | Embedded array | delete bucket → items die with it ✓ | n/a | 🟢 |

---

## Findings (by severity)

### 🟢 Fixed today
- **`deleteMilestoneEvent`** previously deleted its tasks but left their calEvents orphaned → now cascades calEvents (commit `3e7f863`).
- **Pomo (focus) event delete** deleted the calEvent but left the task's `calEventId` pointing at a deleted doc → now clears the link, matching the event-modal behaviour (this commit).

### 🟡 Soft dangling references (UI tolerates; no data loss)
- **#4 person delete**, **#5 category delete**, **#7 value delete**, **#8 habit-in-stack** all leave a dangling id when the target is deleted. The app renders fine (falls back to a placeholder/raw key), but the references are technically stale.

### 🔴/🟡 Worth fixing — orphan log data
- **#6 `habitDelete` leaves `habitLogs` entries** for the deleted habit. They're invisible in the main UI but can skew insights/streak math. Recommend either (a) sweep the habit's entries out of `habitLogs` on delete, or (b) make stats ignore entries whose habit no longer exists.

---

## Design note A — "delete calendar event" semantics
You asked: *deleting a calendar event should delete the linked task too.* Today it **unschedules** instead (keeps the task, clears the link). That's deliberate, and changing it is a judgement call because a calEvent can originate two ways:
1. **Created with a task** (orb quick-add) — here "delete event = delete task" makes sense.
2. **Created from an existing task** (you scheduled a task you already had) — here deleting the event to lose the *task* would be surprising/data-losing.
3. **No task at all** (e.g. events pulled from Apple Calendar by the sync) — nothing to delete.

**Recommendation:** keep *unschedule* as the default, and add an explicit "Delete event **and** task" option in the event modal for case 1. I can implement that if you confirm.

---

## Overall verdict
The **dangerous** links (the containment ones that would orphan whole documents — calEvents, milestone tasks, list/bucket items) are handled correctly, especially after today's two fixes. The remaining issues are **reference** dangling (cosmetic, UI-tolerant) plus the **habitLogs** orphan (worth a cleanup). The app is in good lineage health; nothing is silently losing or corrupting your core records.

### Recommended next actions (need your go-ahead)
1. `habitDelete` → also purge that habit's `habitLogs` entries. _(prevents skewed stats)_
2. Event modal → add "Delete event **and** task" button (design note A).
3. Optional tidy: on delete of person/category/value, clear the dangling refs on dependent records.
