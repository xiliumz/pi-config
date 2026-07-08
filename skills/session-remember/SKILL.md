---
name: session-remember
description: Recalls prior pi sessions in the current project by grepping the session JSONL files at ~/.pi/agent/sessions/--<cwd>--/. Use when the user references past work ("as we discussed", "last time", "remember when", "continue", "fix that bug"), asks if something was tried before, or picks up a multi-day task in a cwd that has prior sessions. Read-only — never writes new state. Do NOT use when the task is self-contained and has no temporal cues, or when prior context is already in the current turn.
---

# session-remember

The current project's prior sessions are plain JSONL on disk:

```
~/.pi/agent/sessions/--<encoded-cwd>--/*.jsonl
```

where `<encoded-cwd>` is `${PWD#/}` (leading `/` stripped) with each remaining `/` replaced by `-`, then wrapped in `--` delimiters (`/home/user/foo` → `--home-user-foo--`). Equivalent one-liner: `inner=$(echo "${PWD#/}" | tr '/' '-')`

The helper scripts in `./bin/` wrap the common operations. Use them; fall back to the inline `grep` recipes if a script is missing.

## When to invoke

| User says / situation | Do it? |
|---|---|
| "as we discussed", "last time", "remember when", "continue" | Yes |
| "have we tried…", "is there a…", "do we have…" | Yes |
| Vague continuation of a multi-day thread | Yes |
| New session in a cwd that has prior sessions in its bucket | Peek first |
| Fresh task, no temporal cues, unrelated cwd | No |
| Current turn already has the relevant prior context | No |
| `ls` on the bucket returns empty | No — project is fresh |

## The flow — cheap to expensive, stop at the first answer

### Step 1 — Bucket exists?

```bash
./bin/bucket                              # prints path
ls -t "$(./bin/bucket)" 2>/dev/null       # any sessions at all?
```

If empty, stop. Don't expand scope to other cwds unless the user
explicitly asked project-agnostic recall.

### Step 2 — Triage (one line per session, no body reads)

```bash
./bin/list                                # ts · name · first user msg
```

Or inline:

```bash
inner=$(echo "${PWD#/}" | tr '/' '-')
BUCKET=~/.pi/agent/sessions/--${inner}--/
for f in "$BUCKET"*.jsonl; do
  ts=$(stat -c %y "$f" | cut -d. -f1)
  name=$(grep -hoE '"name":"[^"]+"' "$f" | tail -1 | sed 's/^"name":"//;s/"$//')
  preview=$(grep -m1 '"role":"user"' "$f" \
            | grep -oE '"text":"[^"]{0,120}' \
            | head -1 | sed 's/^"text":"//')
  echo "$(basename $f)  [$ts]  name=${name:-<none>}"
  echo "    $preview"
done | sort -r
```

### Step 3 — Topic grep across the bucket

```bash
./bin/search "keyword1|keyword2|phrase"   # filenames matching
```

Or inline:

```bash
inner=$(echo "${PWD#/}" | tr '/' '-')
BUCKET=~/.pi/agent/sessions/--${inner}--/
grep -liE "keyword1|keyword2" "$BUCKET"*.jsonl
```

Pick 2-4 topic terms from:
- The current request's key nouns
- File paths the user mentioned
- Error strings the user pasted
- Function or type names

### Step 4 — Pull the gold: compaction summaries

A compacted session's `summary` field is exactly the gist you'd
otherwise pay 50K tokens to extract. Read these first.

```bash
./bin/summaries                           # all compaction summaries
```

Or inline:

```bash
inner=$(echo "${PWD#/}" | tr '/' '-')
BUCKET=~/.pi/agent/sessions/--${inner}--/
grep -hoE '"summary":"[^"]+"' "$BUCKET"*.jsonl \
  | sed 's/^"summary":"//; s/"$//'
```

### Step 5 — Deep-read ONE session (only after steps 1-4 shortlist)

Use `ctx_execute_file` so the raw JSONL never enters the conversation.
Parse the matching file in-sandbox and print only what the user needs
(user requests, key decisions, files modified, last open thread).

```python
# Pseudocode for the deep-read
with open(matched_file) as f:
    for line in f:
        d = json.loads(line)
        if d["type"] == "message" and d["message"]["role"] == "user":
            print("USER:", extract_text(d["message"]["content"])[:200])
        elif d["type"] == "compaction":
            print("SUMMARY:", d["summary"])
        # ... filter to what's actually needed
```

## Output format

Always cite what you found:

- "Your Jul 4 session `019f2c55…` was about X. Last open thread was Y — want to continue from there?"
- "3 prior sessions in this project, 1 had a compaction summary that matches this topic. Summary: …"
- "No prior sessions in this project's bucket — proceeding fresh."

## Don't

- Don't read full JSONL via `read` (dumps bytes into context). Use `ctx_execute_file` for deep-reads.
- Don't search across all cwd buckets unless the user asked project-agnostic. Cwd-bucket is right scope ~90% of the time.
- Don't fire on every turn — only when one of the trigger cues matches.
- Don't re-grep the same bucket twice in one conversation. Cache the shortlist in working memory.
- Don't write a session index file, summary cache, or any new state. The JSONL is the source of truth.

## Optional: persist the shortlist for this conversation

If you find a long session you might revisit, index it once into
context-mode's FTS5 with `ctx_index(path=<jsonl>, source="pi-session-<id>")`.
Then later recall is one `ctx_search` call.
