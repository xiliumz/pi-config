import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const TIMER_ID = "agent-timer";

export function formatElapsed(milliseconds: number): string {
	return `${(milliseconds / 1000).toFixed(1)}s`;
}

export default function (pi: ExtensionAPI) {
	let startedAt: number | null = null;
	let timer: ReturnType<typeof setInterval> | null = null;

	pi.registerEntryRenderer(TIMER_ID, (entry, _options, theme) => {
		const elapsed = (entry.data as { elapsed: string }).elapsed;
		const text = `Took ${elapsed}`;
		return {
			render: (width) => [theme.fg("dim", text.slice(0, Math.max(0, width)))],
			invalidate() {},
		};
	});

	function clearTimer(): void {
		if (timer) clearInterval(timer);
		timer = null;
	}

	function showRunning(ctx: ExtensionContext): void {
		if (startedAt === null) return;
		const text = `running ${formatElapsed(Date.now() - startedAt)}`;
		ctx.ui.setStatus(TIMER_ID, ctx.ui.theme.fg("dim", text));
	}

	pi.on("agent_start", (_event, ctx) => {
		if (!ctx.hasUI || startedAt !== null) return;

		startedAt = Date.now();
		showRunning(ctx);
		timer = setInterval(() => showRunning(ctx), 1000);
		timer.unref?.();
	});

	pi.on("agent_settled", (_event, ctx) => {
		if (startedAt === null) return;

		const elapsed = formatElapsed(Date.now() - startedAt);
		clearTimer();
		ctx.ui.setStatus(TIMER_ID, undefined);
		startedAt = null;
		pi.appendEntry(TIMER_ID, { elapsed });
	});

	pi.on("session_shutdown", (_event, ctx) => {
		clearTimer();
		startedAt = null;
		ctx.ui.setStatus(TIMER_ID, undefined);
	});
}
