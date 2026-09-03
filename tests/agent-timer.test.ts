import assert from "node:assert/strict";
import test from "node:test";

import agentTimer, { formatElapsed } from "../extensions/agent-timer.ts";

test("formats agent runtime", () => {
	assert.equal(formatElapsed(0), "0.0s");
	assert.equal(formatElapsed(1_249), "1.2s");
	assert.equal(formatElapsed(59_999), "1m 0.0s");
	assert.equal(formatElapsed(61_249), "1m 1.2s");
});

test("adds runtime below completed answer", () => {
	const handlers: Record<string, (event: unknown, ctx: any) => void> = {};
	const entries: Array<{ type: string; data: { elapsed: string } }> = [];
	let renderEntry:
		| ((entry: any, options: any, theme: any) => { render(width: number): string[] })
		| undefined;
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
		ui: {
			setStatus: () => {},
			theme: { fg: (_color: string, text: string) => text },
		},
	} as any;

	agentTimer(pi);
	handlers.agent_start?.({}, ctx);
	handlers.agent_settled?.({}, ctx);

	assert.deepEqual(entries, [{ type: "agent-timer", data: { elapsed: "0.0s" } }]);
	let color: string | undefined;
	const rendered = renderEntry?.(
		{ data: entries[0].data },
		{},
		{
			fg: (name: string, text: string) => {
				color = name;
				return text;
			},
		},
	).render(80);
	assert.equal(color, "dim");
	assert.deepEqual(rendered, ["Took 0.0s"]);
});
