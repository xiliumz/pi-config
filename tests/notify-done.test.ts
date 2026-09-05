import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { compileFunction } from "node:vm";

// Run the real extension with isolated OS/terminal mocks, without sending notifications.
const source = stripTypeScriptTypes(
	readFileSync(new URL("../extensions/notify-done.ts", import.meta.url), "utf8"),
)
	.replace(/^import .*;\r?\n/gm, "")
	.replace("const execFileAsync = promisify(execFile);", "")
	.replace(/export default function\s*\(/, "function register(");
const load = compileFunction(`${source}; return { notifyDesktop, register };`, ["process", "execFileAsync"]);

function setup(env: Record<string, string>, passthrough = "on", isTTY = true) {
	const writes: string[] = [];
	const commands: string[] = [];
	const api = load({
		platform: "linux", env,
		stdout: { isTTY, write: (text: string) => writes.push(text) },
	}, async (command: string) => {
		commands.push(command);
		return { stdout: passthrough };
	});
	return { ...api, writes, commands };
}

const kitty = { KITTY_WINDOW_ID: "1", TMUX: "/tmp/tmux", TMUX_PANE: "%6" };
const raw = "\x1b]99;i=pi-done:d=0;Pi\x1b\\\x1b]99;i=pi-done:p=body:d=1;Done\x1b\\";

test("Kitty OSC 99 escapes every ESC inside tmux passthrough; no notify-send", async () => {
	for (const option of ["on", "all"]) {
		const s = setup(kitty, option);
		assert.equal(await s.notifyDesktop("Pi", "Done"), true);
		assert.deepEqual(s.commands, ["tmux"]);
		assert.deepEqual(s.writes, [`\x1bPtmux;${raw.replace(/\x1b/g, "\x1b\x1b")}\x1b\\`]);
	}
});

test("direct Kitty keeps raw OSC; terminal control characters are removed", async () => {
	const s = setup({ KITTY_WINDOW_ID: "1" });
	await s.notifyDesktop("Pi\x1b", "Done\x07");
	assert.deepEqual(s.commands, []);
	assert.deepEqual(s.writes, [raw]);
});

test("disabled tmux passthrough falls through to notify-send", async () => {
	const s = setup(kitty, "off");
	assert.equal(await s.notifyDesktop("Pi", "Done"), true);
	assert.deepEqual(s.commands, ["tmux", "notify-send"]);
	assert.deepEqual(s.writes, []);
});

test("unknown terminals and non-TTY output reach notify-send", async () => {
	for (const s of [setup({ TERM: "xterm-256color" }), setup(kitty, "on", false)]) {
		await s.notifyDesktop("Pi", "Done");
		assert.deepEqual(s.commands, ["notify-send"]);
		assert.deepEqual(s.writes, []);
	}
});

test("recognized OSC 777 terminal stays ahead of notify-send", async () => {
	const s = setup({ TERM_PROGRAM: "ghostty" });
	await s.notifyDesktop("Pi", "Done; ready");
	assert.deepEqual(s.commands, []);
	assert.deepEqual(s.writes, ["\x1b]777;notify;Pi;Done, ready\x07"]);
});

test("RPC mode never writes terminal notifications", async () => {
	const s = setup(kitty);
	const handlers: Record<string, Function> = {};
	s.register({ on: (name: string, handler: Function) => { handlers[name] = handler; } });
	await handlers.agent_settled({}, { mode: "rpc" });
	assert.deepEqual(s.commands, []);
	assert.deepEqual(s.writes, []);
});
