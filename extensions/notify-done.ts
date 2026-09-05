/**
 * Notify when the agent finishes and is waiting for input.
 *
 * Channels (auto-detected):
 * - Windows Terminal / WSL: PowerShell toast
 * - macOS: osascript notification
 * - Kitty: OSC 99
 * - Recognized other terminals: OSC 777 (Ghostty, iTerm2, WezTerm, urxvt)
 * - Linux desktop: notify-send (last desktop fallback)
 *
 * OSC uses tmux passthrough when available. Terminal writes are best-effort:
 * success does not confirm that the desktop displayed the notification.
 * - Terminal bell (fallback if all notification channels fail)
 *
 * Skips runs shorter than QUIET_SECONDS (avoids spam on instant replies).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);

const TITLE = "Pi";
const DEFAULT_BODY = "Agent finished — ready for input";
/** Only notify if the run lasted at least this many seconds. 0 = always. */
const QUIET_SECONDS = 3;

let runStartedAt: number | null = null;
let lastPreview: string | undefined;
let notified = false;

function escapePs(s: string): string {
	return s.replace(/'/g, "''");
}

function escapeApple(s: string): string {
	return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function windowsToastScript(title: string, body: string): string {
	const type = "Windows.UI.Notifications";
	const mgr = `[${type}.ToastNotificationManager, ${type}, ContentType = WindowsRuntime]`;
	const template = `[${type}.ToastTemplateType]::ToastText02`;
	return [
		`${mgr} > $null`,
		`$xml = [${type}.ToastNotificationManager]::GetTemplateContent(${template})`,
		`$texts = $xml.GetElementsByTagName('text')`,
		`$texts[0].AppendChild($xml.CreateTextNode('${escapePs(title)}')) > $null`,
		`$texts[1].AppendChild($xml.CreateTextNode('${escapePs(body)}')) > $null`,
		`[${type}.ToastNotificationManager]::CreateToastNotifier('Pi').Show([${type}.ToastNotification]::new($xml))`,
	].join("; ");
}

async function writeOSC(sequence: string): Promise<void> {
	if (!process.stdout.isTTY) throw new Error("No terminal for OSC notification");
	if (process.env.TMUX) {
		const args = ["show-options", "-Apv"];
		if (process.env.TMUX_PANE) args.push("-t", process.env.TMUX_PANE);
		args.push("allow-passthrough");
		const { stdout } = await execFileAsync("tmux", args, { timeout: 1000 });
		if (!["on", "all"].includes(stdout.trim())) {
			throw new Error("tmux passthrough is disabled");
		}
		sequence = `\x1bPtmux;${sequence.replace(/\x1b/g, "\x1b\x1b")}\x1b\\`;
	}
	process.stdout.write(sequence);
}

async function notifyOSC777(title: string, body: string): Promise<void> {
	await writeOSC(`\x1b]777;notify;${title.replace(/;/g, ",")};${body.replace(/;/g, ",")}\x07`);
}

async function notifyOSC99(title: string, body: string): Promise<void> {
	await writeOSC(
		`\x1b]99;i=pi-done:d=0;${title}\x1b\\` +
		`\x1b]99;i=pi-done:p=body:d=1;${body}\x1b\\`,
	);
}

function bell(): void {
	process.stdout.write("\x07");
}

async function notifyDesktop(title: string, body: string): Promise<boolean> {
	const platform = process.platform;
	// Notification text must not inject terminal control sequences.
	title = title.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
	body = body.replace(/[\x00-\x1f\x7f-\x9f]/g, "");

	if (process.env.WT_SESSION) {
		try {
			await execFileAsync("powershell.exe", [
				"-NoProfile",
				"-Command",
				windowsToastScript(title, body),
			]);
			return true;
		} catch {
			// fall through
		}
	}

	if (platform === "darwin") {
		try {
			const script = `display notification "${escapeApple(body)}" with title "${escapeApple(title)}"`;
			await execFileAsync("osascript", ["-e", script]);
			return true;
		} catch {
			// fall through
		}
	}

	if (process.env.KITTY_WINDOW_ID) {
		try {
			await notifyOSC99(title, body);
			return true;
		} catch {
			// fall through
		}
	}

	const supportsOSC777 =
		/^(ghostty|iTerm\.app|WezTerm)$/i.test(process.env.TERM_PROGRAM ?? "") ||
		process.env.GHOSTTY_RESOURCES_DIR || process.env.ITERM_SESSION_ID ||
		process.env.WEZTERM_PANE || /^rxvt-unicode/.test(process.env.TERM ?? "");
	if (supportsOSC777) {
		try {
			await notifyOSC777(title, body);
			return true;
		} catch {
			// fall through to notify-send
		}
	}

	if (platform === "linux") {
		try {
			await execFileAsync("notify-send", [
				"--app-name=Pi",
				"--urgency=normal",
				"--expire-time=8000",
				"--icon=dialog-information",
				title,
				body,
			]);
			return true;
		} catch {
			// fall through to terminal bell
		}
	}

	return false;
}

function previewFromMessages(messages: unknown[]): string | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i] as {
			role?: string;
			content?: string | Array<{ type?: string; text?: string }>;
		};
		if (m?.role !== "assistant") continue;
		const c = m.content;
		let text = "";
		if (typeof c === "string") text = c;
		else if (Array.isArray(c)) {
			text = c
				.filter((p) => p?.type === "text" && p.text)
				.map((p) => p.text!)
				.join(" ");
		}
		text = text.replace(/\s+/g, " ").trim();
		if (!text) return undefined;
		return text.length > 120 ? `${text.slice(0, 117)}…` : text;
	}
	return undefined;
}

async function fire(body: string = DEFAULT_BODY): Promise<void> {
	if (!(await notifyDesktop(TITLE, body))) bell();
}

export default function (pi: ExtensionAPI) {
	pi.on("agent_start", async () => {
		runStartedAt = Date.now();
		lastPreview = undefined;
		notified = false;
	});

	// Capture last assistant text from the low-level run (settled event has no messages)
	pi.on("agent_end", async (event) => {
		const messages = (event as { messages?: unknown[] }).messages ?? [];
		lastPreview = previewFromMessages(messages) ?? lastPreview;
	});

	// Truly idle — no retry / compact / follow-up left
	pi.on("agent_settled", async (_event, ctx) => {
		if (notified) return;
		if (ctx.mode !== "tui") return;

		if (QUIET_SECONDS > 0 && runStartedAt != null) {
			const elapsed = (Date.now() - runStartedAt) / 1000;
			if (elapsed < QUIET_SECONDS) {
				notified = true;
				runStartedAt = null;
				return;
			}
		}
		notified = true;
		runStartedAt = null;

		await fire(lastPreview ?? DEFAULT_BODY);
		lastPreview = undefined;
	});
}
