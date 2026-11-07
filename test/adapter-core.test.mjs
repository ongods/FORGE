import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createObserver } from "../src/observer.mjs";
import { createOpenCodeObserver } from "../src/adapters/opencode.mjs";
import { summarize } from "../scripts/summarize.mjs";

async function workspace(t) {
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(parent, "forge-adapter-test-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), parent);
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  const logPath = path.join(directory, "observations.jsonl");
  const records = async () => (await readFile(logPath, "utf8")).trim().split("\n").map(JSON.parse);
  return { directory, logPath, records };
}

test("shared observer accepts adapter-neutral tools, targets, reads and failure evidence", async (t) => {
  const s = await workspace(t);
  const filename = path.join(s.directory, "example.py");
  await writeFile(filename, "value = 1\n");
  const observer = await createObserver({ ...s, origin: "constructed" });
  const target = { filePath: filename };
  const read = {
    sessionID: "fixture-a",
    callID: "read-1",
    tool: "inspect_source",
    args: { path: filename, lines: [1, 1] },
    target,
  };
  await observer.recordToolStart(read);
  await observer.recordToolFinish({
    ...read,
    status: "completed",
    text: "value = 1",
    source: "fixture",
    read: { offset: 1, limit: 1, returnedLines: [1, 1], truncated: false },
  });
  const failed = {
    sessionID: "fixture-a",
    callID: "edit-1",
    tool: "replace_region",
    args: { path: filename, from: "absent", to: "value = 2" },
    target,
    status: "error",
    text: "region not found",
    candidate: "replacement_failed",
    source: "fixture",
  };
  await observer.recordToolStart(failed);
  await Promise.all([observer.recordToolFinish(failed), observer.recordToolFinish(failed)]);
  await writeFile(filename, "value = 3\n");
  const retry = { ...failed, callID: "edit-2" };
  await observer.recordToolStart(retry);
  await observer.recordToolFinish(retry);
  const otherSession = { ...failed, sessionID: "fixture-b" };
  await observer.recordToolStart(otherSession);
  await observer.recordToolFinish(otherSession);
  await observer.dispose();
  const records = await s.records();
  const failures = records.filter((record) => record.candidate);
  assert.equal(failures.length, 3);
  assert.equal(failures[0].tool, "replace_region");
  assert.deepEqual(JSON.parse(failures[0].arguments.text), failed.args);
  assert.equal(failures[0].read_evidence.matches_before, true);
  assert.deepEqual(failures[0].read_evidence.returned_lines, [1, 1]);
  assert.equal(failures[1].previous_failure.same_action, true);
  assert.equal(failures[1].previous_failure.same_version, false);
  assert.equal(failures[1].read_evidence.matches_before, false);
  assert.equal(failures[2].previous_failure, null);
  assert.equal(failures[2].read_evidence, null);
  assert.equal(await readFile(filename, "utf8"), "value = 3\n");
  assert.ok(records.every((record) => record.schema === 1 && record.origin === "constructed"));
  assert.equal(summarize(records).verified_task_completion, null);
});

test("OpenCode adapter preserves parameter, usage and session-error observations", async (t) => {
  const s = await workspace(t);
  const hooks = await createOpenCodeObserver({ ...s, origin: "constructed" });
  const parameters = { temperature: 0.2, topP: 0.9, topK: 30, maxOutputTokens: 100 };
  await hooks["chat.params"](
    { sessionID: "s", model: { id: "fixture-model", providerID: "fixture-provider" } },
    parameters,
  );
  assert.deepEqual(parameters, { temperature: 0.2, topP: 0.9, topK: 30, maxOutputTokens: 100 });
  for (const output of [0, 8]) {
    await hooks.event({
      event: {
        type: "message.updated",
        properties: {
          info: {
            role: "assistant",
            sessionID: "s",
            id: "m",
            modelID: "fixture-model",
            providerID: "fixture-provider",
            tokens: { input: 12, output },
            cost: 0,
          },
        },
      },
    });
  }
  await hooks.event({
    event: { type: "session.error", properties: { sessionID: "s", error: "fixture error" } },
  });
  await hooks.event({ event: { type: "unknown-event" } });
  await hooks.dispose();
  const records = await s.records();
  const model = records.find((record) => record.type === "model_parameters");
  assert.equal(model.model_id, "fixture-model");
  assert.equal(model.provider_id, "fixture-provider");
  assert.equal(model.temperature, 0.2);
  assert.equal(model.top_p, 0.9);
  assert.equal(model.top_k, 30);
  assert.equal(model.max_output_tokens, 100);
  const error = records.find((record) => record.type === "session_error");
  assert.equal(error.error.text, "fixture error");
  assert.equal(error.session_id, "s");
  const summary = summarize(records);
  assert.equal(summary.latest_message_usage.length, 1);
  assert.equal(summary.latest_message_usage[0].tokens.output, 8);
  assert.equal(summary.latest_message_usage[0].provider_id, "fixture-provider");
});

test("shared observer does not invent native read defaults when an adapter lacks them", async (t) => {
  const s = await workspace(t);
  const filename = path.join(s.directory, "example.py");
  await writeFile(filename, "value = 1\n");
  const observer = await createObserver(s);
  const input = {
    sessionID: "fixture",
    callID: "1",
    tool: "inspect_source",
    args: { path: filename },
    target: { filePath: filename },
  };
  await observer.recordToolStart(input);
  await observer.recordToolFinish({ ...input, status: "completed", source: "fixture", read: {} });
  const edit = { ...input, callID: "2", tool: "replace_region" };
  await observer.recordToolStart(edit);
  await observer.recordToolFinish({ ...edit, status: "error", source: "fixture" });
  await observer.dispose();
  const records = await s.records();
  const record = records.find((entry) => entry.type === "tool_finished" && entry.call_id === "2");
  assert.equal(record.read_evidence.requested_offset, null);
  assert.equal(record.read_evidence.requested_limit, null);
  assert.equal(record.read_evidence.returned_lines, null);
});

test("directory-resolution failures disable observation without rejecting agent hooks", async (t) => {
  const s = await workspace(t);
  const warnings = [];
  const hooks = await createOpenCodeObserver({
    directory: path.join(s.directory, "missing"),
    warn: (message) => {
      warnings.push(message);
      throw new Error("warning sink unavailable");
    },
  });
  const input = { tool: "bash", sessionID: "s", callID: "1" };
  await hooks["tool.execute.before"](input, { args: { command: "fixture" } });
  await hooks["tool.execute.after"](input, { output: "ok" });
  await hooks.dispose();
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /FORGE observer disabled/);
});

