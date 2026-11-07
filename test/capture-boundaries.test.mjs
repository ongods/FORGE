import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { summarize } from "../scripts/summarize.mjs";
import { createObserver } from "../src/observer.mjs";

async function workspace(t) {
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(parent, "forge-capture-test-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), parent);
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  const logPath = path.join(directory, "observations.jsonl");
  const warnings = [];
  const observer = await createObserver({
    directory,
    logPath,
    origin: "constructed",
    warn: (message) => warnings.push(message),
  });
  const records = async () => (await readFile(logPath, "utf8")).trim().split("\n").map(JSON.parse);
  return { observer, records, warnings };
}

for (const length of [16000, 16001]) {
  test(`arguments capture at ${length} code units preserves the full-input hash and native inputs`, async (t) => {
    const s = await workspace(t);
    // The JSON wrapper adds 14 code units; each astral symbol adds two.
    const args = { content: "😀".repeat(7993) + (length === 16001 ? "x" : "") };
    const serialized = JSON.stringify(args);
    assert.equal(serialized.length, length);
    assert.ok(Buffer.byteLength(serialized) > length);
    const input = { sessionID: "s", callID: "1", tool: "fixture", args };
    const terminal = { ...input, status: "completed", text: "native result", source: "fixture" };
    const originalInput = structuredClone(input);
    const originalTerminal = structuredClone(terminal);
    await s.observer.recordToolStart(input);
    await s.observer.recordToolFinish(terminal);
    await s.observer.dispose();
    assert.deepEqual(input, originalInput);
    assert.deepEqual(terminal, originalTerminal);
    assert.deepEqual(s.warnings, []);
    const records = await s.records();
    const captures = records
      .filter((record) => ["tool_started", "tool_finished"].includes(record.type))
      .map((record) => record.arguments);
    assert.equal(captures.length, 2);
    for (const captured of captures) {
      assert.equal(captured.text, serialized.slice(0, 16000));
      assert.equal(captured.text.length, 16000);
      assert.equal(captured.truncated, length > 16000);
      assert.equal(captured.sha256, createHash("sha256").update(serialized).digest("hex"));
      if (length > 16000)
        assert.notEqual(captured.sha256, createHash("sha256").update(captured.text).digest("hex"));
    }
    assert.ok(records.every((record) => record.origin === "constructed"));
    const summary = summarize(records);
    assert.equal(summary.observation_integrity.status, "closed");
    assert.equal(summary.verified_task_completion, null);
  });

  test(`result capture at ${length} code units preserves the full-input hash and native inputs`, async (t) => {
    const s = await workspace(t);
    const text = "😀".repeat(8000) + (length === 16001 ? "x" : "");
    assert.equal(text.length, length);
    assert.ok(Buffer.byteLength(text) > length);
    const input = { sessionID: "s", callID: "1", tool: "fixture", args: { command: "native" } };
    const terminal = { ...input, status: "completed", text, source: "fixture" };
    const originalInput = structuredClone(input);
    const originalTerminal = structuredClone(terminal);
    await s.observer.recordToolStart(input);
    await s.observer.recordToolFinish(terminal);
    await s.observer.dispose();
    assert.deepEqual(input, originalInput);
    assert.deepEqual(terminal, originalTerminal);
    assert.deepEqual(s.warnings, []);
    const records = await s.records();
    const captured = records.find((record) => record.type === "tool_finished").result;
    assert.equal(captured.text, text.slice(0, 16000));
    assert.equal(captured.text.length, 16000);
    assert.equal(captured.truncated, length > 16000);
    assert.equal(captured.sha256, createHash("sha256").update(text).digest("hex"));
    if (length > 16000)
      assert.notEqual(captured.sha256, createHash("sha256").update(captured.text).digest("hex"));
    assert.ok(records.every((record) => record.origin === "constructed"));
    const summary = summarize(records);
    assert.equal(summary.observation_integrity.status, "closed");
    assert.equal(summary.verified_task_completion, null);
  });

  test(`session-error capture at ${length} code units preserves the full-input hash and native inputs`, async (t) => {
    const s = await workspace(t);
    const error = "😀".repeat(8000) + (length === 16001 ? "x" : "");
    assert.equal(error.length, length);
    assert.ok(Buffer.byteLength(error) > length);
    const input = { sessionID: "s", error };
    const original = structuredClone(input);
    await s.observer.recordSessionError(input);
    await s.observer.dispose();
    assert.deepEqual(input, original);
    assert.deepEqual(s.warnings, []);
    const records = await s.records();
    const captured = records.find((record) => record.type === "session_error").error;
    assert.equal(captured.text, error.slice(0, 16000));
    assert.equal(captured.text.length, 16000);
    assert.equal(captured.truncated, length > 16000);
    assert.equal(captured.sha256, createHash("sha256").update(error).digest("hex"));
    if (length > 16000)
      assert.notEqual(captured.sha256, createHash("sha256").update(captured.text).digest("hex"));
    assert.ok(records.every((record) => record.origin === "constructed"));
    const summary = summarize(records);
    assert.equal(summary.observation_integrity.status, "closed");
    assert.equal(summary.verified_task_completion, null);
  });
}
