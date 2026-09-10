import { getSupportedThinkingLevels, type ModelThinkingLevel } from "@earendil-works/pi-ai";
import {
	SettingsManager,
	ThinkingSelectorComponent,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

export default function thinkingSelectExtension(pi: ExtensionAPI) {
	pi.registerShortcut("shift+tab", {
		description: "Select thinking level",
		handler: async (ctx) => {
			if (ctx.mode !== "tui" || !ctx.model) return;

			const settings = SettingsManager.create(ctx.cwd, undefined, {
				projectTrusted: ctx.isProjectTrusted(),
			});
			const selected = await ctx.ui.custom<
				{ level: ModelThinkingLevel; persist: boolean } | undefined
			>((_tui, _theme, _keybindings, done) =>
				new ThinkingSelectorComponent(
					pi.getThinkingLevel(),
					getSupportedThinkingLevels(ctx.model!),
					(level) => done({ level, persist: false }),
					() => done(undefined),
					(level) => done({ level, persist: true }),
					settings.getDefaultThinkingLevel(),
				),
			);

			if (!selected) return;
			pi.setThinkingLevel(selected.level);
			if (!selected.persist) return;

			settings.setDefaultThinkingLevel(selected.level);
			await settings.flush();
			const error = settings.drainErrors().find(({ scope }) => scope === "global");
			ctx.ui.notify(
				error
					? `Failed to save default thinking level: ${error.error.message}`
					: `Default thinking level: ${selected.level}`,
				error ? "error" : "info",
			);
		},
	});
}
