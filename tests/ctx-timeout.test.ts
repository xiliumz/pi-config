import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTimeout } from "../extensions/ctx-timeout.ts";

const DEFAULT_MS = 3 * 60_000;
const MAX_MS = 10 * 60_000;

test("uses default timeout and caps explicit timeout", () => {
	assert.equal(normalizeTimeout(undefined, DEFAULT_MS, MAX_MS), DEFAULT_MS);
	assert.equal(normalizeTimeout(60_000, DEFAULT_MS, MAX_MS), 60_000);
	assert.equal(normalizeTimeout(15 * 60_000, DEFAULT_MS, MAX_MS), MAX_MS);
	assert.equal(normalizeTimeout(0, DEFAULT_MS, MAX_MS), DEFAULT_MS);
});
