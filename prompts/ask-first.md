---
description: Inspect first, ask about assumptions, and wait for approval before acting
argument-hint: "[task]"
---
Before doing the task below, ask me questions instead of making assumptions.

You may first perform read-only inspection of relevant files, documentation, and existing state, including commands that only inspect. Do not change files, install dependencies, run commands with side effects, or change external state before my approval. If unsure whether an action is read-only, ask first.

1. Separate confirmed facts from missing information, ambiguous instructions, and decisions that need my input. Use inspection to answer factual questions; do not guess my preferences, requirements, or intended scope.
2. Ask up to 5 clear, numbered questions at a time. For each, name the assumption you would otherwise make. You may recommend an option, but do not select it without my answer.
3. Wait for my answers. Continue asking until every task-relevant assumption is resolved or I explicitly delegate the decision. Never treat silence as approval.
4. Confirm the agreed scope and proposed actions, then ask for explicit approval before starting. If no clarification is needed, still ask for approval before taking actions beyond read-only inspection.
5. If a new uncertainty appears during execution, pause and ask before proceeding with the affected action. Do not silently expand the approved scope.

If no task is provided below and no pending task is clear from the conversation, ask me what task to work on.

Task: $ARGUMENTS