test("read terminal events retain the requested range when native input is omitted", async (t) => {
  const s = await workspace(t);
  const filename = path.join(s.directory, "example.py");
  await writeFile(filename, "one = 1\ntwo = 2\n");
  const hooks = await createOpenCodeObserver(s);
  const input = { tool: "read", sessionID: "s", callID: "1" };
  await hooks["tool.execute.before"](input, {
    args: { filePath: filename, offset: 2, limit: 1 },
  });
  await hooks.event({
    event: {
      type: "message.part.updated",
      properties: {
        part: { type: "tool", ...input, state: { status: "completed", output: "two = 2" } },
      },
    },
  });
  const edit = { tool: "edit", sessionID: "s", callID: "2" };
  const args = { filePath: filename, oldString: "absent", newString: "three = 3" };
  await hooks["tool.execute.before"](edit, { args });
  await hooks.event({
    event: {
      type: "message.part.updated",
      properties: {
        part: {
          type: "tool",
          ...edit,
          state: { status: "error", error: "Could not find oldString" },
        },
      },
    },
  });
  await hooks.dispose();
  const failure = (await s.records()).find((record) => record.candidate);
  assert.equal(failure.read_evidence.requested_offset, 2);
  assert.equal(failure.read_evidence.requested_limit, 1);
  assert.equal(failure.read_evidence.returned_lines, null);
  assert.equal(failure.read_evidence.matches_before, true);
});

test("adapter mapping failures remain passive and disable further capture", async (t) => {
  const s = await workspace(t);
  const warnings = [];
  const hooks = await createOpenCodeObserver({ ...s, warn: (message) => warnings.push(message) });
  const input = { tool: "bash", sessionID: "s", callID: "1" };
  await hooks["tool.execute.before"](input, { args: { command: "fixture" } });
  await hooks["tool.execute.after"](input, {
    output: "ok",
    metadata: {
      get display() {
        throw new Error("unavailable metadata");
      },
    },
  });
  await hooks["tool.execute.after"](input, { output: "ok" });
  await hooks.dispose();
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /FORGE adapter disabled/);
  const records = await s.records();
  assert.equal(records.filter((record) => record.type === "tool_finished").length, 0);
  const summary = summarize(records);
  assert.equal(summary.observation_integrity.status, "incomplete");
  assert.ok(summary.observation_integrity.issues.includes("missing_observer_stop"));
});

