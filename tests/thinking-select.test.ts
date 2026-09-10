import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { initTheme, SettingsManager } from "@earendil-works/pi-coding-agent";
import thinkingSelect from "../extensions/thinking-select.ts";

initTheme("dark", false);

test("thinking shortcut saves defaults only with Ctrl+S and reports save failures", async (t) => {
	const dir = mkdtempSync(join(tmpdir(), "pi-thinking-select-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const settingsPath = join(dir, "settings.json");
	writeFileSync(settingsPath, JSON.stringify({ defaultThinkingLevel: "high", theme: "dark" }));
	const create = SettingsManager.create.bind(SettingsManager);
	t.mock.method(SettingsManager, "create", (cwd, _agentDir, options) => {
		assert.equal(cwd, dir);
		assert.deepEqual(options, { projectTrusted: false });
		return create(cwd, dir, options);
	});

	let handler: (ctx: any) => Promise<void>;
	let level = "high";
	let query = "";
	let key = "";
	let rendered = "";
	let opened = 0;
	const notices: Array<[string, string]> = [];
	thinkingSelect({
		registerShortcut: (shortcut, options) => {
			assert.equal(shortcut, "shift+tab");
			handler = options.handler;
		},
		getThinkingLevel: () => level,
		setThinkingLevel: (value) => { level = value; },
	} as any);

	const ctx = {
		mode: "tui",
		cwd: dir,
		isProjectTrusted: () => false,
		model: { provider: "anthropic", api: "anthropic-messages", id: "claude-sonnet-4-5", reasoning: true },
		ui: {
			notify: (message: string, type: string) => notices.push([message, type]),
			custom: (factory: any) => new Promise((resolve) => {
				opened++;
				let closed = false;
				const selector = factory(null, null, null, (value: unknown) => {
					closed = true;
					resolve(value);
				});
				rendered = selector.render(120).join("\n");
				for (const char of query) selector.handleInput(char);
				selector.handleInput(key);
				assert.equal(closed, true, "the selection key must close the picker");
			}),
		},
	};

	query = "medium";
	key = "\x13"; // Ctrl+S
	await handler!(ctx);
	assert.equal(level, "medium");
	assert.deepEqual(JSON.parse(readFileSync(settingsPath, "utf8")), {
		defaultThinkingLevel: "medium", theme: "dark",
	});
	assert.deepEqual(notices, [["Default thinking level: medium", "info"]]);

	query = "low";
	key = "\r";
	await handler!(ctx);
	assert.match(rendered, /medium.*default/);
	assert.equal(level, "low");
	assert.equal(create(dir, dir).getDefaultThinkingLevel(), "medium");
	assert.equal(notices.length, 1);

	query = "high";
	key = "\x1b";
	await handler!(ctx);
	assert.equal(level, "low");
	assert.equal(create(dir, dir).getDefaultThinkingLevel(), "medium");

	query = "off";
	key = "\x13";
	await handler!(ctx);
	assert.equal(level, "off");
	assert.equal(create(dir, dir).getDefaultThinkingLevel(), "off");

	// A settings parse error must not overwrite the file or claim a successful save.
	writeFileSync(settingsPath, "{invalid");
	query = "high";
	await handler!(ctx);
	assert.equal(readFileSync(settingsPath, "utf8"), "{invalid");
	assert.equal(notices.at(-1)?.[1], "error");
	assert.match(notices.at(-1)![0], /^Failed to save default thinking level:/);

	// SettingsManager queues write failures rather than rejecting flush().
	t.mock.method(SettingsManager, "create", () => SettingsManager.fromStorage({
		withLock: (_scope, update) => {
			if (update('{"defaultThinkingLevel":"medium"}') !== undefined) {
				throw new Error("test settings write failure");
			}
		},
	}));
	await handler!(ctx);
	assert.deepEqual(notices.at(-1), [
		"Failed to save default thinking level: test settings write failure", "error",
	]);

	const before = opened;
	await handler!({ ...ctx, mode: "rpc" });
	await handler!({ ...ctx, model: undefined });
	assert.equal(opened, before);
});
