import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const TIMER_ID = "agent-timer";

export function formatElapsed(milliseconds: number): string {
	const totalSeconds = Math.floor(milliseconds / 1000);
	const seconds = totalSeconds % 60;
	const totalMinutes = Math.floor(totalSeconds / 60);
	const minutes = totalMinutes % 60;
	const hours = Math.floor(totalMinutes / 60);

	return hours > 0
		? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
		: `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function (pi: ExtensionAPI) {
	let startedAt: number | null = null;
	let timer: ReturnType<typeof setInterval> | null = null;

	pi.registerEntryRenderer(TIMER_ID, (entry) => {
		const elapsed = (entry.data as { elapsed: string }).elapsed;
		const text = `Agent ran for ${elapsed}`;
		return {
			render: (width) => [text.slice(0, Math.max(0, width))],
			invalidate() {},
		};
	});

	function clearTimer(): void {
		if (timer) clearInterval(timer);
		timer = null;
	}

	function showRunning(ctx: ExtensionContext): void {
		if (startedAt === null) return;
		ctx.ui.setStatus(TIMER_ID, `running ${formatElapsed(Date.now() - startedAt)}`);
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
