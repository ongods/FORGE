import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, writeFile, mkdir, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createOpenCodeObserver, classify } from "../src/adapters/opencode.mjs";
import { summarize } from "../scripts/summarize.mjs";
import { ForgeObserver } from "../.opencode/plugins/forge-observer.js";

async function temporaryDirectory(t, prefix) {
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(parent, prefix));
  t.after(async () => {
    assert.equal(path.dirname(directory), parent);
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  return directory;
}

async function setup(t) {
  const directory = await temporaryDirectory(t, "forge-test-");
  const filename = path.join(directory, "example.py");
  const logPath = path.join(directory, "observations.jsonl");
  await writeFile(filename, "value = 1\n");
  const hooks = await createOpenCodeObserver({ directory, logPath, origin: "constructed" });
  const records = async () => (await readFile(logPath, "utf8")).trim().split("\n").map(JSON.parse);
  let count = 0;
  const begin = async (tool, args, sessionID = "session-a") => {
    const input = { tool, sessionID, callID: String(++count) };
    const output = { args };
    await hooks["tool.execute.before"](input, output);
    assert.deepEqual(output, { args });
    return input;
  };
  const terminal = (
    input,
    args,
    status = "error",
    text = "Could not find oldString in the file.",
  ) =>
    hooks.event({
      event: {
        type: "message.part.updated",
        properties: {
          part: {
            type: "tool",
            ...input,
            state: {
              status,
              input: args,
              error: status === "error" ? text : undefined,
              output: status === "completed" ? text : undefined,
            },
          },
        },
      },
    });
  const complete = async (input, args, text = "ok", metadata = {}) => {
    const output = { output: text, metadata };
    const copy = structuredClone(output);
    await hooks["tool.execute.after"]({ ...input, args }, output);
    assert.deepEqual(output, copy);
  };
  return { directory, filename, hooks, records, begin, terminal, complete };
}

test("captures thrown edit failures without after hook and ignores duplicate terminal events", async (t) => {
  const s = await setup(t);
  const args = { filePath: s.filename, oldString: "absent", newString: "value = 2" };
  const input = await s.begin("edit", args);
  await Promise.all([s.terminal(input, args), s.terminal(input, args)]);
  const finished = (await s.records()).filter((r) => r.type === "tool_finished");
  assert.equal(finished.length, 1);
  assert.equal(finished[0].candidate, "replacement_failed");
  assert.equal(finished[0].source, "terminal_event");
  assert.equal(finished[0].before.sha256, finished[0].after.sha256);
  assert.equal(await readFile(s.filename, "utf8"), "value = 1\n");
});

test("distinguishes unchanged repetition from a retry after a file change", async (t) => {
  const s = await setup(t);
  const args = { filePath: s.filename, oldString: "absent", newString: "value = 2" };
  for (let n = 0; n < 2; n++) await s.terminal(await s.begin("edit", args), args);
  await writeFile(s.filename, "value = 9\n");
  await s.terminal(await s.begin("edit", args), args);
  const failures = (await s.records()).filter((r) => r.candidate);
  assert.equal(failures[1].previous_failure.same_action, true);
  assert.equal(failures[1].previous_failure.same_version, true);
  assert.equal(failures[2].previous_failure.same_action, true);
  assert.equal(failures[2].previous_failure.same_version, false);
});

test("retains partial read evidence and detects stale read versions", async (t) => {
  const s = await setup(t);
  const readArgs = { filePath: s.filename, offset: 1, limit: 1 };
  await s.complete(await s.begin("read", readArgs), readArgs, "1: value = 1", {
    display: { type: "file", lineStart: 1, lineEnd: 1 },
    truncated: true,
  });
  const args = { filePath: s.filename, oldString: "absent", newString: "value = 2" };
  await s.terminal(await s.begin("edit", args), args);
  await writeFile(s.filename, "value = 3\n");
  await s.terminal(await s.begin("edit", args), args);
  const failures = (await s.records()).filter((r) => r.candidate);
  assert.equal(failures[0].read_evidence.matches_before, true);
  assert.deepEqual(failures[0].read_evidence.returned_lines, [1, 1]);
  assert.equal(failures[0].read_evidence.truncated, true);
  assert.equal(failures[1].read_evidence.matches_before, false);
});

test("a file changed during a read is not assigned a known read version", async (t) => {
  const s = await setup(t);
  const args = { filePath: s.filename };
  const input = await s.begin("read", args);
  await writeFile(s.filename, "value = 7\n");
  await s.complete(input, args);
  const edit = { filePath: s.filename, oldString: "absent", newString: "value = 2" };
  await s.terminal(await s.begin("edit", edit), edit);
  const failure = (await s.records()).find((r) => r.candidate);
  assert.equal(failure.read_evidence.version, null);
  assert.equal(failure.read_evidence.matches_before, null);
  assert.equal(failure.read_evidence.requested_offset, 1);
  assert.equal(failure.read_evidence.requested_limit, 2000);
});

test("after-hook success plus completed event counts once; successful tests remain ordinary", async (t) => {
  const s = await setup(t);
  const args = { command: "python -m pytest" };
  const input = await s.begin("bash", args);
  await s.complete(input, args, "2 passed");
  await s.terminal(input, args, "completed", "2 passed");
  const finished = (await s.records()).filter((r) => r.type === "tool_finished");
  assert.equal(finished.length, 1);
  assert.equal(finished[0].candidate, null);
  assert.equal(finished[0].recovery_action, null);
});

test("session histories are isolated even when call IDs are reused", async (t) => {
  const s = await setup(t);
  const args = { filePath: s.filename, oldString: "absent", newString: "value = 2" };
  const input = await s.begin("edit", args);
  await s.terminal(input, args);
  const other = { ...input, sessionID: "session-b" };
  await s.hooks["tool.execute.before"](other, { args });
  await s.terminal(other, args);
  const finished = (await s.records()).filter((r) => r.type === "tool_finished");
  assert.equal(finished.length, 2);
  assert.equal(finished[1].previous_failure, null);
});

test("missing before hook is explicit and outside files are not hashed", async (t) => {
  const s = await setup(t);
  const args = {
    filePath: path.resolve(s.directory, "../outside.py"),
    oldString: "x",
    newString: "y",
  };
  await s.terminal({ tool: "edit", sessionID: "s", callID: "unseen" }, args);
  const record = (await s.records()).find((r) => r.type === "tool_finished");
  assert.equal(record.before_hook_missing, true);
  assert.equal(record.before, null);
  assert.equal(record.after.status, "outside_workspace");
});

test("observer write failures do not break agent tools", async (t) => {
  const directory = await temporaryDirectory(t, "forge-write-fail-");
  const logPath = path.join(directory, "is-a-directory");
  await mkdir(logPath);
  const warnings = [];
  const hooks = await createOpenCodeObserver({
    directory,
    logPath,
    warn: (message) => warnings.push(message),
  });
  await hooks["tool.execute.before"]({ tool: "bash", sessionID: "s", callID: "1" }, { args: {} });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /observer disabled/);
});

