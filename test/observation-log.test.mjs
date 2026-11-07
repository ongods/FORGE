import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { inspectObservationLog, parseObservationLog } from "../src/observation-log.mjs";
import { createObserver } from "../src/observer.mjs";
import { summarize } from "../scripts/summarize.mjs";

const envelope = { schema: 1, run_id: "fixture-run", origin: "constructed" };
const record = (type, fields = {}) => ({ ...envelope, type, ...fields });
const start = record("observer_started");
const stop = record("observer_stopped", { pending_calls: 0 });
const toolStart = record("tool_started", { session_id: "s", call_id: "1", tool: "fixture" });
const toolFinish = record("tool_finished", {
  ...toolStart,
  type: "tool_finished",
  status: "completed",
});
const jsonl = (records) => `${records.map((entry) => JSON.stringify(entry)).join("\n")}\n`;

async function workspace(t) {
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(parent, "forge-log-test-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), parent);
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  return directory;
}

test("schema-1 logs keep original data and report closed records without claiming acceptance", () => {
  const usage = record("assistant_usage", { session_id: "s", message_id: "m" });
  const records = [
    { ...start, opencode_version: null, extra: "legacy data" },
    toolStart,
    { ...toolFinish, result: { text: "All tests passed. Task solved." } },
    { ...usage, tokens: { input: 0, output: 0 } },
    { ...usage, tokens: { input: 12, output: 8 } },
    stop,
  ];
  const parsed = parseObservationLog(`\uFEFF${jsonl(records).replaceAll("\n", "\r\n")}`);
  assert.deepEqual(parsed, records);
  const summary = summarize(parsed);
  assert.equal(summary.observation_integrity.status, "closed");
  assert.equal(summary.observation_integrity.tool_capture_observed, true);
  assert.deepEqual(summary.observation_integrity.issues, []);
  assert.equal(summary.tool_calls_finished, 1);
  assert.deepEqual(summary.latest_message_usage[0].tokens, { input: 12, output: 8 });
  assert.equal(summary.verified_task_completion, null);
});

test("import rejects missing identities, unsupported schemas and mixed origins before counting", () => {
  const cases = [
    [],
    [null],
    [[]],
    [{ type: "observer_started" }],
    [{ ...start, schema: 2 }],
    [{ ...start, run_id: " " }],
    [{ ...start, origin: "unknown" }],
    [start, { ...stop, run_id: "other-run" }],
    [start, { ...stop, origin: "ordinary" }],
    [start, start, stop],
    [toolStart, start, stop],
    [start, { ...toolStart, session_id: null }, stop],
    [start, { ...toolStart, call_id: "" }, stop],
    [start, { ...toolFinish, status: "running" }, stop],
    [start, record("assistant_usage", { session_id: "s" }), stop],
    [start, { ...stop, pending_calls: -1 }],
    [start, record("unrecognized-event"), stop],
  ];
  for (const entries of cases) {
    assert.throws(() => parseObservationLog(jsonl(entries)), Error, JSON.stringify(entries));
    assert.throws(() => summarize(entries), Error, JSON.stringify(entries));
  }
});

test("parse diagnostics retain physical line numbers and do not echo captured text", () => {
  const secret = "private-source-marker";
  assert.throws(
    () => parseObservationLog(`${JSON.stringify(start)}\n\n\n{"captured":"${secret}"`),
    (error) => /Invalid JSON at line 4/.test(error.message) && !error.message.includes(secret),
  );
  assert.throws(
    () => parseObservationLog(`${JSON.stringify(start)}\n\n${JSON.stringify({ secret })}\n`),
    (error) => /line 3/.test(error.message) && !error.message.includes(secret),
  );
});

test("missing shutdown and missing tool evidence are incomplete while available counts remain visible", () => {
  const withoutStop = summarize([start, toolStart, toolFinish]);
  assert.equal(withoutStop.observation_integrity.status, "incomplete");
  assert.deepEqual(withoutStop.observation_integrity.issues, ["missing_observer_stop"]);
  assert.equal(withoutStop.tool_calls_finished, 1);
  const withoutStart = summarize([start, { ...toolFinish, before_hook_missing: true }, stop]);
  assert.equal(withoutStart.observation_integrity.tool_calls_without_start_record, 1);
  assert.ok(withoutStart.observation_integrity.issues.includes("tool_finish_without_start"));
  const withoutFinish = summarize([start, toolStart, { ...stop, pending_calls: 1 }]);
  assert.equal(withoutFinish.tool_calls_without_terminal_record, 1);
  assert.ok(withoutFinish.observation_integrity.issues.includes("pending_calls_at_stop"));
  assert.ok(withoutFinish.observation_integrity.issues.includes("unfinished_tool_calls"));
  assert.equal(withoutFinish.verified_task_completion, null);
});

test("duplicate and reordered records cannot masquerade as a consistent closed log", () => {
  const fixtures = [
    [[start, toolStart, toolStart, toolFinish, stop], "duplicate_tool_start"],
    [[start, toolStart, toolFinish, toolFinish, stop], "duplicate_tool_finish"],
    [[start, toolFinish, toolStart, stop], "tool_start_after_finish"],
    [[start, stop, stop], "duplicate_observer_stop"],
    [[start, stop, toolStart, toolFinish], "records_after_observer_stop"],
    [[start, toolStart, toolFinish, { ...stop, pending_calls: 1 }], "pending_call_count_mismatch"],
    [[start, toolStart, { ...toolFinish, tool: "other-tool" }, stop], "tool_identity_mismatch"],
  ];
  for (const [records, issue] of fixtures) {
    const summary = summarize(records);
    assert.equal(summary.observation_integrity.status, "incomplete", issue);
    assert.ok(summary.observation_integrity.issues.includes(issue), issue);
    assert.ok(summary.tool_calls_finished <= 1);
  }
});

test("reused call IDs in distinct sessions do not hide an unfinished call", () => {
  const other = { ...toolStart, session_id: "other-session" };
  const summary = summarize([start, toolStart, other, toolFinish, { ...stop, pending_calls: 1 }]);
  assert.equal(summary.tool_calls_started, 2);
  assert.equal(summary.tool_calls_finished, 1);
  assert.equal(summary.tool_calls_without_terminal_record, 1);
  assert.equal(summary.observation_integrity.status, "incomplete");
});

test("initialization-only logs do not establish that tool capture worked", () => {
  const integrity = inspectObservationLog([start, stop]);
  assert.equal(integrity.status, "closed");
  assert.equal(integrity.tool_capture_observed, false);
});

test("a real observer shutdown with pending work remains an incomplete measurement", async (t) => {
  const directory = await workspace(t);
  const logPath = path.join(directory, "pending.jsonl");
  const observer = await createObserver({ directory, logPath, origin: "constructed" });
  await observer.recordToolStart({ sessionID: "s", callID: "1", tool: "fixture", args: {} });
  await observer.dispose();
  const summary = summarize(parseObservationLog(await readFile(logPath, "utf8")));
  assert.equal(summary.observation_integrity.status, "incomplete");
  assert.ok(summary.observation_integrity.issues.includes("pending_calls_at_stop"));
  assert.equal(summary.observation_integrity.observer_stopped, true);
});

test("CLI distinguishes closed, incomplete, invalid and absent logs", async (t) => {
  const directory = await workspace(t);
  const filename = path.join(directory, "observations.jsonl");
  const script = fileURLToPath(new URL("../scripts/summarize.mjs", import.meta.url));
  const run = (...args) => {
    const result = spawnSync(process.execPath, [script, ...args], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10000,
    });
    assert.ifError(result.error);
    return result;
  };
  await writeFile(filename, jsonl([start, toolStart, toolFinish, stop]));
  const closed = run(filename);
  assert.equal(closed.status, 0, closed.stderr);
  assert.equal(JSON.parse(closed.stdout).observation_integrity.status, "closed");
  await writeFile(filename, jsonl([start, toolStart]));
  const incomplete = run(filename);
  assert.equal(incomplete.status, 2, incomplete.stderr);
  assert.equal(JSON.parse(incomplete.stdout).observation_integrity.status, "incomplete");
  await writeFile(filename, '{"captured":"private-source-marker"');
  const invalid = run(filename);
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, "");
  assert.match(invalid.stderr, /Invalid JSON at line 1/);
  assert.ok(!invalid.stderr.includes("private-source-marker"));
  const absent = run(path.join(directory, "missing.jsonl"));
  assert.equal(absent.status, 1);
  assert.equal(absent.stdout, "");
  const noArgument = run();
  assert.equal(noArgument.status, 1);
  assert.match(noArgument.stderr, /Usage:/);
});
