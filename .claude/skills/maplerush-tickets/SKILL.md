---
name: maplerush-tickets
description: Use when starting a MapleRush work session, deciding what to work on next, creating/updating/claiming a task ticket, breaking work into subtasks, or seeing what the two developers (dust9826, D4LGONA) are doing. Keywords - ticket, TODO, task, board, backlog, session plan, what should I do, next, 작업, 티켓, 할일, 다음.
---

# MapleRush Tickets

Lightweight, file-based ticket system for MapleRush (2-developer MSW project). Like Jira, but every ticket is a markdown file in `tickets/`, versioned in git.

## What it's for

Planning and coordination — **not** merge-conflict avoidance:

- **What to work on** — backlog + priorities at a glance
- **Order & dependencies** — e.g. MR-A can't start until MR-S is done
- **Who's doing what** — `owner` so two people don't duplicate effort
- **Session planning** — pick a ticket, break it into subtasks, track progress

Merges are just normal git. Two devs edit code freely; if a real conflict happens, resolve it at merge time. Don't engineer the workflow around avoiding conflicts.

Developers (git authors): **dust9826**, **D4LGONA**. `owner` is one of `unassigned`, `dust9826`, `D4LGONA`.

## Where things live

| Thing | Path |
|---|---|
| Tickets (one file each) | `tickets/MR-<id>-<slug>.md` |
| This skill + template | `.claude/skills/maplerush-tickets/` |
| Board view (on demand) | `node .claude/skills/maplerush-tickets/board.cjs` |

Status lives in each ticket's frontmatter — there's no committed board/index file (it'd just be a merge hotspot). `tickets/README.md` is a short static explainer.

## Session start protocol

When the user starts a session / asks "what should I do" / "이번 세션 뭐 할까":

1. `git pull` (or `fetch`) so ticket state is current.
2. Run the board: `node .claude/skills/maplerush-tickets/board.cjs` — tickets grouped by status with owner + blocked flags.
3. Pick a ticket that is **unblocked** (all `depends_on` are `done`) and `unassigned` or owned by the current dev.
4. **Claim it:** set `owner` + `status: in-progress`, update `updated:`. Push it soon so the other dev sees it's taken (keep it casual — just visibility, no ceremony).
5. **Break into subtasks:** fill the `## Subtasks` checklist with concrete, verifiable steps for this session.
6. Work; keep the checklist updated.
7. When acceptance criteria pass: check off subtasks, set `status: review` or `done`, update `updated:`.

## Creating a ticket

Copy `ticket-template.md` to `tickets/MR-<id>-<slug>.md`. Pick a short stable `id` (e.g. `S`, `F`, `A`, `B2`). Fill frontmatter + Goal + Acceptance criteria. Leave `owner: unassigned`, `status: backlog` or `todo`.

## Frontmatter spec

```yaml
---
id: MR-A            # stable, unique
title: ...          # one line
status: backlog     # backlog | todo | in-progress | review | done
owner: unassigned   # unassigned | dust9826 | D4LGONA
area: script        # script | map | ui | data | model | mixed  (rough domain)
depends_on: []      # [other ticket ids] that must be done before this can start
touches: []         # OPTIONAL: files this ticket mainly touches — handy "what does the other person's ticket overlap with" hint, nothing more
branch: ""           # OPTIONAL: whatever branch you use
created: 2026-06-19  # absolute date
updated: 2026-06-19
---
```

`depends_on` and `owner` are the fields that matter day to day. `touches`/`branch` are optional convenience hints — leave empty if you don't care.

## MSW reminder

Implementation work still follows the project's MSW rules (AGENTS.md): load the MSW Foundation skills + matching references before editing `.mlua`/`.model`/`.map`/`.ui`. A ticket says *what*; the MSW skills govern *how*.

## Common mistakes

| Mistake | Fix |
|---|---|
| Looking for a shared board/index file | There isn't one — run `board.cjs`. |
| Starting a blocked ticket | Check `depends_on` are all `done` first. |
| Two people silently on one ticket | Check/set `owner` before starting; say so if you must share. |
| Stale dates | Update `updated:` when status/owner changes. |