test("concurrent disposal drains accepted work once and ignores later observer records", async (t) => {
  const s = await workspace(t);
  const observer = await createObserver({ ...s, origin: "constructed" });
  const input = { sessionID: "s", callID: "1", tool: "fixture", args: {} };
  const before = observer.recordToolStart(input);
  const after = observer.recordToolFinish({ ...input, status: "completed", source: "fixture" });
  const stopping = observer.dispose();
  const again = observer.dispose();
  assert.equal(stopping, again);
  const late = observer.recordToolStart({ ...input, callID: "2" });
  await Promise.all([before, after, stopping, again, late]);
  await observer.recordToolFinish({ ...input, callID: "2", status: "error", source: "fixture" });
  await observer.recordUsage({ sessionID: "s", messageID: "late", tokens: { output: 100 } });
  await observer.recordModelParameters({ sessionID: "s", modelID: "late-model" });
  await observer.recordSessionError({ sessionID: "s", error: "late-error" });
  const records = await s.records();
  assert.deepEqual(
    records.map((record) => record.type),
    ["observer_started", "tool_started", "tool_finished", "observer_stopped"],
  );
  assert.equal(summarize(records).observation_integrity.status, "closed");
  assert.equal(summarize(records).verified_task_completion, null);
});

test("repeated disposal preserves pending-call evidence without accepting a late terminal event", async (t) => {
  const s = await workspace(t);
  const observer = await createObserver({ ...s, origin: "constructed" });
  const input = { sessionID: "s", callID: "1", tool: "fixture", args: {} };
  await observer.recordToolStart(input);
  await Promise.all([observer.dispose(), observer.dispose(), observer.dispose()]);
  await observer.recordToolFinish({ ...input, status: "completed", source: "fixture" });
  const records = await s.records();
  const stops = records.filter((record) => record.type === "observer_stopped");
  assert.equal(stops.length, 1);
  assert.equal(stops[0].pending_calls, 1);
  const summary = summarize(records);
  assert.equal(summary.tool_calls_without_terminal_record, 1);
  assert.equal(summary.observation_integrity.status, "incomplete");
  assert.ok(summary.observation_integrity.issues.includes("pending_calls_at_stop"));
  assert.ok(!summary.observation_integrity.issues.includes("duplicate_observer_stop"));
});

test("OpenCode hooks skip late payload mapping after disposal and preserve native output", async (t) => {
  const s = await workspace(t);
  const warnings = [];
  const hooks = await createOpenCodeObserver({
    ...s,
    origin: "constructed",
    warn: (message) => warnings.push(message),
  });
  const stopping = hooks.dispose();
  assert.equal(stopping, hooks.dispose());
  await stopping;
  let mapped = 0;
  const input = { tool: "read", sessionID: "s", callID: "late" };
  const output = {
    output: "native result",
    metadata: {
      get display() {
        mapped++;
        throw new Error("late payload must not be inspected");
      },
    },
  };
  await hooks["tool.execute.after"](input, output);
  await hooks["tool.execute.before"](input, { args: {} });
  await hooks.event({
    event: { type: "session.error", properties: { sessionID: "s", error: "late" } },
  });
  await hooks["chat.params"]({ sessionID: "s", model: {} }, {});
  assert.equal(mapped, 0);
  assert.equal(output.output, "native result");
  assert.deepEqual(warnings, []);
  const records = await s.records();
  assert.deepEqual(
    records.map((record) => record.type),
    ["observer_started", "observer_stopped"],
  );
});

test("shutdown write failure stays passive and leaves the saved log explicitly incomplete", async (t) => {
  const s = await workspace(t);
  const warnings = [];
  const observer = await createObserver({
    ...s,
    origin: "constructed",
    warn: (message) => warnings.push(message),
  });
  await observer.recordToolStart({ sessionID: "s", callID: "1", tool: "fixture", args: {} });
  const saved = path.join(s.directory, "saved.jsonl");
  await rename(s.logPath, saved);
  await mkdir(s.logPath);
  await Promise.all([observer.dispose(), observer.dispose()]);
  await observer.recordSessionError({ sessionID: "s", error: "late" });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /FORGE observer disabled/);
  const records = (await readFile(saved, "utf8")).trim().split("\n").map(JSON.parse);
  const summary = summarize(records);
  assert.equal(summary.observation_integrity.status, "incomplete");
  assert.ok(summary.observation_integrity.issues.includes("missing_observer_stop"));
});
