# Rooms

Optional per-workstream scratch space. A *room* is a folder holding the state of one
piece of ongoing work: what was decided, what is blocked, what the next mode should do.

Rooms are **not** the same as `MEMORY.md` or `TASKS.md`:

| File | Scope | Lifetime |
| :--- | :--- | :--- |
| `MEMORY.md` | whole project | permanent |
| `TASKS.md` | whole project | rolling |
| `rooms/<name>/` | one workstream | until it ships, then fold the durable parts back |

## When to open a room

Open one when work spans more than a couple of replies and will outlive the current
context — a multi-step feature, a migration that needs coordinating, or a bug whose
investigation is worth keeping. Do **not** open one for a single edit.

## Structure

```
rooms/
├── README.md          # this file
└── <workstream>/
    ├── NOTES.md       # findings, decisions made in-room, dead ends
    └── HANDOFF.md     # the current handoff block (see PROTOCOL.md)
```

## Rules

- One room per workstream. Name it after the work (`account-deletion`, not `work-2`).
- Keep `HANDOFF.md` to a single current handoff block — overwrite it, do not append
  history there. History belongs in `NOTES.md`.
- When the work ships, move anything durable into `MEMORY.md` (a decision) or
  `TASKS.md` (remaining follow-ups), then delete the room. A room that outlives its work
  is clutter.
- `coordinator` creates and closes rooms.

The room `autopilot-pipeline/` is a live example of the format.
