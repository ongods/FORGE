import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createObserver } from "../src/observer.mjs";
import { summarize } from "../scripts/summarize.mjs";

async function workspace(t) {
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(parent, "forge-boundary-test-"));
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
  return { directory, observer, warnings, records };
}

for (const bytes of [1024 * 1024 - 1, 1024 * 1024, 1024 * 1024 + 1]) {
  test(`Python snapshot byte boundary: ${bytes} bytes`, async (t) => {
    const s = await workspace(t);
    // A multibyte prefix makes the byte boundary distinct from string length.
    const content = Buffer.concat([Buffer.from("\u{1F600}"), Buffer.alloc(bytes - 4, 97)]);
    const filename = path.join(s.directory, "example.py");
    await writeFile(filename, content);
    const input = {
      sessionID: "s",
      callID: "1",
      tool: "inspect_source",
      args: { path: filename },
      target: { filePath: filename },
    };
    await s.observer.recordToolStart(input);
    await s.observer.recordToolFinish({ ...input, status: "completed", source: "fixture" });
    await s.observer.dispose();
    const records = await s.records();
    assert.equal(records[0].limits.max_file_bytes, 1024 * 1024);
    const start = records.find((record) => record.type === "tool_started");
    const finish = records.find((record) => record.type === "tool_finished");
    const expected =
      bytes <= 1024 * 1024
        ? {
            path: "example.py",
            status: "ok",
            bytes,
            sha256: createHash("sha256").update(content).digest("hex"),
          }
        : { path: "example.py", status: "too_large", bytes };
    assert.deepEqual(start.before, expected);
    assert.deepEqual(finish.before, expected);
    assert.deepEqual(finish.after, expected);
    assert.deepEqual(await readFile(filename), content);
    assert.deepEqual(s.warnings, []);
    const summary = summarize(records);
    assert.equal(summary.observation_integrity.status, "closed");
    assert.equal(summary.verified_task_completion, null);
  });
}

test("10,000 distinct starts admit existing finishes and duplicates before overflow disables capture", async (t) => {
  const s = await workspace(t);
  const input = (callID) => ({ sessionID: "s", callID: String(callID), tool: "fixture", args: {} });
  for (let callID = 1; callID <= 10000; callID++) {
    await s.observer.recordToolStart(input(callID));
  }
  await s.observer.recordToolStart(input(1));
  await s.observer.recordToolFinish({ ...input(1), status: "completed", source: "fixture" });
  await s.observer.recordToolFinish({ ...input(1), status: "completed", source: "fixture" });
  await s.observer.recordToolStart(input(1));
  await s.observer.recordToolFinish({ ...input(10000), status: "error", source: "fixture" });
  assert.deepEqual(s.warnings, []);
  await s.observer.recordToolStart(input(10001));
  await s.observer.recordToolStart(input(10002));
  await s.observer.recordToolFinish({ ...input(2), status: "completed", source: "fixture" });
  await s.observer.dispose();
  assert.equal(s.warnings.length, 1);
  assert.match(s.warnings[0], /Observation call limit reached/);
  const records = await s.records();
  assert.equal(records[0].limits.max_calls, 10000);
  assert.ok(!records.some((record) => record.call_id === "10001"));
  const summary = summarize(records);
  assert.equal(summary.tool_calls_started, 10000);
  assert.equal(summary.tool_calls_finished, 2);
  assert.equal(summary.tool_calls_without_terminal_record, 9998);
  assert.equal(summary.observation_integrity.status, "incomplete");
  assert.ok(summary.observation_integrity.issues.includes("missing_observer_stop"));
  assert.equal(summary.verified_task_completion, null);
});

test("terminal-only calls share the 10,000-call cap and duplicate terminal events do not spend it", async (t) => {
  const s = await workspace(t);
  const finish = (callID) => ({
    sessionID: "s",
    callID: String(callID),
    tool: "fixture",
    status: "completed",
    source: "fixture",
  });
  for (let callID = 1; callID <= 10000; callID++) {
    await s.observer.recordToolFinish(finish(callID));
  }
  await s.observer.recordToolFinish(finish(1));
  await s.observer.recordToolStart(finish(1));
  assert.deepEqual(s.warnings, []);
  await s.observer.recordToolFinish(finish(10001));
  await s.observer.dispose();
  assert.equal(s.warnings.length, 1);
  assert.match(s.warnings[0], /Observation call limit reached/);
  const records = await s.records();
  const summary = summarize(records);
  assert.equal(summary.tool_calls_started, 0);
  assert.equal(summary.tool_calls_finished, 10000);
  assert.equal(summary.observation_integrity.tool_calls_without_start_record, 10000);
  assert.equal(summary.observation_integrity.status, "incomplete");
  assert.ok(summary.observation_integrity.issues.includes("missing_observer_stop"));
  assert.equal(summary.verified_task_completion, null);
});

test("missing, deleted-during-read, and recreated files retain unknown version evidence", async (t) => {
  const s = await workspace(t);
  const filename = path.join(s.directory, "example.py");
  const input = (callID) => ({
    sessionID: "s",
    callID,
    tool: "replace_region",
    args: { path: filename, from: "absent", to: "value = 2" },
    target: { filePath: filename },
  });
  const fail = async (callID) => {
    await s.observer.recordToolStart(input(callID));
    await s.observer.recordToolFinish({
      ...input(callID),
      status: "error",
      candidate: "replacement_failed",
      source: "fixture",
    });
  };
  await fail("missing");
  await writeFile(filename, "value = 1\n");
  const read = { ...input("read"), tool: "inspect_source" };
  await s.observer.recordToolStart(read);
  await unlink(filename);
  await s.observer.recordToolFinish({ ...read, status: "completed", source: "fixture", read: {} });
  await fail("deleted");
  await writeFile(filename, "value = 3\n");
  await fail("recreated");
  await fail("unchanged");
  await s.observer.dispose();
  const records = await s.records();
  const failures = records.filter((record) => record.candidate === "replacement_failed");
  assert.equal(failures.length, 4);
  assert.equal(failures[0].before.status, "missing");
  assert.equal(failures[0].after.status, "missing");
  assert.equal(failures[0].previous_failure, null);
  assert.equal(failures[1].before.status, "missing");
  assert.equal(failures[1].previous_failure.same_version, null);
  assert.equal(failures[1].read_evidence.version, null);
  assert.equal(failures[1].read_evidence.matches_before, null);
  assert.equal(failures[2].before.status, "ok");
  assert.equal(failures[2].previous_failure.same_version, null);
  assert.equal(failures[2].read_evidence.matches_before, null);
  assert.equal(failures[3].previous_failure.same_version, true);
  assert.equal(await readFile(filename, "utf8"), "value = 3\n");
  assert.deepEqual(s.warnings, []);
  assert.equal(summarize(records).verified_task_completion, null);
});
