import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { summarize } from "../scripts/summarize.mjs";
import { parseObservationLog } from "../src/observation-log.mjs";
import { createObserver } from "../src/observer.mjs";

const privateText = "private-contract-payload-must-not-appear-in-warning";
const validTool = { sessionID: "session-a", callID: "call-a", tool: "fixture_tool", args: {} };
const invalidIDs = [
  { label: "absent", absent: true },
  { label: "empty", value: "" },
  { label: "whitespace", value: " \t\n" },
  { label: "null", value: null },
  { label: "number", value: 7 },
  { label: "object", value: { payload: privateText } },
];

async function workspace(t) {
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(parent, "forge-contract-test-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), parent);
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  const logPath = path.join(directory, "observations.jsonl");
  return { directory, logPath, text: () => readFile(logPath, "utf8") };
}

function withInvalidID(input, field, invalid) {
  const value = { ...input };
  if (invalid.absent) delete value[field];
  else value[field] = invalid.value;
  return value;
}

async function assertContained(t, method, input, label, withPrefix = true) {
  const s = await workspace(t);
  const warnings = [];
  const observer = await createObserver({
    ...s,
    origin: "constructed",
    warn: (message) => warnings.push(message),
  });
  if (withPrefix) {
    await observer.recordToolStart(validTool);
    await observer.recordToolFinish({ ...validTool, status: "completed", text: "native output" });
  }
  const prefix = await s.text();
  const savedInput = structuredClone(input);
  await assert.doesNotReject(() => observer[method](input), label);
  assert.deepEqual(input, savedInput, `${label}: observation must not modify native input`);
  assert.equal(warnings.length, 1, `${label}: invalid input must disable capture with one warning`);
  assert.match(warnings[0], /FORGE observer disabled/, label);
  assert.ok(!warnings[0].includes(privateText), `${label}: warning must not echo payload`);

  const later = { ...validTool, callID: "later-call" };
  await observer.recordToolStart(later);
  await observer.recordToolFinish({ ...later, status: "completed", text: "later output" });
  await observer.recordUsage({ sessionID: "later", messageID: "later" });
  await observer.recordModelParameters({ sessionID: "later" });
  await observer.recordSessionError({ error: "later error" });
  await observer.dispose();
  await observer.dispose();
  assert.equal(warnings.length, 1, `${label}: later callbacks must not produce more warnings`);
  const text = await s.text();
  assert.equal(text, prefix, `${label}: retain only the valid prefix without fabricated shutdown`);
  const records = parseObservationLog(text);
  const summary = summarize(records);
  assert.equal(summary.observation_integrity.status, "incomplete", label);
  assert.ok(summary.observation_integrity.issues.includes("missing_observer_stop"), label);
  assert.equal(summary.verified_task_completion, null, label);
}

test("invalid tool-start identities remain passive and preserve a readable incomplete prefix", async (t) => {
  const input = { ...validTool, args: { payload: privateText } };
  for (const field of ["sessionID", "callID", "tool"]) {
    for (const invalid of invalidIDs) {
      await assertContained(
        t,
        "recordToolStart",
        withInvalidID(input, field, invalid),
        `tool start ${field}: ${invalid.label}`,
        !(field === "sessionID" && invalid.absent),
      );
    }
  }
});

test("invalid terminal identities and statuses disable capture before writing unusable records", async (t) => {
  const input = { ...validTool, callID: "invalid-finish", status: "completed", text: privateText };
  for (const field of ["sessionID", "callID", "tool"]) {
    for (const invalid of invalidIDs) {
      await assertContained(
        t,
        "recordToolFinish",
        withInvalidID(input, field, invalid),
        `tool finish ${field}: ${invalid.label}`,
        !(field === "sessionID" && invalid.absent),
      );
    }
  }
  for (const status of [undefined, null, "", "failed", "running", 1, { payload: privateText }]) {
    await assertContained(
      t,
      "recordToolFinish",
      { ...input, status },
      `tool finish status: ${typeof status === "string" ? status : typeof status}`,
    );
  }
});

test("invalid usage identities cannot corrupt an otherwise readable observation log", async (t) => {
  const input = { sessionID: "usage-session", messageID: "usage-message", tokens: null };
  for (const field of ["sessionID", "messageID"]) {
    for (const invalid of invalidIDs) {
      await assertContained(
        t,
        "recordUsage",
        withInvalidID(input, field, invalid),
        `usage ${field}: ${invalid.label}`,
        !(field === "sessionID" && invalid.absent),
      );
    }
  }
});

test("invalid parameter session identities disable capture without inventing a session", async (t) => {
  const input = { sessionID: "parameter-session", modelID: privateText };
  for (const invalid of invalidIDs) {
    await assertContained(
      t,
      "recordModelParameters",
      withInvalidID(input, "sessionID", invalid),
      `model parameters sessionID: ${invalid.label}`,
      !invalid.absent,
    );
  }
});

test("valid identities across sessions and nullable optional fields preserve closed observations", async (t) => {
  const s = await workspace(t);
  const warnings = [];
  const observer = await createObserver({
    ...s,
    origin: "constructed",
    warn: (message) => warnings.push(message),
  });
  for (const [sessionID, status] of [
    ["session-a", "completed"],
    ["session-b", "error"],
  ]) {
    const input = { sessionID, callID: "same-call", tool: "same-tool", args: {} };
    await observer.recordToolStart(input);
    await observer.recordToolFinish({ ...input, status, text: "native result" });
    await observer.recordUsage({
      sessionID,
      messageID: "same-message",
      modelID: null,
      providerID: null,
      tokens: null,
      cost: null,
    });
    await observer.recordModelParameters({ sessionID, modelID: null, providerID: null });
  }
  // Session errors may be global; their session identity is intentionally optional.
  await observer.recordSessionError({ error: "fixture global error" });
  await observer.dispose();
  assert.deepEqual(warnings, []);
  const records = parseObservationLog(await s.text());
  assert.deepEqual(
    records.filter((record) => record.type === "tool_finished").map((record) => record.status),
    ["completed", "error"],
  );
  for (const record of records.filter((record) => record.type === "assistant_usage")) {
    assert.equal(record.model_id, null);
    assert.equal(record.provider_id, null);
    assert.equal(record.tokens, null);
    assert.equal(record.cost, null);
  }
  assert.equal(records.filter((record) => record.type === "model_parameters").length, 2);
  assert.equal(records.find((record) => record.type === "session_error").session_id, null);
  const summary = summarize(records);
  assert.equal(summary.latest_message_usage.length, 2);
  assert.equal(summary.observation_integrity.status, "closed");
  assert.equal(summary.verified_task_completion, null);
});
