import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { inspectObservationLog, parseObservationLog } from "../src/observation-log.mjs";

export function summarize(records) {
  const integrity = inspectObservationLog(records);
  const calls = new Map();
  const messages = new Map();
  const started = new Set();
  for (const record of records) {
    if (record.type === "tool_started")
      started.add(JSON.stringify([record.session_id, record.call_id]));
    if (record.type === "tool_finished")
      calls.set(JSON.stringify([record.session_id, record.call_id]), record);
    if (record.type === "assistant_usage")
      messages.set(JSON.stringify([record.session_id, record.message_id]), record);
  }
  const finished = [...calls.values()];
  const candidates = finished.filter((record) => record.candidate);
  const origins = [...new Set(records.map((record) => record.origin).filter(Boolean))];
  return {
    observation_integrity: integrity,
    origins,
    tool_calls_started: started.size,
    tool_calls_finished: calls.size,
    tool_calls_without_terminal_record: [...started].filter((key) => !calls.has(key)).length,
    tool_errors: finished.filter((record) => record.status === "error").length,
    session_error_records: records.filter((record) => record.type === "session_error").length,
    candidate_failures: candidates.map((record) => ({
      session_id: record.session_id,
      call_id: record.call_id,
      candidate: record.candidate,
      file: record.before?.path ?? record.after?.path ?? null,
      previous_failure: record.previous_failure,
    })),
    latest_message_usage: [...messages.values()].map((record) => ({
      session_id: record.session_id,
      message_id: record.message_id,
      model_id: record.model_id,
      provider_id: record.provider_id,
      tokens: record.tokens,
    })),
    verified_task_completion: null,
    note: "Candidate counts need manual review. Session-error counts include repeated records. This log does not establish task success or failure frequency.",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const filename = process.argv[2];
  if (!filename) {
    process.stderr.write("Usage: node scripts/summarize.mjs <observation.jsonl>\n");
    process.exitCode = 1;
  } else {
    try {
      const records = parseObservationLog(await readFile(filename, "utf8"));
      const summary = summarize(records);
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      if (summary.observation_integrity.status === "incomplete") process.exitCode = 2;
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}
