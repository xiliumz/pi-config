import { Type } from "@earendil-works/pi-ai";
import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";

function normalizeSessionName(input: string): string {
	const name = input.trim();
	if (!name) throw new Error("Session name must not be empty. Provide a short display name, for example 'fix auth bug'.");
	return name;
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "rename_session",
		label: "Rename Session",
		description:
			"Set the display name of the current session, shown in the session selector instead of the first message. Call only when the user explicitly asks to name or rename the current session.",
		promptSnippet: "Rename current session when the user asks",
		promptGuidelines: [
			"Call rename_session only when the user explicitly asks to name or rename the current session.",
			"Use a short, specific name describing the session task.",
		],
		parameters: Type.Object({
			name: Type.String({ description: "Short display name for the current session, for example 'fix auth bug'" }),
		}),
		async execute(_toolCallId, params) {
			const name = normalizeSessionName(params.name);
			const previousName = pi.getSessionName();
			pi.setSessionName(name);
			return {
				content: [{ type: "text" as const, text: previousName ? `Renamed session from '${previousName}' to '${name}'.` : `Named session '${name}'.` }],
				details: { sessionName: name, previousName: previousName ?? null },
			};
		},
	});
}
