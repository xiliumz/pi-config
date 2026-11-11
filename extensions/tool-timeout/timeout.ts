const TEN_MINUTES_MS = 10 * 60_000;

export function parseTimeoutMs(value: string | undefined): number {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : TEN_MINUTES_MS;
}

export function capTimeout(value: unknown, maxMs: number, unitMs: number): number {
	const max = Math.max(1, Math.floor(maxMs / unitMs));
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.ceil(parsed), max) : max;
}

export function timeoutGuideline(timeoutMs: number): string {
	return (
		`Calls to bash, read, edit, write, ctx_execute, and ctx_batch have a hard timeout of ${timeoutMs / 60_000} min (${timeoutMs} ms), ` +
		"set by the user via the PI_TOOL_TIMEOUT_MS env var. " +
		"The `timeout` param of bash (seconds) and `timeoutMs` param of ctx_execute are capped to it. " +
		"A call that runs past it is aborted on its own and returns an error result; the run continues. " +
		"MCP tools (mcp__*) instead fail after their server's `timeout` in mcp.json (60 s by default) " +
		"without a progress update, also as an error result for that call only. " +
		"Split longer work into smaller calls or run it in the background."
	);
}

export function timeoutMessage(toolName: string, timeoutMs: number): string {
	return (
		`${toolName} timed out after ${timeoutMs} ms (PI_TOOL_TIMEOUT_MS) and was aborted. ` +
		"Its work may be incomplete; check the result and retry with a smaller scope."
	);
}

/** Runs `run` with its own abort signal; rejects and aborts it once `timeoutMs` passes. */
export async function runWithTimeout<T>(
	run: (signal: AbortSignal) => Promise<T>,
	signal: AbortSignal | undefined,
	timeoutMs: number,
	toolName: string,
): Promise<T> {
	const controller = new AbortController();
	const onAbort = () => controller.abort(signal?.reason);
	if (signal?.aborted) onAbort();
	else signal?.addEventListener("abort", onAbort, { once: true });

	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => {
			controller.abort();
			reject(new Error(timeoutMessage(toolName, timeoutMs)));
		}, timeoutMs);
	});

	try {
		return await Promise.race([run(controller.signal), timeout]);
	} finally {
		clearTimeout(timer);
		signal?.removeEventListener("abort", onAbort);
	}
}
