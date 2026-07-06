---
name: logger
description: Maintains a single, short-lived log per conversation session in .sessions/ so future sessions can resume work with full context, without needing full transcripts.
---

## Purpose

Give future sessions just enough context — in one paragraph — to know what happened and what to do next.

## At session start

1. Ensure `.sessions/` exists.
2. Read `.sessions/INDEX.md` (if it exists) — this gives a one-line-per-session overview of everything logged so far.
3. From the index, identify sessions related to the current task (match by keywords in the title or summary). Only if the index is missing or insufficient, fall back to scanning filenames in `.sessions/`.
4. If related logs exist, read the full paragraph from those files (most recent first) for context: prior decisions, blockers, next steps.
5. Create a NEW log file for this session — never reuse or append to a previous session's file, even on the same topic:

## During the session

- The file contains **exactly one paragraph** — no headers, no bullet list, no changelog, no timestamps per entry.
- Whenever there's meaningful progress, a decision, a blocker, or a change of plan: **overwrite** the paragraph entirely (don't append to it — this is current state, not history).
- After every update to the paragraph, **update `INDEX.md`** (see below) so it always reflects the latest state of every session.
- The paragraph should always cover, as of the latest update:
  1. Goal of the session
  2. What's been done so far
  3. Current status / open questions / blockers
  4. Concrete next step (specific enough to act on immediately)
- Target 3–6 dense sentences. Cut anything a future agent doesn't strictly need.

## INDEX.md

`INDEX.md` is a single table in `.sessions/`, maintained by the agent, that gives a bird's-eye view of every logged session. It is the **first thing an agent reads** at session start so it can find related work without opening every file.

### Format

```markdown
# Session Index

| Date       | Session                                                    | Summary                                                                                 |
| ---------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 2025-06-10 | [refactor-auth-module](2025-06-10-refactor-auth-module.md) | Migrate auth from session-based to JWT; login/logout done, blocked on refresh strategy. |
| 2025-06-08 | [fix-css-layout](2025-06-08-fix-css-layout.md)             | Fixed sidebar overlap on mobile; deployed to staging.                                   |
```

### Update procedure

After creating or updating a session log, **update `INDEX.md` incrementally** — only touch the current session's row:

1. Read `INDEX.md` (if it exists).
2. **New session:** append a row with today's date, the filename, and a one-sentence summary extracted from the paragraph.
3. **Existing session:** find the row matching the current filename and replace its summary with the first sentence of the updated paragraph (capped at ~160 chars).
4. Write the updated table back.

The agent should **never read other session files** just to maintain the index. It already knows its own summary — that's the only row that changed. Other rows stay as they are.

## Example

`.sessions/2025-06-10-refactor-auth-module.md`

> Goal: migrate auth module from session-based to JWT tokens. Completed refactor of `login()` and `logout()` endpoints; tests in `auth.test.ts` passing. Blocked on refresh-token strategy — leaning toward rotating refresh tokens in httpOnly cookies, but need to confirm compatibility with `sessionStore.ts` first. Next: review `sessionStore.ts`, finalize refresh strategy, implement `refreshToken()` endpoint, update `authMiddleware.ts`.

## Rules

- Only read other sessions' logs — never modify them.
- One file per session, created once, updated in place throughout.
- After every write to a session file, update `INDEX.md` immediately.
- If the session ends unfinished, the final update must state a clear, actionable next step.
- If no related prior log exists, skip the "read" step and just start logging.
