// Task-specific preparation check; keep outside any agent-accessible checkout.
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

const checkout = process.argv[2];
if (!checkout) {
  process.stderr.write("Usage: node verify-boltons-separator.mjs <checkout>\n");
  process.exit(2);
}
const filename = path.resolve(checkout, "boltons", "strutils.py");
try {
  if (!statSync(filename).isFile()) throw new Error("not a file");
} catch {
  process.stderr.write("Cannot read the selected checkout's boltons/strutils.py\n");
  process.exit(2);
}

const cases = [];
for (const style of ["sh", "cmd"]) {
  const quoted = style === "sh" ? "'a a'" : '"a a"';
  const empty = style === "sh" ? "''" : '""';
  const examples = [
    { args: ["aa", "bb"], kwargs: {}, expected: "aa bb", label: "default" },
    { args: ["aa", "bb"], kwargs: { sep: "|" }, expected: "aa|bb", label: "custom" },
    { args: ["aa", "bb"], kwargs: { sep: " :: " }, expected: "aa :: bb", label: "multi" },
    { args: ["aa", "bb"], kwargs: { sep: "" }, expected: "aabb", label: "empty separator" },
    { args: ["a a", "bb"], kwargs: { sep: "|" }, expected: `${quoted}|bb`, label: "quoted" },
    { args: [], kwargs: { sep: "|" }, expected: "", label: "no arguments" },
    { args: ["aa"], kwargs: { sep: "|" }, expected: "aa", label: "one argument" },
    { args: ["", "bb"], kwargs: { sep: "|" }, expected: `${empty}|bb`, label: "empty argument" },
  ];
  for (const example of examples) {
    cases.push({ ...example, function: `args2${style}`, label: `args2${style}: ${example.label}` });
    cases.push({
      ...example,
      function: "escape_shell_args",
      kwargs: { ...example.kwargs, style },
      label: `escape_shell_args(${style}): ${example.label}`,
    });
  }
}

// Import the exact file directly: no installed package, task __init__, or PYTHONPATH.
// -I ignores Python environment customization; -B leaves the checkout unchanged.
const probe = String.raw`
import importlib.util, json, sys
try:
    spec = importlib.util.spec_from_file_location("task_strutils", sys.argv[1])
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
except Exception as error:
    print(json.dumps({"status": "unassessed", "error_type": type(error).__name__}))
    sys.exit(2)
cases = json.loads(sys.argv[2])
failures = []
for case in cases:
    try:
        actual = getattr(module, case["function"])(case["args"], **case["kwargs"])
        if actual != case["expected"]:
            failures.append({"case": case["label"], "actual": repr(actual), "expected": case["expected"]})
    except Exception as error:
        failures.append({"case": case["label"], "error_type": type(error).__name__})
print(json.dumps({"status": "fail" if failures else "pass", "checks": len(cases), "failed_checks": len(failures), "failures": failures}))
sys.exit(1 if failures else 0)
`;
const result = spawnSync("python", ["-I", "-B", "-c", probe, filename, JSON.stringify(cases)], {
  encoding: "utf8",
  timeout: 10000,
  maxBuffer: 1024 * 1024,
  windowsHide: true,
});
if (result.error || result.signal || result.status === null) {
  process.stderr.write("Task check could not finish; record an unassessed outcome.\n");
  process.exit(2);
}
process.stderr.write(result.stderr);
// A candidate module can exit during import. Exit 0 alone is not a completed check.
let report;
try {
  report = JSON.parse(result.stdout);
  const valid =
    (result.status === 2 &&
      report.status === "unassessed" &&
      typeof report.error_type === "string") ||
    ([0, 1].includes(result.status) &&
      report.status === (result.status === 0 ? "pass" : "fail") &&
      report.checks === cases.length &&
      Array.isArray(report.failures) &&
      report.failed_checks === report.failures.length &&
      report.failed_checks <= cases.length &&
      (result.status === 0 ? report.failed_checks === 0 : report.failed_checks > 0));
  if (!valid) throw new Error("Incomplete check report");
} catch {
  process.stderr.write("Task check produced no consistent result; record an unassessed outcome.\n");
  process.exit(2);
}
process.stdout.write(`${JSON.stringify(report)}\n`);
process.exitCode = result.status;
