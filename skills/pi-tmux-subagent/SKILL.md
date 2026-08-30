---
name: pi-tmux-subagent
description: Launch multiple independent Pi workers in tmux windows for parallel investigation, implementation, review, or testing. Use when work can be split into bounded tasks with separate file ownership or Git worktrees.
compatibility: Requires Bash, the `pi` CLI, and tmux. Child Pi processes inherit current shell credentials and environment.
---

# Pi tmux subagent

Use tmux to run independent child Pi workers in parallel.

## Rules

- Give each worker one bounded task, owned paths, expected output, and completion condition.
- Use unique worker names. Workers must not spawn more workers.
- Use `read-only` unless a worker must edit; the helper enforces read-only tools.
- Put parallel editing workers in separate Git worktrees. Never let workers edit the same files.
- Verify worker commits and claims before integration.

## Spawn workers

Resolve `spawn-worker.sh` relative to this `SKILL.md`. For this global installation:

```bash
spawner="$HOME/.pi/agent/skills/pi-tmux-subagent/spawn-worker.sh"
session="pi-workers-$(date +%s)-$$"
```

`model` and `thinking` are required for every worker. Set both explicitly from the user's request. If either is missing, ask or make a deliberate task-specific choice before spawning. Never copy a default from this skill.

Pass task through stdin:

```bash
"$spawner" "$session" review "$PWD" read-only "$model" "$thinking" <<'PROMPT'
You are worker review.
Goal: inspect authentication code for concrete bugs.
Permission: read-only.
Do not spawn workers.
Complete when every finding has file:line evidence.
Return findings, commands run, and remaining risks.
PROMPT
```

The helper validates arguments, creates one tmux window per worker, and passes prompt safely as one argument. It uses Pi JSON mode so worker activity appears live and Pi exits after completion.

For parallel editing, create one worktree per worker first:

```bash
git worktree add ../project-worker-api -b worker/api
git worktree add ../project-worker-ui -b worker/ui

"$spawner" "$session" api ../project-worker-api edit "$model" "$thinking" <<'PROMPT'
You are worker api.
Goal: implement the API task.
Permission: edit only owned API paths and create one commit. Do not push.
Do not spawn workers.
Return commit SHA, tests run, and remaining risks.
PROMPT

"$spawner" "$session" ui ../project-worker-ui edit "$model" "$thinking" <<'PROMPT'
You are worker ui.
Goal: implement the UI task.
Permission: edit only owned UI paths and create one commit. Do not push.
Do not spawn workers.
Return commit SHA, tests run, and remaining risks.
PROMPT
```

## Completion

Do not wait or poll. When a worker exits, the helper sends one fixed `M-Enter` follow-up to the Pi pane that launched it:

```text
Worker review finished with exit 0. Check tmux pi-workers-...:review.
```

Pi queues this follow-up until current work finishes. Worker-generated text is never injected. If the launching pane no longer runs Pi, tmux shows a status message instead.

Check all workers once after a completion message:

```bash
tmux list-panes -s -t "$session" \
  -F '#{window_name}: #{?pane_dead,done,running} exit=#{pane_dead_status}'
```

Read worker output:

```bash
tmux capture-pane -p -J -t "$session:review" -S -
```

Use `tmux switch-client -t "$session"` to watch workers. Cancel one with `tmux kill-window -t "$session:review"`.

## Integrate and clean up

1. Inspect each worker commit and changed paths.
2. Run relevant tests in its worktree.
3. Cherry-pick only verified commits.
4. Run combined tests.
5. Save needed output, then remove tmux session and worktrees.

```bash
tmux kill-session -t "$session"
git worktree remove ../project-worker-api
git worktree remove ../project-worker-ui
```
