import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const INIT_PROMPT = `Act as a Senior Principal Software Architect. Your task is to generate a comprehensive AGENTS.md file (compatible with Cursor, Windsurf, Aider) and CLAUDE.md (for Claude Code) to be placed in the root of my project.

**CRITICAL FIRST STEP:** Before you write anything, use your file reading capabilities to analyze my existing codebase. You MUST do the following:
1. Read package.json, Cargo.toml, pyproject.toml, go.mod, Gemfile, or requirements.txt to identify the exact tech stack and versions.
2. Read existing configuration files (e.g., .eslintrc, tsconfig.json, .prettierrc, .flake8, rustfmt.toml) to extract our exact linting/formatting rules.
3. Read at least 3-5 existing source code files (e.g., src/ or lib/) to infer our specific coding idioms, import ordering, error-handling patterns, and module structure.
4. Read the existing README.md and any CONTRIBUTING.md to align with existing documentation.

Now, generate the AGENTS.md file using the following strict structure. Do not leave any placeholder text like "[Insert here]"—infer the actual values from the codebase. If you cannot find a specific rule, infer it logically from the surrounding code patterns.

### 1. Project Overview & Philosophy
- **Name/Description:** Brief summary of what this repo does.
- **Core Tenets:** (e.g., Performance-first, Type-safety, Simplicity). Identify these from the code style.
- **Development Principles:** Always include these exactly (do not omit or weaken):
  - **KISS** — Prefer the simplest solution; don't add abstractions or tools the project doesn't already need.
  - **YAGNI** — Build for the current phase; don't implement things before they're required.
  - **Single Responsibility** — Each file and function does one thing; keep UI, state, logic, and types separate.
  - **DRY** — Don't duplicate logic or data; extract it so each piece of knowledge lives in one place.
- **Critical Dependencies:** List the main frameworks and *why* they are used (e.g., "We use Axios for HTTP because of interceptors").
- **Entrypoints:** The main binaries, server starts, or CLI entry files.

### 2. Directory Structure (The Map)
Provide a tree-like breakdown, but specifically annotate the *purpose* of each major directory (e.g., src/hooks/ -> Custom React hooks, src/repos/ -> Database repository patterns). Explain where **new files of a specific type** must be placed.

### 3. Development Commands (The Handbook)
Provide exact, copy-pasteable terminal commands for:
- Installing dependencies
- Running the development server (with HMR)
- Running **unit tests** (with coverage flag if used)
- Running **integration/e2e tests**
- Linting (npm run lint or similar) and fixing
- Building the production bundle

### 4. Code Style & Naming Conventions (Explicit)
Define the enforced rules we use. Infer these from linter configs and existing file names. Examples:
- **Files:** kebab-case.ts vs PascalCase.tsx?
- **Functions:** camelCase vs snake_case?
- **Interfaces/Types:** PascalCase with or without 'I' prefix?
- **Export style:** export default vs named exports? (Look at existing imports).
- **Imports ordering:** External libs first, then internal modules. Specify exactly how to group them.

### 5. Architecture Patterns (The Invariants)
Look at how data flows through the codebase. Describe:
- **State management:** (e.g., Redux slices, Context API, Zustand, or manual props).
- **API Layer:** How are requests made? Are there generated clients (OpenAPI/GraphQL)?
- **Error Handling:** Does the code use try/catch, Result types, or Either monads? Stick to the exact pattern used.
- **Logging:** Which logger is used and at what levels?

### 6. Testing Strategy
- Where are test files located? (__tests__/ vs *.spec.ts next to the file).
- What is the preferred assertion library? (jest, chai, pytest).
- **Rule:** When generating tests, must they hit the real DB or use a mock? (Infer from existing test files).

### 7. Git & PR Workflow
- **Commit message convention:** Look at .git history. Is it Conventional Commits, or freeform? Specify the exact format.
- **Branch strategy:** Are we using main/develop/feature/?
- **PR Checklist:** List the tasks the AI should ensure are done before creating a PR (e.g., "Run npm run format", "Ensure no console.log remains").

### 8. Explicit Constraints (The Bouncer)
Based on the project's pain points and guardrails, list hard rules:
- **NEVER** hardcode secrets (look for .env.example patterns).
- **NEVER** mutate state directly (if using React/Redux).
- **ALWAYS** handle the null/undefined edge case (e.g., using optional chaining or explicit if checks).
- **ALWAYS** update the associated OpenAPI spec if changing routes (if applicable).

### 9. Context Triggers
List specific files the AI should *always* read before making global changes (e.g., tailwind.config.js for styling, next.config.js for routing, drizzle.config.ts for DB).

---

**Output Formatting:** Return the final content as a clean, raw Markdown block. Make it verbose enough to remove ambiguity but concise enough for fast AI context loading. Save it as AGENTS.md in the project root. Do NOT create CLAUDE.md — the extension will create it as a symlink after you finish writing AGENTS.md. Confirm AGENTS.md was written and summarize the key conventions you discovered.`;

export default function initExtension(pi: ExtensionAPI) {
	pi.registerCommand("init", {
		description: "Generate AGENTS.md and CLAUDE.md (symlink) from the current codebase",
		handler: async (_args, ctx) => {
			if (!ctx.isIdle()) {
				ctx.ui.notify("Agent is busy. Wait for it to finish, then run /init again.", "warning");
				return;
			}

			ctx.ui.notify("Analyzing codebase and generating AGENTS.md...", "info");
			pi.sendUserMessage(INIT_PROMPT);

			try {
				await ctx.waitForIdle();
			} catch (err) {
				ctx.ui.notify(`Agent turn failed: ${err instanceof Error ? err.message : String(err)}`, "error");
				return;
			}

			const fs = await import("node:fs");
			const path = await import("node:path");

			const agentsPath = path.join(ctx.cwd, "AGENTS.md");
			const claudePath = path.join(ctx.cwd, "CLAUDE.md");

			if (!fs.existsSync(agentsPath)) {
				ctx.ui.notify("AGENTS.md was not created. Symlink not created.", "error");
				return;
			}

			try {
				if (fs.existsSync(claudePath)) {
					const stat = fs.lstatSync(claudePath);
					if (stat.isSymbolicLink()) {
						const target = fs.readlinkSync(claudePath);
						if (target === "AGENTS.md" || path.resolve(ctx.cwd, target) === agentsPath) {
							ctx.ui.notify("CLAUDE.md is already symlinked to AGENTS.md.", "info");
							return;
						}
					}
					fs.rmSync(claudePath, { recursive: true, force: true });
				}

				fs.symlinkSync("AGENTS.md", claudePath);
				ctx.ui.notify("Created CLAUDE.md -> AGENTS.md symlink.", "info");
			} catch (err) {
				ctx.ui.notify(`Failed to create CLAUDE.md symlink: ${err instanceof Error ? err.message : String(err)}`, "error");
			}
		},
	});
}
