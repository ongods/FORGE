import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { summarize } from "../scripts/summarize.mjs";
import { createOpenCodeObserver } from "../src/adapters/opencode.mjs";
import { parseObservationLog } from "../src/observation-log.mjs";

const privateText = "private-session-error-marker-not-for-summary";
const script = fileURLToPath(new URL("../scripts/summarize.mjs", import.meta.url));
const jsonl = (records) => `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;

async function workspace(t) {
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(parent, "forge-session-summary-test-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), parent);
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  const logPath = path.join(directory, "observations.jsonl");
  return { directory, logPath, text: () => readFile(logPath, "utf8") };
}

function cli(filename) {
  const result = spawnSync(process.execPath, [script, filename], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.ok(!result.stdout.includes(privateText));
  assert.ok(!result.stderr.includes(privateText));
  return result;
}

function assertSummary(records, expected) {
  const saved = structuredClone(records);
  const summary = summarize(records);
  assert.deepEqual(records, saved, "Summarizing must preserve imported schema-1 records.");
  assert.ok(records.every((record) => record.schema === 1 && record.origin === "constructed"));
  assert.equal(summary.session_error_records, expected);
  assert.equal(summary.tool_errors, 0);
  assert.equal(summary.verified_task_completion, null);
  assert.ok(!JSON.stringify(summary).includes(privateText));
  return summary;
}

test("adapter session errors count each record without guessing duplicates or exposing captured text", async (t) => {
  const s = await workspace(t);
  const warnings = [];
  const hooks = await createOpenCodeObserver({
    ...s,
    origin: "constructed",
    warn: (message) => warnings.push(message),
  });
  const input = { sessionID: "fixture-session", callID: "native-call", tool: "bash" };
  const output = { output: "ordinary native result" };
  await hooks["tool.execute.before"](input, { args: { command: "constructed; never executed" } });
  await hooks["tool.execute.after"](input, output);
  const attributed = {
    event: {
      type: "session.error",
      properties: { sessionID: "fixture-session", error: { message: privateText } },
    },
  };
  const global = {
    event: { type: "session.error", properties: { error: `${privateText}: global` } },
  };
  const savedPayloads = structuredClone({ input, output, attributed, global });
  await hooks.event(attributed);
  await hooks.event(attributed);
  await hooks.event(global);
  await hooks.dispose();
  assert.deepEqual({ input, output, attributed, global }, savedPayloads);
  assert.deepEqual(warnings, []);

  const text = await s.text();
  assert.ok(text.includes(privateText), "Raw capture should retain the observed error evidence.");
  const records = parseObservationLog(text);
  assert.deepEqual(
    records.filter((record) => record.type === "session_error").map((record) => record.session_id),
    ["fixture-session", "fixture-session", null],
  );
  const summary = assertSummary(records, 3);
  assert.equal(summary.tool_calls_finished, 1);
  assert.equal(summary.observation_integrity.status, "closed");
  const result = cli(s.logPath);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), summary);
  assert.equal(await s.text(), text, "The CLI must leave captured records untouched.");
});

test("legacy schema-1 summaries default to zero and retain incomplete and invalid CLI outcomes", async (t) => {
  const s = await workspace(t);
  const envelope = { schema: 1, run_id: "legacy-fixture", origin: "constructed" };
  const start = { ...envelope, type: "observer_started", legacy_extra: "retained" };
  const stop = { ...envelope, type: "observer_stopped", pending_calls: 0 };
  const legacy = [start, stop];
  const text = jsonl(legacy);
  await writeFile(s.logPath, text);
  const parsed = parseObservationLog(text);
  assert.deepEqual(parsed, legacy);
  const summary = assertSummary(parsed, 0);
  assert.equal(summary.observation_integrity.status, "closed");
  const closed = cli(s.logPath);
  assert.equal(closed.status, 0, closed.stderr);
  assert.deepEqual(JSON.parse(closed.stdout), summary);

  const incomplete = [
    start,
    { ...envelope, type: "session_error", session_id: null, error: { text: privateText } },
  ];
  await writeFile(s.logPath, jsonl(incomplete));
  const unfinished = cli(s.logPath);
  assert.equal(unfinished.status, 2, unfinished.stderr);
  const unfinishedSummary = JSON.parse(unfinished.stdout);
  assert.equal(unfinishedSummary.session_error_records, 1);
  assert.equal(unfinishedSummary.observation_integrity.status, "incomplete");
  assert.equal(unfinishedSummary.tool_errors, 0);
  assert.equal(unfinishedSummary.verified_task_completion, null);

  await writeFile(s.logPath, jsonl([start, { ...stop, schema: 2, error: privateText }]));
  const unsupported = cli(s.logPath);
  assert.equal(unsupported.status, 1);
  assert.equal(unsupported.stdout, "");
  assert.match(unsupported.stderr, /unsupported or missing schema/);
  await writeFile(s.logPath, `{"captured":"${privateText}"`);
  const malformed = cli(s.logPath);
  assert.equal(malformed.status, 1);
  assert.equal(malformed.stdout, "");
  assert.match(malformed.stderr, /Invalid JSON/);
});

test("completed bash output printing SyntaxError remains a manual candidate rather than an error count", async (t) => {
  const s = await workspace(t);
  const hooks = await createOpenCodeObserver({ ...s, origin: "constructed" });
  const input = { sessionID: "syntax-print", callID: "printed-example", tool: "bash" };
  const output = { output: `SyntaxError: printed documentation example\n${privateText}` };
  const savedOutput = structuredClone(output);
  await hooks["tool.execute.before"](input, { args: { command: "constructed printed example" } });
  await hooks["tool.execute.after"](input, output);
  await hooks.dispose();
  assert.deepEqual(output, savedOutput);
  const records = parseObservationLog(await s.text());
  const finished = records.find((record) => record.type === "tool_finished");
  assert.equal(finished.status, "completed");
  assert.equal(finished.candidate, "python_syntax_candidate");
  assert.equal(records.filter((record) => record.type === "session_error").length, 0);
  const summary = assertSummary(records, 0);
  assert.equal(summary.candidate_failures.length, 1);
  assert.equal(summary.candidate_failures[0].candidate, "python_syntax_candidate");
  assert.match(summary.note, /manual review/);
  const result = cli(s.logPath);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), summary);
});
