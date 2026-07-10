import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type FileStatus = "modified" | "added" | "renamed" | "copied";

interface ChangedFile {
	readonly path: string;
	readonly status: FileStatus;
}

interface SimplifyOptions {
	readonly files: readonly string[];
	readonly ref: string;
	readonly staged: boolean;
}

const STATUS_MAP: Record<string, FileStatus> = {
	M: "modified",
	A: "added",
	R: "renamed",
	C: "copied",
};

function parseDiffOutput(stdout: string): ChangedFile[] {
	const files: ChangedFile[] = [];
	for (const line of stdout.split("\n")) {
		if (!line.trim()) continue;
		const parts = line.split("\t");
		const statusCode = parts[0]?.[0];
		if (!statusCode) continue;
		const status = STATUS_MAP[statusCode];
		if (!status) continue;
		// Renamed (R100\told\tnew) and copied (C100\told\tnew) have two paths; use the new one.
		const path = (status === "renamed" || status === "copied") ? parts[2] : parts[1];
		if (path) files.push({ path, status });
	}
	return files;
}

function parseArgs(args: string): SimplifyOptions {
	const tokens = args.trim().split(/\s+/).filter(Boolean);
	const files: string[] = [];
	let ref = "HEAD";
	let staged = false;
	for (const token of tokens) {
		if (token === "--staged") {
			staged = true;
		} else if (token.startsWith("--ref=")) {
			ref = token.slice("--ref=".length);
		} else {
			files.push(token);
		}
	}
	return { files, ref, staged };
}

async function getChangedFiles(pi: ExtensionAPI, cwd: string, options: SimplifyOptions): Promise<ChangedFile[]> {
	if (options.files.length > 0) {
		return options.files.map((path) => ({ path, status: "modified" as const }));
	}

	const args = ["diff", "--name-status"];
	if (options.staged) {
		args.push("--cached");
	} else {
		args.push(options.ref);
	}

	const result = await pi.exec("git", args, { cwd });
	if (result.code === 0) {
		const files = parseDiffOutput(result.stdout);
		if (files.length > 0) return files;
	}

	// Fallback: diff against previous commit
	const fallback = await pi.exec("git", ["diff", "--name-status", "HEAD~1"], { cwd });
	if (fallback.code === 0) {
		return parseDiffOutput(fallback.stdout);
	}

	return [];
}

function buildSimplifyPrompt(files: readonly ChangedFile[]): string {
	const fileList = files.map((f) => `- ${f.path} (${f.status})`).join("\n");
	return `Review the following recently changed files and apply simplification improvements.

## Principles

- **Preserve functionality**: Never change what the code does. All existing tests must continue to pass.
- **Apply project standards**: Follow any conventions from CLAUDE.md or AGENTS.md in this project.
- **Enhance clarity**: Reduce unnecessary complexity and nesting, eliminate redundant code and abstractions, improve variable and function names, consolidate related logic, remove unnecessary comments that describe obvious code. Avoid nested ternary operators: prefer switch statements or if/else chains for multiple conditions.
- **Maintain balance**: Do not over-simplify. Avoid overly clever solutions that are hard to understand. Do not combine too many concerns into single functions. Do not remove helpful abstractions. Prioritize readability over fewer lines.

## Scope

Only review and modify these files:
${fileList}

## Process

1. Read each file listed above
2. Identify concrete improvements (dead code, unclear names, redundant logic, inconsistent patterns)
3. Apply changes one file at a time
4. After all changes, run existing tests to verify nothing is broken
5. Summarize what you changed and why

Do NOT add new features, change public APIs, or refactor code outside the listed files.`;
}

export default function simplifyExtension(pi: ExtensionAPI): void {
	pi.registerCommand("simplify", {
		description: "Review recently changed files for clarity, consistency, and maintainability improvements",
		handler: async (args, ctx) => {
			const options = parseArgs(args);
			const files = await getChangedFiles(pi, ctx.cwd, options);

			if (files.length === 0) {
				ctx.ui.notify(
					"No changed files found. Specify file paths or make some changes first.",
					"info",
				);
				return;
			}

			const prompt = buildSimplifyPrompt(files);
			pi.sendUserMessage(prompt, { deliverAs: "followUp" });
		},
	});
}
