#!/usr/bin/env python3
"""Read-only Pi session recall helpers (Python standard library only)."""
import argparse
import json
import os
from pathlib import Path
import re
import sys


def bucket(cwd, session_dir=None):
    if session_dir:
        return Path(session_dir).expanduser().absolute()
    agent_dir = Path(os.environ.get("PI_CODING_AGENT_DIR", "~/.pi/agent")).expanduser()
    encoded = re.sub(r"[/\\:]", "-", re.sub(r"^[/\\]", "", str(Path(cwd).absolute())))
    return agent_dir / "sessions" / f"--{encoded}--"


def load(path):
    entries = []
    with path.open() as stream:
        for number, line in enumerate(stream, 1):
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                # A live session can end with an unfinished append.
                print(f"{path}:{number}: skipping invalid JSON", file=sys.stderr)
    return entries


def branch(entries):
    """Latest persisted leaf; legacy v1 files are linear."""
    nodes = {e["id"]: e for e in entries if e.get("type") != "session" and "id" in e}
    if not nodes:
        return [e for e in entries if e.get("type") != "session"]
    leaf = next(e["id"] for e in reversed(entries) if e.get("id") in nodes and e.get("type") != "session")
    result, seen = [], set()
    while leaf in nodes and leaf not in seen:
        seen.add(leaf)
        entry = nodes[leaf]
        result.append(entry)
        leaf = entry.get("parentId")
    return result[::-1]


def text(content):
    if isinstance(content, str):
        return content
    return "\n".join(b.get("text", "") for b in (content or []) if b.get("type") == "text")


def recall_text(entry):
    if entry.get("type") in ("compaction", "branch_summary"):
        return entry.get("summary", "")
    message = entry.get("message", {})
    if entry.get("type") == "message" and message.get("role") in ("user", "assistant"):
        return text(message.get("content"))
    return ""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("bucket", "list", "search", "summaries"))
    parser.add_argument("--session-dir", help="Exact session directory, not its parent root")
    parser.add_argument("args", nargs="*", help="Search regex, or shortlisted summary file paths")
    opts = parser.parse_intermixed_args()
    directory = bucket(os.getcwd(), opts.session_dir)
    if opts.command == "bucket":
        print(directory)
        return
    pattern = None
    if opts.command == "search":
        if len(opts.args) != 1:
            parser.error("search requires one regex pattern")
        try:
            pattern = re.compile(opts.args[0], re.IGNORECASE)
        except re.error as error:
            parser.error(str(error))
    elif opts.command != "summaries" and opts.args:
        parser.error("unexpected arguments")
    files = [Path(p) for p in opts.args] if opts.command == "summaries" and opts.args else list(directory.glob("*.jsonl"))
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    if not files:
        print(f"(no sessions in {directory})")
        return
    matched = False
    for path in files:
        entries = load(path)
        # Custom directories can contain several projects. Keep recall cwd-scoped.
        header = next((e for e in entries if e.get("type") == "session"), {})
        if header.get("cwd") and Path(header["cwd"]).absolute() != Path.cwd():
            continue
        active = branch(entries)
        if opts.command == "list":
            name = next((e.get("name") for e in reversed(entries) if e.get("type") == "session_info"), None)
            preview = next((text(e["message"].get("content")) for e in active if e.get("type") == "message" and e.get("message", {}).get("role") == "user"), "")
            stamp = next((e.get("timestamp", "") for e in reversed(entries) if e.get("timestamp")), "")
            print(f"{path.name} [{stamp}] name={json.dumps(name or '<unnamed>', ensure_ascii=False)} preview={json.dumps(preview[:140], ensure_ascii=False)}")
            matched = True
        elif opts.command == "search":
            if any(pattern.search(recall_text(e)) for e in active):
                print(path)
                matched = True
        else:
            for entry in active:
                if entry.get("type") in ("compaction", "branch_summary"):
                    print(f"--- {path.name} [{entry.get('timestamp', '')}] {entry['type']} {entry.get('id', '')} ---")
                    print(entry.get("summary", ""))
                    matched = True
    if not matched:
        print("(no matches)" if opts.command == "search" else "(no matching sessions or summaries)")


if __name__ == "__main__":
    main()
