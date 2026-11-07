import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { summarize } from "../scripts/summarize.mjs";
import { createOpenCodeObserver } from "../src/adapters/opencode.mjs";
import { parseObservationLog } from "../src/observation-log.mjs";

const contents = "one = 1\ntwo = 2\nthree = 3\n";

async function workspace(t) {
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(parent, "forge-read-metadata-test-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), parent);
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  const filename = path.join(directory, "example.py");
  const logPath = path.join(directory, "observations.jsonl");
  await writeFile(filename, contents);
  const warnings = [];
  const hooks = await createOpenCodeObserver({
    directory,
    logPath,
    origin: "constructed",
    warn: (message) => warnings.push(message),
  });
  return {
    directory,
    filename,
    hooks,
    warnings,
    records: async () => parseObservationLog(await readFile(logPath, "utf8")),
  };
}

async function preservedCall(hooks, method, ...inputs) {
  const saved = structuredClone(inputs);
  await assert.doesNotReject(() => hooks[method](...inputs));
  assert.deepEqual(inputs, saved, "Observation must preserve native payloads.");
}

async function read(s, options) {
  const input = {
    sessionID: options.sessionID,
    callID: options.callID ?? "read",
    tool: "read",
    args: { filePath: s.filename, offset: 2, limit: 1, ...options.args },
  };
  if (options.start !== false) {
    await preservedCall(s.hooks, "tool.execute.before", input, { args: input.args });
  }
  const terminalInput = { ...input };
  if (options.omitTerminalArgs) delete terminalInput.args;
  if (options.transport === "event") {
    await preservedCall(s.hooks, "event", {
      event: {
        type: "message.part.updated",
        properties: {
          part: {
            type: "tool",
            ...terminalInput,
            state: {
              status: "completed",
              input: terminalInput.args,
              output: contents,
              metadata: options.metadata,
            },
          },
        },
      },
    });
  } else {
    await preservedCall(s.hooks, "tool.execute.after", terminalInput, {
      output: contents,
      metadata: options.metadata,
    });
  }
}

async function failedEdit(s, sessionID, callID = "edit") {
  const input = { sessionID, callID, tool: "edit" };
  const args = { filePath: s.filename, oldString: "absent", newString: "value = 4" };
  await preservedCall(s.hooks, "tool.execute.before", input, { args });
  await preservedCall(s.hooks, "event", {
    event: {
      type: "message.part.updated",
      properties: {
        part: {
          type: "tool",
          ...input,
          state: { status: "error", input: args, error: "Could not find oldString" },
        },
      },
    },
  });
  const records = await s.records();
  return records.find(
    (record) =>
      record.type === "tool_finished" &&
      record.session_id === sessionID &&
      record.call_id === callID,
  ).read_evidence;
}

async function finish(s, expectedReads) {
  await s.hooks.dispose();
  assert.deepEqual(s.warnings, [], "Malformed optional metadata must not disable capture.");
  assert.equal(await readFile(s.filename, "utf8"), contents);
  const records = await s.records();
  assert.ok(records.every((record) => record.origin === "constructed"));
  const reads = records.filter(
    (record) => record.type === "tool_finished" && record.tool === "read",
  );
  assert.equal(reads.length, expectedReads);
  assert.ok(reads.every((record) => record.status === "completed"));
  assert.equal(summarize(records).verified_task_completion, null);
}

test("malformed or absent native read ranges stay unknown for hooks and terminal events", async (t) => {
  const s = await workspace(t);
  const malformed = [
    undefined,
    null,
    {},
    { type: "directory", lineStart: 1, lineEnd: 3 },
    { type: "file" },
    { type: "file", lineStart: 1 },
    { type: "file", lineEnd: 3 },
    ...[
      [null, null],
      [-1, 3],
      [0, 3],
      [1, 0],
      [3, 2],
      [1.5, 3],
      [1, 2.5],
      ["1", 3],
      [1, "3"],
      [false, 3],
      [1, true],
      [NaN, 3],
      [1, Infinity],
      [Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 1],
      [1, Number.MAX_SAFE_INTEGER + 1],
    ].map(([lineStart, lineEnd]) => ({ type: "file", lineStart, lineEnd })),
  ];
  const actual = [];
  for (const [index, display] of malformed.entries()) {
    const sessionID = `malformed-${index}`;
    await read(s, {
      sessionID,
      transport: index % 2 ? "event" : "after",
      metadata: { display },
      args: { offset: 1, limit: 2000 },
    });
    const evidence = await failedEdit(s, sessionID);
    assert.equal(evidence.matches_before, true);
    actual.push(evidence.returned_lines);
  }
  await finish(s, malformed.length);
  assert.deepEqual(
    actual,
    malformed.map(() => null),
  );
});

test("only native booleans establish read truncation status", async (t) => {
  const s = await workspace(t);
  const values = [undefined, null, 0, 1, "false", "true", [], {}, false, true];
  const actual = [];
  for (const [index, truncated] of values.entries()) {
    const sessionID = `truncation-${index}`;
    await read(s, {
      sessionID,
      transport: index % 2 ? "event" : "after",
      metadata: { display: { type: "file", lineStart: 2, lineEnd: 2 }, truncated },
    });
    const evidence = await failedEdit(s, sessionID);
    assert.deepEqual(evidence.returned_lines, [2, 2]);
    actual.push(evidence.truncated);
  }
  await finish(s, values.length);
  assert.deepEqual(
    actual,
    values.map((value) => (typeof value === "boolean" ? value : null)),
  );
});

test("valid partial read ranges and explicit truncation survive both native completion paths", async (t) => {
  const s = await workspace(t);
  const cases = [
    { start: 2, end: 2, truncated: true, transport: "after" },
    { start: 2, end: 3, truncated: false, transport: "event" },
    { start: 1, end: 1, transport: "after" },
    { start: Number.MAX_SAFE_INTEGER, end: Number.MAX_SAFE_INTEGER, transport: "event" },
  ];
  const actual = [];
  for (const [index, value] of cases.entries()) {
    const sessionID = `valid-${index}`;
    await read(s, {
      sessionID,
      transport: value.transport,
      metadata: {
        display: { type: "file", lineStart: value.start, lineEnd: value.end },
        truncated: value.truncated,
      },
    });
    const evidence = await failedEdit(s, sessionID);
    assert.equal(evidence.requested_offset, 2);
    assert.equal(evidence.requested_limit, 1);
    actual.push({ range: evidence.returned_lines, truncated: evidence.truncated });
  }
  await finish(s, cases.length);
  assert.deepEqual(
    actual,
    cases.map((value) => ({ range: [value.start, value.end], truncated: value.truncated ?? null })),
  );
});

test("native offset zero means one while zero limit and empty coverage remain distinct", async (t) => {
  const s = await workspace(t);
  const cases = [
    { transport: "after", start: true },
    { transport: "event", start: true, omitTerminalArgs: true },
    { transport: "after", start: false },
    { transport: "event", start: false },
  ];
  const actual = [];
  for (const [index, value] of cases.entries()) {
    const sessionID = `zero-${index}`;
    await read(s, {
      ...value,
      sessionID,
      args: { offset: 0, limit: 0 },
      metadata: { display: { type: "file", lineStart: 1, lineEnd: 0 }, truncated: false },
    });
    const evidence = await failedEdit(s, sessionID);
    actual.push({
      offset: evidence.requested_offset,
      limit: evidence.requested_limit,
      range: evidence.returned_lines,
      truncated: evidence.truncated,
    });
  }
  await finish(s, cases.length);
  assert.deepEqual(
    actual,
    cases.map(() => ({ offset: 1, limit: 0, range: null, truncated: false })),
  );
});

test("read evidence stays scoped to its session and a later unknown read replaces earlier coverage", async (t) => {
  const s = await workspace(t);
  const valid = { display: { type: "file", lineStart: 2, lineEnd: 2 }, truncated: true };
  await read(s, { sessionID: "session-a", metadata: valid });
  await read(s, { sessionID: "session-b", transport: "event" });
  const firstA = await failedEdit(s, "session-a", "edit-first");
  const firstB = await failedEdit(s, "session-b", "edit-first");
  const absent = await failedEdit(s, "session-c");
  await read(s, {
    sessionID: "session-a",
    callID: "read-later",
    metadata: { display: { type: "file" } },
  });
  const laterA = await failedEdit(s, "session-a", "edit-later");
  await finish(s, 3);
  assert.deepEqual(firstA.returned_lines, [2, 2]);
  assert.equal(firstA.truncated, true);
  assert.equal(firstB.returned_lines, null);
  assert.equal(firstB.truncated, null);
  assert.equal(absent, null);
  assert.equal(laterA.call_id, "read-later");
  assert.equal(laterA.returned_lines, null);
  assert.equal(laterA.truncated, null);
});
