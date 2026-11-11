import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import {
	createEditToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
} from "@earendil-works/pi-coding-agent";

import { capTimeout, parseTimeoutMs, runWithTimeout, timeoutGuideline } from "./timeout.ts";

// Each tool's timeout param and its milliseconds per unit. Tool schemas reject unknown fields,
// so the name must match exactly. ctx_batch has no timeout param (context-mode caps it at 10 min).
const TIMEOUT_PARAMS: Record<string, { param: string; unitMs: number }> = {
	bash: { param: "timeout", unitMs: 1000 },
	ctx_execute: { param: "timeoutMs", unitMs: 1 },
};
// Active built-ins without a `timeout` param. Re-registering them adds one; registering
// inactive built-ins (grep, find, ls) would activate them, so they are left alone.
const WRAPPED_TOOLS: Array<(cwd: string) => ToolDefinition<any, any>> = [
	createReadToolDefinition,
	createEditToolDefinition,
	createWriteToolDefinition,
];

export default function toolTimeoutExtension(pi: ExtensionAPI): void {
	const timeoutMs = parseTimeoutMs(process.env.PI_TOOL_TIMEOUT_MS);
	const guideline = timeoutGuideline(timeoutMs);

	for (const createTool of WRAPPED_TOOLS) {
		const tool = createTool(process.cwd());
		pi.registerTool({
			...tool,
			execute: (toolCallId, params, signal, onUpdate, ctx) =>
				runWithTimeout(
					(timeoutSignal) =>
						createTool(ctx.cwd).execute(toolCallId, params, timeoutSignal, onUpdate, ctx),
					signal,
					timeoutMs,
					tool.name,
				),
		});
	}

	pi.on("before_agent_start", (event) => {
		const guidelines = event.systemPromptOptions.promptGuidelines;
		if (!guidelines.includes(guideline)) guidelines.push(guideline);
	});

	pi.on("tool_call", (event) => {
		const timeoutParam = TIMEOUT_PARAMS[event.toolName];
		if (timeoutParam === undefined) return;

		const input = event.input as Record<string, unknown>;
		const { param, unitMs } = timeoutParam;
		input[param] = capTimeout(input[param], timeoutMs, unitMs);
	});
}
