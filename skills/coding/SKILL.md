---
name: coding
description: "Use when a task writes, changes, or reviews code, tests, migrations, or a diff — including small edits. Not for pure questions or reads that change no files."
---

# Coding

Match the project's existing patterns before you change them. Project instructions (AGENTS.md, README, CONTRIBUTING) and the user's approval requirements override this skill.

## Non-negotiables

1. **Read before you write.** Read the file you're editing in full, not just the hunk, plus its callers and tests when behavior changes.
2. **No command, no claim.** Never report a check as passed unless it ran and passed in this session. Never claim a test exists, a script is defined, or a dependency is installed without seeing it.
3. **No git side effects unless asked.** Don't commit, branch, stash, amend, or push. Leave the diff in the working tree for review.
4. **Stay in scope.** Change only what was asked, and leave unrelated working-tree changes untouched.

## Ask before you act

Stop and get a yes for any of these:

- A dependency, abstraction, or pattern the repo doesn't already use.
- A public contract change: API shape, schema, exported signature, CLI flag, config key.
- Anything destructive or irreversible: deleting or rewriting data, force-push, dropping a migration.
- Work that spreads beyond the files the request names.
- A bug you noticed but weren't asked to fix. Report it separately; don't fix it quietly.

## 1. Read

Scale the reading to the change.

- **Small fix:** `rg` the symbol, error string, or config key repo-wide, then read the affected file in full and the nearest test.
- **Cross-cutting change:** also read AGENTS.md, README, CONTRIBUTING, the package manifest, the lint/type/format/framework config, 3–5 representative source files, and the tests covering the area.

Note what you will copy, not invent: naming, imports and exports, module boundaries, data flow, state, error handling, logging, and test conventions (location, fixtures, mock vs real services). If the repo has no AGENTS.md or no tests, say so and name what you used instead.

## 2. Write

- Pick the simplest solution that works and build only what's needed now.
- One job per function or file. Keep UI, state, logic, and types apart.
- Reuse existing helpers even where you'd write it differently. DRY the behavior, not the shape: two similar snippets are not automatically one abstraction.
- Handle null, undefined, invalid input, and failure explicitly.
- No secrets in code or logs. Follow the repo's config and environment-variable conventions.
- Update the callers, types, and tests the change requires. If that exceeds scope, stop and ask.
- **File size:** if a new or modified handwritten source file (tests included) passes about 200 lines, check whether it holds separable responsibilities. Advisory — split only when the result is clearer, and explain the exception. Excludes generated code, lockfiles, fixtures, docs, and vendored code. A project policy wins.

## 3. Prove

- **Bug fix: reproduce first.** Run the failing test or a command that shows the bug and quote its output before editing. A fix for a bug you never observed is a guess.
- Add or update a focused test that fails without the change and passes with it, in the project's existing test style.
- Run only commands the repo defines: package scripts, Makefile, CI config, or docs. Don't guess a package manager or test runner.
- Run what covers the change — tests, then lint, types, format, build.
- **Stop after two failed attempts at the same check.** Report the blocker, what you tried, and the verbatim error. Don't keep guessing.
- Can't run a check? Report the exact blocker. Don't install dependencies, alter external data, or run destructive setup just to validate — ask.
- Separate new failures from pre-existing ones. Say which is which, and how you know.
- Docs-only or instructions-only change: use read-only structural checks instead of application tests.

## 4. Report

Review the diff hunk by hunk, then report a single table plus a short close. Replace the right column with PASS, FAIL, or NOT CHECKED plus its evidence.

| #   | Check            | Report this                                                                                                     |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Diff scope       | Every hunk traces to the request. No unrelated edits, debug leftovers, commented-out code, or formatter churn.  |
| 2   | Conventions      | Changed lines use existing helpers, naming, imports, error handling, and test style. Cite the file you matched. |
| 3   | Correctness      | Behavior, callers, contracts, and null/invalid/failure paths. Name the edge case you handled.                   |
| 4   | Secrets and risk | Three yes/no: secret in the diff, sensitive value logged, new dependency / network call / filesystem write.     |
| 5   | Validation       | Each command, its exit status, and the verbatim failing lines if any.                                           |

- **Scale:** a typo, comment, or single-value edit reports items 1 and 5 only. Everything else reports all five.
- **Verdict:** PASS only when every item you reported is PASS. Fix in-scope FAILs, then re-run just that check. A known FAIL is never PASS. If an item is unreachable — no access, no tool, a decision you need — name it and report `PASS with gaps`.
- **Review-only request:** change nothing; report against the same table.
- Never weaken a test, suppress a failure, or move the goalposts to get a pass.

Close with what changed as behavior plus affected paths, then the commands you ran. If the user must act, end with one concrete next step: a command to run or a file to open.
