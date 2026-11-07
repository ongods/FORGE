import { createObserver } from "../observer.mjs";

// Native tool names and diagnostics belong to this adapter, not the shared observer.
// Candidates remain evidence for manual review, never instructions to interrupt a run.
export function classify(tool, status, text) {
  if (
    tool === "edit" &&
    status === "error" &&
    /Could not find oldString|Found multiple matches for oldString|Refusing replacement|No changes to apply: oldString|oldString cannot be empty/.test(
      text,
    )
  ) {
    return "replacement_failed";
  }
  if (
    ["bash", "edit", "write"].includes(tool) &&
    /(?:^|\n)(?:\s*E\s+)?\s*(?:SyntaxError|IndentationError|TabError):[^\n]*/.test(text)
  ) {
    return "python_syntax_candidate";
  }
  return null;
}

const targetOf = (tool, args) =>
  ["read", "edit", "write"].includes(tool)
    ? {
        filePath: args?.filePath,
        ...(tool === "read" ? { offset: args?.offset || 1, limit: args?.limit ?? 2000 } : {}),
      }
    : null;

const returnedLinesOf = (display) => {
  if (display?.type !== "file") return null;
  const { lineStart, lineEnd } = display;
  return Number.isSafeInteger(lineStart) &&
    lineStart > 0 &&
    Number.isSafeInteger(lineEnd) &&
    lineEnd >= lineStart
    ? [lineStart, lineEnd]
    : null;
};

export async function createOpenCodeObserver(options) {
  const observer = await createObserver(options);
  let disabled = false;
  let disposed = false;
  // Mapping is observer work too; a bad payload must not break the native agent.
  const adapt =
    (fn) =>
    async (...args) => {
      if (disabled || disposed) return;
      try {
        await fn(...args);
      } catch (error) {
        disabled = true;
        try {
          const warn = options.warn ?? ((message) => process.stderr.write(`${message}\n`));
          warn(`FORGE adapter disabled: ${error.message}`);
        } catch {
          /* Keep tools running. */
        }
      }
    };
  const finish = (input, status, text, metadata, source) => {
    const display = metadata?.display;
    return observer.recordToolFinish({
      ...input,
      target: targetOf(input.tool, input.args),
      status,
      text,
      candidate: classify(input.tool, status, text),
      source,
      read:
        input.tool === "read"
          ? {
              offset: input.args?.offset || 1,
              limit: input.args?.limit ?? 2000,
              returnedLines: returnedLinesOf(display),
              truncated: typeof metadata?.truncated === "boolean" ? metadata.truncated : null,
            }
          : null,
    });
  };

  return {
    "tool.execute.before": adapt((input, output) =>
      observer.recordToolStart({
        ...input,
        args: output.args,
        target: targetOf(input.tool, output.args),
      }),
    ),
    "tool.execute.after": adapt((input, output) =>
      finish(input, "completed", output.output ?? "", output.metadata, "after_hook"),
    ),
    event: adapt(({ event }) => {
      const part = event?.properties?.part;
      if (
        event?.type === "message.part.updated" &&
        part?.type === "tool" &&
        ["completed", "error"].includes(part.state?.status)
      ) {
        return finish(
          {
            tool: part.tool,
            sessionID: part.sessionID,
            callID: part.callID,
            args: part.state.input,
          },
          part.state.status,
          part.state.error ?? part.state.output ?? "",
          part.state.metadata,
          "terminal_event",
        );
      }
      if (event?.type === "session.error")
        return observer.recordSessionError({
          sessionID: event.properties?.sessionID,
          error: event.properties?.error,
        });
      const info = event?.properties?.info;
      if (event?.type === "message.updated" && info?.role === "assistant") {
        return observer.recordUsage({ ...info, messageID: info.id });
      }
      return Promise.resolve();
    }),
    "chat.params": adapt((input, output) =>
      observer.recordModelParameters({
        sessionID: input.sessionID,
        modelID: input.model?.id,
        providerID: input.model?.providerID,
        temperature: output.temperature,
        topP: output.topP,
        topK: output.topK,
        maxOutputTokens: output.maxOutputTokens,
      }),
    ),
    dispose: () => {
      disposed = true;
      return disabled ? Promise.resolve() : observer.dispose();
    },
  };
}
