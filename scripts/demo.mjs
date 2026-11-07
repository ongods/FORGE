import { mkdir, mkdtemp, writeFile, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createOpenCodeObserver } from "../src/adapters/opencode.mjs";
import { summarize } from "./summarize.mjs";

// Constructed hook replay; does not invoke OpenCode or any model.
await mkdir(".forge/demos", { recursive: true });
const directory = await mkdtemp(path.resolve(".forge/demos/replay-"));
const filename = path.join(directory, "example.py");
const logPath = path.join(directory, "observation.jsonl");
await writeFile(filename, "answer = 1\n");
const hooks = await createOpenCodeObserver({ directory, origin: "constructed", logPath });
let nextCall = 0;
async function replay(tool, args, status, text) {
  const input = { tool, sessionID: "constructed-demo", callID: String(++nextCall) };
  await hooks["tool.execute.before"](input, { args });
  if (status === "completed") {
    await hooks["tool.execute.after"]({ ...input, args }, { output: text, metadata: {} });
  } else {
    await hooks.event({
      event: {
        type: "message.part.updated",
        properties: {
          part: {
            type: "tool",
            ...input,
            state: { status, input: args, error: text },
          },
        },
      },
    });
  }
}
await replay("read", { filePath: filename }, "completed", "1: answer = 1");
const edit = { filePath: filename, oldString: "missing = 0", newString: "answer = 2" };
await replay("edit", edit, "error", "Could not find oldString in the file.");
await replay("edit", edit, "error", "Could not find oldString in the file.");
await writeFile(filename, "answer = 3\n");
await replay("read", { filePath: filename }, "completed", "1: answer = 3");
await replay("edit", edit, "error", "Could not find oldString in the file.");
await replay("bash", { command: "python -m pytest" }, "completed", "1 passed");
// Run a real Python parser, but replay its result through the observer contract.
await writeFile(filename, "def broken(\n");
const parsed = spawnSync(
  "python",
  ["-c", "import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_bytes())", filename],
  {
    encoding: "utf8",
    windowsHide: true,
  },
);
if (parsed.error) throw parsed.error;
if (parsed.status === 0) throw new Error("Constructed invalid Python unexpectedly parsed");
await replay("bash", { command: "python parser (constructed replay)" }, "completed", parsed.stderr);
await hooks.dispose();
const records = (await readFile(logPath, "utf8")).trim().split("\n").map(JSON.parse);
process.stdout.write(
  `Constructed replay only. Log: ${logPath}\n${JSON.stringify(summarize(records), null, 2)}\n`,
);
