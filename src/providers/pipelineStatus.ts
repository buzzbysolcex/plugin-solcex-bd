import type { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";

export const pipelineStatusProvider: Provider = {
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<string> => {
    const apiUrl = runtime.getSetting("SOLCEX_API_URL");
    const apiKey = runtime.getSetting("SOLCEX_API_KEY");

    if (!apiUrl || !apiKey) {
      return "SolCex pipeline status: Not connected (SOLCEX_API_URL/KEY not configured).";
    }

    try {
      const resp = await fetch(`${apiUrl}/pipeline/status`, {
        headers: { "X-SolCex-API-Key": apiKey },
      });

      if (!resp.ok) {
        return "SolCex pipeline status: API temporarily unavailable.";
      }

      const data = await resp.json();

      return (
        `SolCex Pipeline Status:\n` +
        `  Total tokens tracked: ${data.total || 0}\n` +
        `  HOT (85+): ${data.hot || 0}\n` +
        `  Qualified (70-84): ${data.qualified || 0}\n` +
        `  Pending outreach: ${data.pendingOutreach || 0}\n` +
        `  Last updated: ${data.updatedAt || "unknown"}`
      );
    } catch {
      return "SolCex pipeline status: Connection failed.";
    }
  },
};
