const recordTypes = new Set([
  "observer_started",
  "observer_stopped",
  "tool_started",
  "tool_finished",
  "session_error",
  "assistant_usage",
  "model_parameters",
]);
const hasID = (value) => typeof value === "string" && value.trim().length > 0;

function validateRecord(record, location) {
  const require = (condition, detail) => {
    if (!condition) throw new Error(`Invalid observation at ${location}: ${detail}`);
  };
  require(record !== null &&
    typeof record === "object" &&
    !Array.isArray(record), "expected object");
  require(record.schema === 1, "unsupported or missing schema; expected 1");
  require(hasID(record.run_id), "missing run identity");
  require(["ordinary", "constructed"].includes(record.origin), "invalid observation origin");
  require(recordTypes.has(record.type), "unsupported or missing record type");
  if (
    ["tool_started", "tool_finished", "assistant_usage", "model_parameters"].includes(record.type)
  )
    require(hasID(record.session_id), "missing session identity");
  if (["tool_started", "tool_finished"].includes(record.type)) {
    require(hasID(record.call_id), "missing call identity");
    require(hasID(record.tool), "missing tool name");
  }
  if (record.type === "tool_finished") {
    require(["completed", "error"].includes(record.status), "invalid terminal tool status");
    require(record.before_hook_missing === undefined ||
      typeof record.before_hook_missing === "boolean", "invalid before-hook evidence");
  }
  if (record.type === "assistant_usage")
    require(hasID(record.message_id), "missing message identity");
  if (record.type === "observer_stopped")
    require(Number.isSafeInteger(record.pending_calls) &&
      record.pending_calls >= 0, "invalid pending-call count");
}

function validateIdentity(records) {
  if (!records.length) throw new Error("Expected a nonempty observer log");
  if (new Set(records.map((record) => record.run_id)).size !== 1)
    throw new Error("Expected one observer run; mixed run identities");
  if (new Set(records.map((record) => record.origin)).size !== 1)
    throw new Error("Expected one observation origin; mixed ordinary/constructed records");
  if (
    records[0].type !== "observer_started" ||
    records.filter((record) => record.type === "observer_started").length !== 1
  ) {
    throw new Error("Expected exactly one observer_started record at the beginning");
  }
}

// Validate the supported envelope and summary identifiers, not captured tool text.
// Keep physical line numbers and never echo captured source or secrets in errors.
export function parseObservationLog(text) {
  const records = [];
  for (const [index, line] of text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .entries()) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSON at line ${index + 1}; observation may be incomplete`);
    }
    validateRecord(record, `line ${index + 1}`);
    records.push(record);
  }
  validateIdentity(records);
  return records;
}

export function inspectObservationLog(records) {
  if (!Array.isArray(records)) throw new Error("Expected observation records");
  records.forEach((record, index) => {
    validateRecord(record, `record ${index + 1}`);
  });
  validateIdentity(records);
  const starts = new Set();
  const finishes = new Set();
  const pending = new Set();
  const tools = new Map();
  const issues = new Set();
  let stopped = false;
  for (const record of records) {
    if (stopped) issues.add("records_after_observer_stop");
    const key = JSON.stringify([record.session_id, record.call_id]);
    if (record.type === "tool_started") {
      if (starts.has(key)) issues.add("duplicate_tool_start");
      if (finishes.has(key)) issues.add("tool_start_after_finish");
      if (tools.has(key) && tools.get(key) !== record.tool) issues.add("tool_identity_mismatch");
      tools.set(key, record.tool);
      starts.add(key);
      if (!finishes.has(key)) pending.add(key);
    }
    if (record.type === "tool_finished") {
      if (finishes.has(key)) issues.add("duplicate_tool_finish");
      if (!starts.has(key)) issues.add("tool_finish_without_start");
      if (record.before_hook_missing) issues.add("reported_missing_before_hook");
      if (tools.has(key) && tools.get(key) !== record.tool) issues.add("tool_identity_mismatch");
      tools.set(key, record.tool);
      finishes.add(key);
      pending.delete(key);
    }
    if (record.type === "observer_stopped") {
      if (stopped) issues.add("duplicate_observer_stop");
      if (record.pending_calls > 0) issues.add("pending_calls_at_stop");
      if (record.pending_calls !== pending.size) issues.add("pending_call_count_mismatch");
      stopped = true;
    }
  }
  if (!stopped) issues.add("missing_observer_stop");
  if (pending.size) issues.add("unfinished_tool_calls");
  return {
    run_id: records[0].run_id,
    schema: records[0].schema,
    origin: records[0].origin,
    status: issues.size ? "incomplete" : "closed",
    observer_stopped: stopped,
    tool_capture_observed: starts.size + finishes.size > 0,
    tool_calls_without_start_record: [...finishes].filter((key) => !starts.has(key)).length,
    issues: [...issues],
    note: "Closed means lifecycle and tool records are consistent; it does not prove all runtime events were captured or establish task acceptance.",
  };
}
