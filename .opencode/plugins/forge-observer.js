import { createOpenCodeObserver } from "../../src/adapters/opencode.mjs";

// Export only the plugin function: OpenCode treats every export as a plugin.
export const ForgeObserver = async ({ directory }) => {
  if (process.env.FORGE_OBSERVE !== "1") return {};
  const origin = process.env.FORGE_OBSERVATION_ORIGIN ?? "ordinary";
  if (!["ordinary", "constructed"].includes(origin)) {
    process.stderr.write("FORGE observer disabled: invalid FORGE_OBSERVATION_ORIGIN\n");
    return {};
  }
  return createOpenCodeObserver({ directory, origin });
};