test("syntax candidates include nonzero shell exits reported as completed tools", () => {
  assert.equal(
    classify("bash", "completed", 'File "x.py", line 1\nSyntaxError: expected colon'),
    "python_syntax_candidate",
  );
  assert.equal(
    classify("bash", "completed", "E     IndentationError: unexpected indent"),
    "python_syntax_candidate",
  );
  assert.equal(classify("bash", "completed", "test_syntax_error PASSED"), null);
  assert.equal(classify("edit", "error", "Permission denied"), null);
  assert.equal(classify("edit", "completed", "Could not find oldString"), null);
});

test("summary deduplicates cumulative token updates and leaves acceptance unknown", () => {
  const envelope = { schema: 1, run_id: "summary-test", origin: "constructed" };
  const base = { ...envelope, type: "assistant_usage", session_id: "s", message_id: "m" };
  const summary = summarize([
    { ...envelope, type: "observer_started" },
    { ...base, tokens: { input: 0, output: 0 } },
    { ...base, tokens: { input: 12, output: 8 } },
    { ...envelope, type: "observer_stopped", pending_calls: 0 },
  ]);
  assert.equal(summary.latest_message_usage.length, 1);
  assert.equal(summary.latest_message_usage[0].tokens.output, 8);
  assert.equal(summary.verified_task_completion, null);
  assert.deepEqual(summary.origins, ["constructed"]);
});

test("plugin exports one function and remains off unless explicitly enabled", async () => {
  assert.deepEqual(Object.keys(await import("../.opencode/plugins/forge-observer.js")), [
    "ForgeObserver",
  ]);
  const saved = process.env.FORGE_OBSERVE;
  delete process.env.FORGE_OBSERVE;
  try {
    assert.deepEqual(await ForgeObserver({ directory: tmpdir() }), {});
  } finally {
    if (saved === undefined) delete process.env.FORGE_OBSERVE;
    else process.env.FORGE_OBSERVE = saved;
  }
});

test("enabled project plugin writes constructed logs using its actual entry point", async (t) => {
  const directory = await temporaryDirectory(t, "forge-plugin-");
  const saved = [process.env.FORGE_OBSERVE, process.env.FORGE_OBSERVATION_ORIGIN];
  process.env.FORGE_OBSERVE = "1";
  process.env.FORGE_OBSERVATION_ORIGIN = "constructed";
  try {
    const hooks = await ForgeObserver({ directory });
    const input = { sessionID: "plugin-smoke", callID: "1", tool: "bash" };
    const args = { command: "echo constructed" };
    await hooks["tool.execute.before"](input, { args });
    await hooks["tool.execute.after"]({ ...input, args }, { output: "constructed", metadata: {} });
    await hooks.dispose();
    const folder = path.join(directory, ".forge", "observations");
    const files = await readdir(folder);
    assert.equal(files.length, 1);
    const records = (await readFile(path.join(folder, files[0]), "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(records.filter((r) => r.type === "tool_finished").length, 1);
    assert.ok(records.every((r) => r.origin === "constructed"));
  } finally {
    for (const [index, key] of ["FORGE_OBSERVE", "FORGE_OBSERVATION_ORIGIN"].entries()) {
      if (saved[index] === undefined) delete process.env[key];
      else process.env[key] = saved[index];
    }
  }
});
