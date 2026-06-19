import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function planCommandExtension(pi: ExtensionAPI) {
  pi.registerCommand("plan", {
    description: "Generate a plan in table format for the given topic",
    handler: async (args, ctx) => {
      const prompt = `Give me a plan in table format for:\n${args}`;
      await pi.sendUserMessage(prompt);
    },
  });
}
