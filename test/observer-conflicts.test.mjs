import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { summarize } from "../scripts/summarize.mjs";
import { createOpenCodeObserver } from "../src/adapters/opencode.mjs";
import { parseObservationLog } from "../src/observation-log.mjs";
import { createObserver } from "../src/observer.mjs";

const initialContents = "value = 1\n";
const privateText = "private-conflict-payload-must-not-appear-in-warning";
const identity = { sessionID: "session-a", callID: "call-a", tool: "replace_region" };

async function workspace(t) {
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(parent, "forge-conflict-test-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), parent);
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  const filename = path.join(directory, "example.py");
  const logPath = path.join(directory, "observations.jsonl");
  await writeFile(filename, initialContents);
  return { directory, filename, logPath, text: () => readFile(logPath, "utf8") };
}

async function preservedCall(target, method, ...inputs) {
  const saved = structuredClone(inputs);
  await assert.doesNotReject(() => target[method](...inputs));
  assert.deepEqual(inputs, saved, "Observation must preserve native inputs and outputs.");
}

async function assertDisabled(s, target, warnings, prefix, later) {
  assert.equal(warnings.length, 1, "Contradictory evidence must warn once and disable capture.");
  assert.match(warnings[0], /FORGE observer disabled/);
  assert.ok(!warnings[0].includes(privateText), "Warnings must not echo captured payloads.");
  await later();
  await target.dispose();
  await target.dispose();
  assert.equal(warnings.length, 1, "Later callbacks must not issue more warnings.");
  assert.equal(await s.text(), prefix, "Keep only the valid prefix without a fabricated shutdown.");
  assert.equal(await readFile(s.filename, "utf8"), initialContents);
  const records = parseObservationLog(prefix);
  assert.ok(records.every((record) => record.origin === "constructed"));
  const summary = summarize(records);
  assert.equal(summary.observation_integrity.status, "incomplete");
  assert.ok(summary.observation_integrity.issues.includes("missing_observer_stop"));
  assert.equal(summary.verified_task_completion, null);
}

const conflicts = [
  {
    name: "a duplicate pending start names another tool",
    pending: true,
    method: "recordToolStart",
  },
  {
    name: "a terminal names another tool than its pending start",
    pending: true,
    method: "recordToolFinish",
  },
  { name: "another start changes the tool of a finished call", method: "recordToolStart" },
  { name: "another terminal changes the tool of a finished call", method: "recordToolFinish" },
  { name: "completed is followed by error for the same call", first: "completed", next: "error" },
  { name: "error is followed by completed for the same call", first: "error", next: "completed" },
  {
    name: "a late start changes the tool of a terminal-only call",
    terminalOnly: true,
    method: "recordToolStart",
  },
  {
    name: "a terminal-only completed call is followed by error",
    terminalOnly: true,
    first: "completed",
    next: "error",
  },
];

for (const conflict of conflicts) {
  test(`shared observer disables capture when ${conflict.name}`, async (t) => {
    const s = await workspace(t);
    const warnings = [];
    const observer = await createObserver({
      ...s,
      origin: "constructed",
      warn: (message) => warnings.push(message),
    });
    const input = {
      ...identity,
      args: { from: privateText, to: "value = 2" },
      target: { filePath: s.filename },
    };
    if (!conflict.terminalOnly) await preservedCall(observer, "recordToolStart", input);
    if (!conflict.pending) {
      await preservedCall(observer, "recordToolFinish", {
        ...input,
        status: conflict.first ?? "completed",
        text: privateText,
        source: "fixture-first",
      });
    }
    const prefix = await s.text();
    await preservedCall(observer, conflict.method ?? "recordToolFinish", {
      ...input,
      tool: conflict.next ? input.tool : "inspect_source",
      status: conflict.next ?? "completed",
      text: `${privateText}: conflicting terminal`,
      source: "fixture-second",
    });
    await assertDisabled(s, observer, warnings, prefix, async () => {
      const later = { ...input, callID: "later-call" };
      await preservedCall(observer, "recordToolStart", later);
      await preservedCall(observer, "recordToolFinish", { ...later, status: "completed" });
      await observer.recordSessionError({ error: "later error" });
    });
  });
}

function terminal(input, status, text) {
  return {
    event: {
      type: "message.part.updated",
      properties: {
        part: {
          type: "tool",
          ...input,
          state: {
            status,
            input: input.args,
            ...(status === "error" ? { error: text } : { output: text }),
          },
        },
      },
    },
  };
}

for (const eventFirst of [false, true]) {
  test(`OpenCode hook/event status conflict stays passive with ${eventFirst ? "error event" : "completed hook"} first`, async (t) => {
    const s = await workspace(t);
    const warnings = [];
    const hooks = await createOpenCodeObserver({
      ...s,
      origin: "constructed",
      warn: (message) => warnings.push(message),
    });
    const input = {
      ...identity,
      tool: "edit",
      args: { filePath: s.filename, oldString: privateText, newString: "value = 2" },
    };
    await preservedCall(hooks, "tool.execute.before", input, { args: input.args });
    const after = () =>
      preservedCall(hooks, "tool.execute.after", input, { output: "native success" });
    const event = () => preservedCall(hooks, "event", terminal(input, "error", privateText));
    await (eventFirst ? event() : after());
    const prefix = await s.text();
    await (eventFirst ? after() : event());
    await assertDisabled(s, hooks, warnings, prefix, async () => {
      await after();
      await event();
      await preservedCall(
        hooks,
        "tool.execute.before",
        { ...input, callID: "later" },
        { args: {} },
      );
    });
  });
}

test("OpenCode terminal tool mismatch cannot close a pending call under another tool", async (t) => {
  const s = await workspace(t);
  const warnings = [];
  const hooks = await createOpenCodeObserver({
    ...s,
    origin: "constructed",
    warn: (message) => warnings.push(message),
  });
  const input = { ...identity, tool: "read", args: { filePath: s.filename } };
  await preservedCall(hooks, "tool.execute.before", input, { args: input.args });
  const prefix = await s.text();
  await preservedCall(hooks, "event", terminal({ ...input, tool: "edit" }, "error", privateText));
  await assertDisabled(s, hooks, warnings, prefix, async () => {
    await preservedCall(hooks, "tool.execute.after", input, { output: initialContents });
  });
});

test("same-tool/status duplicates retain the first terminal despite changed source and output", async (t) => {
  const s = await workspace(t);
  const warnings = [];
  const observer = await createObserver({
    ...s,
    origin: "constructed",
    warn: (message) => warnings.push(message),
  });
  for (const [index, status] of ["completed", "error"].entries()) {
    const input = { ...identity, callID: `duplicate-${index}`, args: {} };
    await preservedCall(observer, "recordToolStart", input);
    await preservedCall(observer, "recordToolStart", input);
    const first = { ...input, status, text: `first-${status}`, source: "fixture-first" };
    await preservedCall(observer, "recordToolFinish", first);
    const prefix = await s.text();
    await preservedCall(observer, "recordToolStart", input);
    await Promise.all([
      preservedCall(observer, "recordToolFinish", { ...first, text: privateText, source: "other" }),
      preservedCall(observer, "recordToolFinish", { ...first, text: "third", source: "third" }),
    ]);
    assert.equal(await s.text(), prefix);
  }
  await observer.dispose();
  assert.deepEqual(warnings, []);
  const records = parseObservationLog(await s.text());
  assert.equal(records.filter((record) => record.type === "tool_started").length, 2);
  const finished = records.filter((record) => record.type === "tool_finished");
  assert.deepEqual(
    finished.map((record) => record.result.text),
    ["first-completed", "first-error"],
  );
  assert.ok(finished.every((record) => record.source === "fixture-first"));
  assert.equal(await readFile(s.filename, "utf8"), initialContents);
  const summary = summarize(records);
  assert.equal(summary.observation_integrity.status, "closed");
  assert.equal(summary.verified_task_completion, null);
});

test("OpenCode same-status hook and event duplicates retain a single completed call in either order", async (t) => {
  const s = await workspace(t);
  const warnings = [];
  const hooks = await createOpenCodeObserver({
    ...s,
    origin: "constructed",
    warn: (message) => warnings.push(message),
  });
  for (const eventFirst of [false, true]) {
    const input = { ...identity, callID: `duplicate-${eventFirst}`, tool: "bash", args: {} };
    await preservedCall(hooks, "tool.execute.before", input, { args: input.args });
    const after = () =>
      preservedCall(hooks, "tool.execute.after", input, { output: "hook output" });
    const event = () => preservedCall(hooks, "event", terminal(input, "completed", "event output"));
    await (eventFirst ? event() : after());
    const prefix = await s.text();
    await (eventFirst ? after() : event());
    assert.equal(await s.text(), prefix);
  }
  await hooks.dispose();
  assert.deepEqual(warnings, []);
  const records = parseObservationLog(await s.text());
  const finished = records.filter((record) => record.type === "tool_finished");
  assert.deepEqual(
    finished.map((record) => record.source),
    ["after_hook", "terminal_event"],
  );
  assert.deepEqual(
    finished.map((record) => record.result.text),
    ["hook output", "event output"],
  );
  assert.equal(await readFile(s.filename, "utf8"), initialContents);
  const summary = summarize(records);
  assert.equal(summary.observation_integrity.status, "closed");
  assert.equal(summary.verified_task_completion, null);
});

test("new-call retries and identities in another session preserve valid evidence", async (t) => {
  const s = await workspace(t);
  const warnings = [];
  const observer = await createObserver({
    ...s,
    origin: "constructed",
    warn: (message) => warnings.push(message),
  });
  const first = {
    ...identity,
    args: { from: "absent", to: "value = 2" },
    target: { filePath: s.filename },
    status: "error",
    text: "fixture replacement failure",
    candidate: "replacement_failed",
    source: "fixture",
  };
  for (const input of [first, { ...first, callID: "unchanged-retry" }]) {
    await preservedCall(observer, "recordToolStart", input);
    await preservedCall(observer, "recordToolFinish", input);
  }
  await writeFile(s.filename, "value = 9\n");
  const changed = { ...first, callID: "changed-retry" };
  await preservedCall(observer, "recordToolStart", changed);
  await preservedCall(observer, "recordToolFinish", changed);
  const other = { ...first, sessionID: "session-b", tool: "another_tool", status: "completed" };
  await preservedCall(observer, "recordToolStart", other);
  await preservedCall(observer, "recordToolFinish", other);
  await observer.dispose();
  assert.deepEqual(warnings, []);
  assert.equal(await readFile(s.filename, "utf8"), "value = 9\n");
  const records = parseObservationLog(await s.text());
  const finished = records.filter((record) => record.type === "tool_finished");
  assert.equal(finished.length, 4);
  assert.equal(finished[1].previous_failure.same_action, true);
  assert.equal(finished[1].previous_failure.same_version, true);
  assert.equal(finished[2].previous_failure.same_action, true);
  assert.equal(finished[2].previous_failure.same_version, false);
  assert.equal(finished[3].previous_failure, null);
  assert.equal(finished[3].session_id, "session-b");
  assert.equal(finished[3].call_id, first.callID);
  assert.equal(finished[3].status, "completed");
  const summary = summarize(records);
  assert.equal(summary.observation_integrity.status, "closed");
  assert.equal(summary.verified_task_completion, null);
});
