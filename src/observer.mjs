import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, open, realpath } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TEXT = 16000;
const MAX_CALLS = 10000;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
const capture = (value) => {
  const text = typeof value === "string" ? value : canonical(value ?? null);
  return { text: text.slice(0, MAX_TEXT), truncated: text.length > MAX_TEXT, sha256: digest(text) };
};
const compareVersions = (a, b) =>
  a?.status === "ok" && b?.status === "ok" ? a.sha256 === b.sha256 : null;
const sameVersion = (a, b) => compareVersions(a, b) === true;

function requireIdentity(input, fields) {
  for (const field of fields) {
    const value = input?.[field];
    if (typeof value !== "string" || !value.trim())
      throw new Error(`Missing or invalid observation identity: ${field}`);
  }
}

async function snapshot(directory, target) {
  if (typeof target?.filePath !== "string") return null;
  const filename = path.resolve(directory, target.filePath);
  const relative = path.relative(directory, filename);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return { status: "outside_workspace" };
  }
  if (path.extname(filename).toLowerCase() !== ".py")
    return { path: relative, status: "unsupported_file" };
  let handle;
  try {
    const resolved = await realpath(filename);
    const realRelative = path.relative(directory, resolved);
    if (
      realRelative === ".." ||
      realRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(realRelative)
    ) {
      return { path: relative, status: "outside_workspace" };
    }
    handle = await open(resolved, "r");
    const before = await handle.stat();
    if (!before.isFile()) return { path: relative, status: "not_file" };
    if (before.size > MAX_FILE_BYTES)
      return { path: relative, status: "too_large", bytes: before.size };
    // Fixed buffer also bounds reads if another process grows the file.
    const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
    let count = 0;
    while (count < buffer.length) {
      const { bytesRead } = await handle.read(buffer, count, buffer.length - count, null);
      if (!bytesRead) break;
      count += bytesRead;
    }
    const after = await handle.stat();
    if (count > MAX_FILE_BYTES) return { path: relative, status: "too_large", bytes: count };
    if (
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs ||
      before.size !== count
    ) {
      return { path: relative, status: "changed_during_snapshot" };
    }
    return {
      path: relative,
      status: "ok",
      sha256: digest(buffer.subarray(0, count)),
      bytes: count,
    };
  } catch (error) {
    return { path: relative, status: error.code === "ENOENT" ? "missing" : "unavailable" };
  } finally {
    await handle?.close();
  }
}

