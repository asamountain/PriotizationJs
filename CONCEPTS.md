# Concept map

This app expresses the same domain value across many layers with no single
source of truth. When you change a concept, walk its row below and account for
every touchpoint, then run the grep gate before calling the change done.

## Grep gate

Before declaring any concept change finished:

```
grep -rn "<old-term>" public/ *.js
```

Every hit is either fixed or deliberately kept with a written reason.

---

## Priority model — `importance`, `cost_of_inaction`, `queueScore`

`cost_of_inaction` replaced the old feeling-based `urgency`. The `urgency`
column still exists in the DB as a passenger (data preservation; the
`cost_of_inaction` seed migration reads it) but nothing surfaces or edits it.

| Layer | Where |
|---|---|
| DB schema + migration | `db.js` `createTablesPostgres` — `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cost_of_inaction REAL`, plus the `UPDATE ... SET cost_of_inaction = urgency WHERE cost_of_inaction IS NULL` seed |
| DB writes | `db.js` `addTask`, `editTask`, `modifyTask`, `updateSubtask` (each names its columns explicitly) |
| Server → client whitelist | `socket.js` `processTaskData` — a field is dropped unless listed here (two copies in the file) |
| Vue data objects | `app.js` `data()` — `quickAddTask`, `newSubtask`, `editingSubtask`, `editingTask`, `taskImportance` |
| Form templates | `index.html` — node card metrics, Quick Add modal (`bumpQuick`), subtask add dialog, subtask edit dialog, task edit dialog |
| Score / ranking | `app.js` `queueScore` (the one formula), `priorityQueue`, `horizonList`, `sortTasks` (`priority-high`/`priority-low`), `taskSortOptions`, list-item priority bars in the template |
| 3D | `graph3d.js` `coiOf`, `priority` (node size), `cKey`/`iKey` floor rank, `_caption('COST OF INACTION →')` |
| Legend | `index.html` `.ed-legend` note |

Change checklist: new metric field → add column + migration, add to
`processTaskData`, add to every data object + form, decide its role in
`queueScore`, update the legend and the 3D caption if it maps to an axis.

---

## Task kind — `action` / `outcome` / `identity`

| Layer | Where |
|---|---|
| DB | `db.js` `kind TEXT DEFAULT 'action'` migration; `addTask`/`editTask` write it with `COALESCE` |
| Whitelist | `socket.js` `processTaskData` — `kind` |
| Set from UI | `index.html` node card kind segmented buttons → `app.js` `setNodeKind` → `commitNodeCard` |
| Queue filter | `app.js` `priorityQueue` / `queueCount` filter to `kind === 'action'`; `horizonList` filters to `outcome`/`identity` |
| Horizon section | `index.html` hierarchy view, below Priority Queue |
| 3D placement | `graph3d.js` `kindOf`, `actions`/`outcomes`/`idents` split, `HORIZON_*` / `VISION_*` bands, per-outcome colour (`OUTCOME_PALETTE`, `routeColor`) |

---

## Task relationships — enable graph, `leverage_score`

`enabler_task_id → enabled_task_id`. Drives outcome roll-up progress, the 3D
colour routing, and `leverage_score` (still computed and sent, but no longer
shown in the 3D — kept for the `influence-*` sort and list bar `L` segment).

| Layer | Where |
|---|---|
| DB | `db.js` `task_relationships` table; `addTaskRelationship` / `removeTaskRelationship` / `getAllTaskRelationships`; `calculateLeverageScoresFromGraph` |
| Whitelist | `socket.js` `getTaskDataWithLeverage` attaches `leverage_score`; `processTaskData` passes it |
| Set from UI | node card "Enables" combo → `app.js` `pickEnable` / `addEnable`; edit dialog `enables` autocomplete → `updateTaskRelationships` |
| Outcome roll-up | `app.js` `renderGraph` computes `t._progress` for outcome tasks |
| 3D | `graph3d.js` `enableAdj`, `routeColor` (BFS to nearest outcome), curved enable edges |

---

## Auth gate — single password

| Layer | Where |
|---|---|
| Middleware | `gate.js` `setupGate(app, io)` — HTTP gate + `io.use` socket gate; `/login` `/logout`; `OPEN_PATHS` allowlist (`/healthz`, `/login`, `/logout`, `/api/log-client-error`) |
| Session store | `auth.js` — `connect-pg-simple` over `DATABASE_URL`; `setupAuth` returns the middleware |
| Wiring / order | `server.js` — session → `io.engine.use(session)` → `setupGate` → `express.static` (gate must precede static) |
| Env | `APP_PASSWORD` (gate disables itself with a warning if unset), `SESSION_SECRET` |

---

## Usage telemetry — `events`

Counts only, no free text.

| Layer | Where |
|---|---|
| DB | `db.js` `events` table; `logEvents`, `getEventSummary` |
| Endpoints | `server.js` `POST /api/events`, `GET /api/events/summary` (both past the gate) |
| Client | `public/services/telemetry.js` `track()` — buffered, flush every 10s + on page hide |
| Instrumented calls | `app.js` — `navView` watcher, `openNodeCard`, `selectQueueTask`, `setNodeKind`, `setNodeStatus`, `bumpMetric`, `submitTask`, `saveTaskEdit`, `openQuickAddModal`, `pickEnable` |
| Dashboard | `public/usage.html` (served past the gate) |

Adding a tracked interaction: `track('<event>', '<target>', {meta})` at the
call site — nothing else to register.

---

## Deploy

| Item | Where |
|---|---|
| Host | Render free web service, `render.yaml` |
| DB | Neon Postgres — use the **direct** connection string, not `-pooler` (the pooler pins an empty `search_path`) |
| Migrations | `db.js` runs `CREATE TABLE IF NOT EXISTS` + the `ALTER`/`UPDATE` list on every boot; idempotent |
| Keep-alive | external cron hitting `/healthz` (`OPEN_PATHS`, no session) |
