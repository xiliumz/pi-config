import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const THREE_MINUTES_MS = 3 * 60_000;
const TEN_MINUTES_MS = 10 * 60_000;
const TIMEOUT_TOOLS = new Set(["ctx_execute", "ctx_execute_file", "ctx_batch_execute"]);

function positiveInteger(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const MAX_TIMEOUT_MS = positiveInteger(
	process.env.CONTEXT_MODE_MAX_TIMEOUT_MS,
	TEN_MINUTES_MS,
);
const DEFAULT_TIMEOUT_MS = Math.min(
	positiveInteger(process.env.CONTEXT_MODE_DEFAULT_TIMEOUT_MS, THREE_MINUTES_MS),
	MAX_TIMEOUT_MS,
);

export function normalizeTimeout(
	value: unknown,
	defaultMs = DEFAULT_TIMEOUT_MS,
	maxMs = MAX_TIMEOUT_MS,
): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0
		? Math.min(Math.floor(parsed), maxMs)
		: Math.min(defaultMs, maxMs);
}

export default function ctxTimeoutExtension(pi: ExtensionAPI): void {
	pi.on("tool_call", (event) => {
		if (!TIMEOUT_TOOLS.has(event.toolName)) return;

		const input = event.input as { timeout?: unknown };
		input.timeout = normalizeTimeout(input.timeout);
	});
}
