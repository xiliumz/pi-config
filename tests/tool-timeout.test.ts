import assert from "node:assert/strict";
import test from "node:test";

import {
	capTimeout,
	parseTimeoutMs,
	runWithTimeout,
	timeoutGuideline,
	timeoutMessage,
} from "../extensions/tool-timeout/timeout.ts";

const TEN_MINUTES_MS = 10 * 60_000;

test("parses configured timeout with 10 minute fallback", () => {
	assert.equal(parseTimeoutMs(undefined), TEN_MINUTES_MS);
	assert.equal(parseTimeoutMs("60000"), 60_000);
	assert.equal(parseTimeoutMs("0"), TEN_MINUTES_MS);
	assert.equal(parseTimeoutMs("abc"), TEN_MINUTES_MS);
});

test("caps timeout in the tool's unit", () => {
	assert.equal(capTimeout(undefined, TEN_MINUTES_MS, 1000), 600);
	assert.equal(capTimeout(30, TEN_MINUTES_MS, 1000), 30);
	assert.equal(capTimeout(0.5, TEN_MINUTES_MS, 1000), 1);
	assert.equal(capTimeout(9999, TEN_MINUTES_MS, 1000), 600);
	assert.equal(capTimeout(0, TEN_MINUTES_MS, 1), TEN_MINUTES_MS);
	assert.equal(capTimeout(60_000, TEN_MINUTES_MS, 1), 60_000);
	assert.equal(capTimeout(15 * 60_000, TEN_MINUTES_MS, 1), TEN_MINUTES_MS);
});

test("tells the agent the limit, config, and per-call abort", () => {
	assert.match(timeoutGuideline(TEN_MINUTES_MS), /10 min.*PI_TOOL_TIMEOUT_MS.*aborted on its own/);
	assert.match(timeoutGuideline(TEN_MINUTES_MS), /MCP tools.*60 s by default/);
});

test("returns the tool result when it finishes in time", async () => {
	const result = await runWithTimeout(async () => "ok", undefined, TEN_MINUTES_MS, "read");
	assert.equal(result, "ok");
});

test("aborts only the slow call and reports it to the agent", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let toolSignal: AbortSignal | undefined;
	const call = runWithTimeout(
		(signal) => {
			toolSignal = signal;
			return new Promise(() => {});
		},
		undefined,
		TEN_MINUTES_MS,
		"read",
	);

	t.mock.timers.tick(TEN_MINUTES_MS);

	await assert.rejects(call, { message: timeoutMessage("read", TEN_MINUTES_MS) });
	assert.equal(toolSignal?.aborted, true);
});

test("forwards run cancellation to the tool", async () => {
	const run = new AbortController();
	let toolSignal: AbortSignal | undefined;
	const call = runWithTimeout(
		(signal) => {
			toolSignal = signal;
			return new Promise((_resolve, reject) => signal.addEventListener("abort", reject));
		},
		run.signal,
		TEN_MINUTES_MS,
		"edit",
	);

	run.abort();

	await assert.rejects(call);
	assert.equal(toolSignal?.aborted, true);
});
