#!/usr/bin/env python3
"""Run: python3 skills/session-remember/test_sessions.py"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

from sessions import branch, bucket

SCRIPT = Path(__file__).with_name("sessions.py")


def run(command, cwd, *args, env=None):
    return subprocess.run(
        [sys.executable, str(SCRIPT), command, *args], cwd=cwd, env=env,
        text=True, capture_output=True, check=True,
    ).stdout


def main():
    with tempfile.TemporaryDirectory(prefix="session recall ") as tmp:
        cwd = Path(tmp) / "project:v2"
        cwd.mkdir()
        custom = Path(tmp) / "custom sessions"
        env = dict(os.environ, PI_CODING_AGENT_DIR=str(Path(tmp) / "agent data"), PYTHONDONTWRITEBYTECODE="1")
        expected = bucket(cwd, custom)
        assert expected == custom
        default = run("bucket", cwd, env=env).strip()
        assert "project-v2--" in default and "agent data/sessions/" in default
        (cwd / "package.json").write_text("{}")
        assert "no sessions" in run("list", cwd, env=env)
        custom.mkdir()
        assert "no sessions" in run("list", cwd, "--session-dir", str(custom), env=env)
        entries = [
            {"type": "session", "id": "session", "cwd": str(cwd), "version": 3},
            {"type": "message", "id": "root", "parentId": None, "message": {"role": "user", "content": 'Fix "login"'}},
            {"type": "message", "id": "old", "parentId": "root", "message": {"role": "assistant", "content": [{"type": "text", "text": "Use Redis"}]}},
            {"type": "message", "id": "new", "parentId": "root", "message": {"role": "assistant", "content": [{"type": "text", "text": "Use Supabase"}, {"type": "thinking", "thinking": "secret-thinking"}]}},
            {"type": "compaction", "id": "compact", "parentId": "new", "summary": 'Set "timeout" to 30.\nTests passed.'},
            {"type": "branch_summary", "id": "summary", "parentId": "compact", "summary": "Reviewed DB sessions"},
            {"type": "message", "id": "system", "parentId": "summary", "message": {"role": "system", "content": "JWT system-only"}},
            {"type": "message", "id": "tool", "parentId": "system", "message": {"role": "toolResult", "content": [{"type": "text", "text": "tool-only"}]}},
            {"type": "session_info", "id": "info", "parentId": "tool", "name": 'Login "fix"', "timestamp": "2026-01-01T00:00:00Z"},
        ]
        path = custom / "session with spaces.jsonl"
        path.write_text("".join(json.dumps(e) + "\n" for e in entries))
        args = ("--session-dir", str(custom))
        listing = run("list", cwd, *args, env=env)
        assert 'Login \\"fix\\"' in listing and 'Fix \\"login\\"' in listing
        assert str(path) in run("search", cwd, *args, "supabase", env=env)
        for pattern in ("Redis", "JWT", "tool-only", "secret-thinking"):
            assert "no matches" in run("search", cwd, *args, pattern, env=env)
        summaries = run("summaries", cwd, *args, str(path), env=env)
        assert 'Set "timeout" to 30.\nTests passed.' in summaries
        assert "branch_summary summary" in summaries
        assert [e["id"] for e in branch(entries)] == ["root", "new", "compact", "summary", "system", "tool", "info"]
        assert branch([{"type": "message", "message": {"role": "user", "content": "legacy"}}])[0]["message"]["content"] == "legacy"
        other = dict(entries[0], cwd=str(Path(tmp) / "other"))
        path.write_text(json.dumps(other) + "\n" + json.dumps(entries[1]) + "\n")
        assert "no matches" in run("search", cwd, *args, "login", env=env)
    print("PASS: empty/missing storage, paths, custom directory, JSON decoding, case-insensitive search, branch filtering, summary types, legacy entries, cwd scope")


if __name__ == "__main__":
    main()