export async function createObserver({
  directory,
  origin = "ordinary",
  logPath,
  warn = (message) => process.stderr.write(`${message}\n`),
}) {
  if (!["ordinary", "constructed"].includes(origin)) throw new Error("Unknown observation origin");
  const runID = randomUUID();
  let disabled = false;
  let disposed = false;
  let disposal;
  let queue = Promise.resolve();
  let totalOverheadMs = 0;
  const started = performance.now();
  const pending = new Map();
  const seen = new Map();
  const reads = new Map();
  const failures = new Map();

  // Serial writes prevent duplicate terminal events and interleaved JSON lines.
  // Observer failures disable logging and leave native tool execution intact.
  const guarded = (fn) => {
    if (disposed) return disposal;
    const next = queue.then(async () => {
      if (disabled) return;
      const begin = performance.now();
      try {
        await fn();
      } catch (error) {
        disabled = true;
        try {
          warn(`FORGE observer disabled: ${error.message}`);
        } catch {
          /* Keep tools running. */
        }
      } finally {
        totalOverheadMs += performance.now() - begin;
      }
    });
    queue = next;
    return next;
  };
  const emit = async (record) =>
    appendFile(
      logPath,
      `${JSON.stringify({
        schema: 1,
        run_id: runID,
        origin,
        observed_at: new Date().toISOString(),
        elapsed_ms: performance.now() - started,
        ...record,
      })}\n`,
      "utf8",
    );

  await guarded(async () => {
    directory = await realpath(directory);
    logPath ??= path.join(directory, ".forge", "observations", `${runID}.jsonl`);
    await mkdir(path.dirname(logPath), { recursive: true });
    await emit({
      type: "observer_started",
      observer_version: "0.1.0",
      mode: "observe",
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      opencode_version: null,
      remaining_execution_allowance: null,
      limits: { max_calls: MAX_CALLS, max_file_bytes: MAX_FILE_BYTES, max_text_chars: MAX_TEXT },
      measurement_note:
        "OpenCode version, task budget and server settings require the run manifest.",
    });
  });

  const finish = async (input) => {
    requireIdentity(input, ["sessionID", "callID", "tool"]);
    if (!["completed", "error"].includes(input.status))
      throw new Error("Invalid observation terminal status");
    const { status, text = "", candidate = null, read, source } = input;
    const key = canonical([input.sessionID, input.callID]);
    const attempt = pending.get(key);
    const terminal = seen.get(key);
    const previousTool = attempt?.tool ?? terminal?.tool;
    if (previousTool && previousTool !== input.tool)
      throw new Error("Conflicting observation tool identity");
    if (terminal) {
      if (terminal.status !== status) throw new Error("Conflicting observation terminal status");
      return;
    }
    if (seen.size + pending.size >= MAX_CALLS && !pending.has(key))
      throw new Error("Observation call limit reached");
    seen.set(key, { tool: input.tool, status });
    pending.delete(key);
    const args = attempt?.args ?? input.args ?? {};
    const after = await snapshot(directory, attempt ? attempt.target : input.target);
    const fileKey = after?.path ? canonical([input.sessionID, after.path]) : null;
    const lastRead = fileKey ? reads.get(fileKey) : null;
    const previous = fileKey ? failures.get(fileKey) : null;
    const fingerprint = digest(canonical({ tool: input.tool, args }));
    const current = attempt?.before ?? null;
    await emit({
      type: "tool_finished",
      session_id: input.sessionID,
      call_id: input.callID,
      tool: input.tool,
      status,
      source,
      arguments: capture(args),
      action_sha256: fingerprint,
      result: capture(text),
      candidate,
      before: current,
      after,
      duration_ms: attempt ? performance.now() - attempt.start : null,
      before_hook_missing: !attempt,
      read_evidence: lastRead
        ? { ...lastRead, matches_before: compareVersions(lastRead.version, current) }
        : null,
      previous_failure: previous
        ? {
            call_id: previous.callID,
            same_action: previous.fingerprint === fingerprint,
            same_version: compareVersions(previous.version, current),
            same_candidate: previous.candidate === candidate,
          }
        : null,
      observer_work_ms_before_record: totalOverheadMs,
      remaining_execution_allowance: null,
      recovery_action: null,
    });
    if (read && status === "completed" && fileKey) {
      reads.set(fileKey, {
        call_id: input.callID,
        version: sameVersion(current, after) ? after : null,
        requested_offset: attempt?.target?.offset ?? read.offset ?? null,
        requested_limit: attempt?.target?.limit ?? read.limit ?? null,
        returned_lines: read.returnedLines ?? null,
        truncated: read.truncated ?? null,
        note: "Matching snapshots are evidence of a read version, not proof all relevant text was read.",
      });
    }
    if (candidate && fileKey)
      failures.set(fileKey, {
        callID: input.callID,
        fingerprint,
        version: current,
        candidate,
      });
  };

  return {
    recordToolStart: (input) =>
      guarded(async () => {
        requireIdentity(input, ["sessionID", "callID", "tool"]);
        const key = canonical([input.sessionID, input.callID]);
        const existing = pending.get(key) ?? seen.get(key);
        if (existing) {
          if (existing.tool !== input.tool)
            throw new Error("Conflicting observation tool identity");
          return;
        }
        if (seen.size + pending.size >= MAX_CALLS)
          throw new Error("Observation call limit reached");
        const args = structuredClone(input.args ?? {});
        const target = structuredClone(input.target ?? null);
        const before = await snapshot(directory, target);
        pending.set(key, { tool: input.tool, args, target, before, start: performance.now() });
        await emit({
          type: "tool_started",
          session_id: input.sessionID,
          call_id: input.callID,
          tool: input.tool,
          arguments: capture(args),
          before,
        });
      }),
    recordToolFinish: (input) => guarded(() => finish(input)),
    recordSessionError: (input) =>
      guarded(() =>
        emit({
          type: "session_error",
          session_id: input.sessionID ?? null,
          error: capture(input.error),
          category: "requires_manual_review",
        }),
      ),
    recordUsage: (input) =>
      guarded(() => {
        requireIdentity(input, ["sessionID", "messageID"]);
        return emit({
          type: "assistant_usage",
          session_id: input.sessionID,
          message_id: input.messageID,
          model_id: input.modelID,
          provider_id: input.providerID,
          tokens: input.tokens ?? null,
          cost: input.cost ?? null,
          note: "Cumulative message update; retain only the latest update per message.",
        });
      }),
    recordModelParameters: (input) =>
      guarded(() => {
        requireIdentity(input, ["sessionID"]);
        return emit({
          type: "model_parameters",
          session_id: input.sessionID,
          model_id: input.modelID ?? null,
          provider_id: input.providerID ?? null,
          temperature: input.temperature ?? null,
          top_p: input.topP ?? null,
          top_k: input.topK ?? null,
          max_output_tokens: input.maxOutputTokens ?? null,
          note: "Provider options and server-side inference settings are omitted; record in manifest.",
        });
      }),
    dispose: () => {
      if (disposal) return disposal;
      disposal = guarded(() =>
        emit({
          type: "observer_stopped",
          pending_calls: pending.size,
          observer_work_ms_before_record: totalOverheadMs,
        }),
      ).finally(() => {
        pending.clear();
        seen.clear();
        reads.clear();
        failures.clear();
      });
      // Previously queued observations finish before shutdown; new calls wait for
      // that same shutdown promise without appending to the closed log.
      disposed = true;
      return disposal;
    },
  };
}
