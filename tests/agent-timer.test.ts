import assert from "node:assert/strict";
import test from "node:test";

import agentTimer, { formatElapsed } from "../extensions/agent-timer.ts";

test("formats agent runtime", () => {
	assert.equal(formatElapsed(0), "0:00");
	assert.equal(formatElapsed(59_999), "0:59");
	assert.equal(formatElapsed(60_000), "1:00");
	assert.equal(formatElapsed(3_661_000), "1:01:01");
});

test("adds runtime below completed answer", () => {
	const handlers: Record<string, (event: unknown, ctx: any) => void> = {};
	const entries: Array<{ type: string; data: { elapsed: string } }> = [];
	let renderEntry: ((entry: any) => { render(width: number): string[] }) | undefined;
	const pi = {
		on: (name: string, handler: (event: unknown, ctx: any) => void) => {
			handlers[name] = handler;
		},
		registerEntryRenderer: (_type: string, renderer: typeof renderEntry) => {
			renderEntry = renderer;
		},
		appendEntry: (type: string, data: { elapsed: string }) => entries.push({ type, data }),
	} as any;
	const ctx = {
		hasUI: true,
		ui: { setStatus: () => {} },
	} as any;

	agentTimer(pi);
	handlers.agent_start?.({}, ctx);
	handlers.agent_settled?.({}, ctx);

	assert.deepEqual(entries, [{ type: "agent-timer", data: { elapsed: "0:00" } }]);
	assert.deepEqual(renderEntry?.({ data: entries[0].data }).render(80), ["Agent ran for 0:00"]);
});
