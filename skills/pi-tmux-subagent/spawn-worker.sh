#!/usr/bin/env bash

set -u

usage() {
  printf 'usage: %s SESSION NAME WORKDIR MODE MODEL THINKING < PROMPT\n' "$0" >&2
  exit 2
}

die() {
  printf 'spawn-worker: %s\n' "$*" >&2
  exit 1
}

notify_parent() {
  local origin_pane="$1" session="$2" name="$3" code="$4"
  local pane_command message buffer

  [[ -n "$origin_pane" ]] || return 0
  pane_command=$(tmux display-message -p -t "$origin_pane" '#{pane_current_command}' 2>/dev/null) || return 0
  message="Worker $name finished with exit $code. Check tmux $session:$name."

  if [[ "$pane_command" == pi ]]; then
    buffer="pi-worker-notify-${BASHPID:-$$}"
    tmux set-buffer -b "$buffer" "$message" \; \
      paste-buffer -d -b "$buffer" -t "$origin_pane" \; \
      send-keys -t "$origin_pane" M-Enter >/dev/null 2>&1 || true
  else
    tmux display-message -t "$origin_pane" "$message" 2>/dev/null || true
  fi
}

run_worker() {
  [[ $# -eq 7 ]] || usage

  local origin_pane="$1" session="$2" name="$3" model="$4"
  local thinking="$5" mode="$6" prompt="$7" code

  if [[ "$mode" == read-only ]]; then
    pi --mode json --name "$name" --model "$model" --thinking "$thinking" \
      --tools read,grep,find,ls "$prompt"
  else
    pi --mode json --name "$name" --model "$model" --thinking "$thinking" "$prompt"
  fi
  code=$?

  notify_parent "$origin_pane" "$session" "$name" "$code"
  return "$code"
}

if [[ "${1:-}" == --run ]]; then
  shift
  run_worker "$@"
  exit $?
fi

[[ $# -eq 6 ]] || usage

session="$1"
name="$2"
workdir="$3"
mode="$4"
model="$5"
thinking="$6"

[[ "$session" =~ ^[A-Za-z0-9_-]+$ ]] || die "invalid session name: $session"
[[ "$name" =~ ^[A-Za-z0-9_-]+$ ]] || die "invalid worker name: $name"
case "$mode" in
  read-only|edit) ;;
  *) die "invalid worker mode: $mode" ;;
esac
case "$thinking" in
  off|minimal|low|medium|high|xhigh|max) ;;
  *) die "invalid thinking level: $thinking" ;;
esac
[[ -n "$model" ]] || die 'model is required'
workdir=$(cd -- "$workdir" 2>/dev/null && pwd) || die "invalid workdir: $workdir"
command -v tmux >/dev/null || die 'tmux not found'
command -v pi >/dev/null || die 'pi not found'

prompt=$(cat)
[[ -n "$prompt" ]] || die 'prompt is empty'
origin_pane="${TMUX_PANE:-}"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
script="$script_dir/$(basename -- "${BASH_SOURCE[0]}")"

if tmux has-session -t "$session" 2>/dev/null; then
  tmux new-window -d -t "$session:" -n "$name" -c "$workdir" || die 'cannot create worker window'
else
  tmux new-session -d -s "$session" -n "$name" -c "$workdir" || die 'cannot create worker session'
fi

tmux set-option -w -t "$session:$name" remain-on-exit on || die 'cannot set remain-on-exit'
tmux respawn-pane -k -t "$session:$name" -c "$workdir" -- \
  "$script" --run "$origin_pane" "$session" "$name" "$model" "$thinking" "$mode" "$prompt" \
  || die 'cannot start worker'

printf '%s:%s\n' "$session" "$name"
