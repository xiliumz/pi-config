import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Prompt templates can't add "in" only when an argument is given, so this is a command instead.
export default function (pi: ExtensionAPI) {
	pi.registerCommand("check-my-changes", {
		description: "Use when you made changes and want agent to check it",
		handler: async (args) => {
			const target = args.trim();
			pi.sendUserMessage(
				target ? `I made some changes in ${target} check it` : "I made some changes check it",
			);
		},
	});
}
