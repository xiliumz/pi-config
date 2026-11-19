import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { compileFunction } from "node:vm";

// Run the real extension isolated, without resolving @earendil-works/pi-* at test time.
const source = stripTypeScriptTypes(
	readFileSync(new URL("../extensions/rename-session.ts", import.meta.url), "utf8"),
)
	.replace(/^import .*;\r?\n/gm, "")
	.replace(/export default function\s*\(/, "function register(");
const Type = {
	Object: (properties: unknown) => ({ type: "object", properties }),
	String: (options: unknown) => ({ type: "string", options }),
};
const load = compileFunction(`${source}; return { register };`, ["Type"]);

function setup() {
	const { register } = load(Type) as any;
	let tool: any;
	let current: string | undefined = "old name";
	register({
		registerTool: (definition: any) => { tool = definition; },
		setSessionName: (name: string) => { current = name; },
		getSessionName: () => current,
	} as any);
	return { tool, getCurrent: () => current };
}

test("trims session name via tool", async () => {
	const { tool, getCurrent } = setup();
	const result = await tool.execute("call-1", { name: "  fix auth bug  " });
	assert.equal(getCurrent(), "fix auth bug");
	assert.equal(result.details.sessionName, "fix auth bug");
});

test("rejects empty session name via tool", async () => {
	const { tool } = setup();
	await assert.rejects(tool.execute("call-1", { name: "   " }), /must not be empty/);
	await assert.rejects(tool.execute("call-1", { name: "" }), /must not be empty/);
});

test("renames session and returns previous name", async () => {
	const { tool, getCurrent } = setup();
	assert.equal(tool.name, "rename_session");
	const result = await tool.execute("call-1", { name: "  new name  " });
	assert.equal(getCurrent(), "new name");
	assert.equal(result.details.sessionName, "new name");
	assert.equal(result.details.previousName, "old name");
	assert.match(result.content[0].text, /Renamed session from 'old name' to 'new name'/);
});
