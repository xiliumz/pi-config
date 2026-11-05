---
name: coding
description: "Edits and reviews code to match the project's existing conventions. Use when fixing a bug, adding or refactoring code, writing tests, or reviewing a diff. Reads current patterns before changing anything, stays in scope, runs the repo's real checks, and reports evidence. Proportional — skip typo-level edits and pure questions."
---

# Coding

Match the project's existing architecture. Project instructions (AGENTS.md etc.) and the user's approval requirements override this skill.

## Hard rules

Breaking any of these fails the task:

1. **Read before writing.** Open the target code, plus its callers and tests when the change touches behavior.
2. **Use what the project already uses.** That means its stack, helpers, naming, imports, error handling, and test style. Ask before adding dependencies, abstractions, or new patterns.
3. **Stay in scope.** Change only what was asked and preserve unrelated user changes. Ask before expanding scope, changing public contracts, or doing anything destructive.
4. **Never invent.** Commands, scripts, APIs, and requirements must come from the repo or the user. Separate confirmed facts from inferences. Ask when a gap affects correctness.
5. **Never claim a check passed unless it ran and passed.**

## 1. Inspect (proportional to the task)

- **Small fix:** read the affected code and its immediate context.
- **Larger or cross-cutting change:** also read AGENTS.md, README, and CONTRIBUTING; the package manifest; the lint, format, type, and framework config; 3–5 representative source files; and the relevant tests.

Note naming, imports/exports, module boundaries, data flow, state, API access, error handling, logging, and test conventions (location, fixtures, mock vs real services).

## 2. Implement

- **KISS:** pick the simplest solution that works.
- **YAGNI:** build only what is needed now.
- **Single responsibility:** each function or file does one job. Keep UI, state, logic, and types apart.
- **DRY:** keep one source of truth. Don't force an abstraction just because two snippets look alike.
- Handle null, undefined, invalid-input, and failure cases explicitly.
- Don't hardcode secrets or log sensitive values. Follow the project's config and environment-variable conventions.
- Update the types, callers, tests, and API specs the change requires. If that goes beyond scope, stop and ask.
- **File size:** if a new or modified handwritten source file (tests included) exceeds about 200 lines, check whether it holds separable responsibilities. This is advisory. Split only when the result is clearer, and explain any exception in the report. Exclude generated files, lockfiles, fixtures, docs, and vendored code. A project policy takes precedence.

## 3. Validate

- Use only commands found in the project's scripts, config, or docs. Don't assume a package manager or test framework.
- Add or update focused tests for the changed behavior, following existing conventions.
- Run the relevant tests plus lint, format, type, and build checks.
- Don't install dependencies, alter external data, or run destructive setup just to validate. Ask when approval is required.
- If a check can't run, report the exact blocker. Separate new failures from confirmed pre-existing ones.
- For instructions-only or docs-only changes, use read-only structural checks instead of application tests.

## 4. Review and report

Review the final diff, then report. One table, no separate write-up. Each item gets **PASS**, **FAIL**, or **NOT CHECKED** with brief evidence, and each is answerable from the diff or a command:

Scale to the change: a typo, comment, or single-value edit reports items 1 and 5 only.

1. **Diff scope:** walk every hunk. Each one traces to the request. No unrelated edits, debug leftovers, commented-out code, or formatter churn.
2. **Conventions:** the changed lines use existing helpers, naming, imports, error handling, and test style. Cite the file you matched.
3. **Correctness:** behavior, callers, contracts, and null/invalid/failure paths. Name the edge case you actually handled.
4. **Secrets and risk:** answer three yes/no questions — is a secret in the diff, is a sensitive value logged, does this add a dependency, network call, or filesystem write?
5. **Validation:** for each check, the command, its exit status, and the verbatim failing lines if any.

Fix every FAIL within scope, then recheck only the failing items. Don't repeat the whole pass to hunt for a PASS.

Never weaken tests, suppress failures, or move the goalposts to get a pass.

**Verdict:** PASS only when all five are PASS. If an item is legitimately unreachable — no access, no tool, a decision you need — name it and report `PASS with gaps`. Never report PASS while an item is FAIL.

**Report:** what changed as behavior plus affected paths, the table, and the commands run. If the user must act, end with one concrete next step.
