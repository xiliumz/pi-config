import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { uuidv7 } from "@earendil-works/pi-ai";
import {
  compact,
  CONFIG_DIR_NAME,
  getAgentDir,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

interface SettingsFile {
  compactionModel?: {
    provider?: string;
    model?: string;
  };
}

function readSettings(path: string): SettingsFile {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SettingsFile;
  } catch {
    return {};
  }
}

function loadCompactionModel(cwd: string, projectTrusted: boolean) {
  const global = readSettings(join(getAgentDir(), "settings.json")).compactionModel;
  const project = projectTrusted
    ? readSettings(join(cwd, CONFIG_DIR_NAME, "settings.json")).compactionModel
    : undefined;

  const provider = project?.provider ?? global?.provider;
  const model = project?.model ?? global?.model;
  return provider && model ? { provider, model } : undefined;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_before_compact", async (event, ctx) => {
    const configured = loadCompactionModel(ctx.cwd, ctx.isProjectTrusted());
    const model = configured
      ? ctx.modelRegistry.find(configured.provider, configured.model)
      : undefined;
    if (!model) return;

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok) return;

    const headers = auth.headers
      ? Object.fromEntries(
          Object.entries(auth.headers).filter(([, value]) => value !== null),
        )
      : undefined;

    try {
      const result = await compact(
        event.preparation,
        model,
        auth.apiKey,
        headers,
        event.customInstructions,
        event.signal,
        "off",
        undefined,
        auth.env,
        undefined,
        undefined,
        uuidv7(),
      );

      return { compaction: result };
    } catch {
      return;
    }
  });
}
