import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import {
	ThinkingSelectorComponent,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

export default function thinkingSelectExtension(pi: ExtensionAPI) {
	pi.registerShortcut("shift+tab", {
		description: "Select thinking level",
		handler: async (ctx) => {
			if (ctx.mode !== "tui" || !ctx.model) return;

			await ctx.ui.custom<void>((_tui, _theme, _keybindings, done) => {
				const selector = new ThinkingSelectorComponent(
					pi.getThinkingLevel(),
					getSupportedThinkingLevels(ctx.model!),
					(level) => {
						pi.setThinkingLevel(level);
						done();
					},
					() => done(),
				);

				return selector;
			});
		},
	});
}
