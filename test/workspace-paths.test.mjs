import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { summarize } from "../scripts/summarize.mjs";
import { createObserver } from "../src/observer.mjs";

async function workspace(t) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(path.join(parent, "forge-path-test-"));
  const directory = path.join(root, "workspace");
  const sibling = path.join(root, "workspace-sibling");
  const links = [];
  const files = new Map();
  let observer;
  t.after(async () => {
    await observer?.dispose();
    assert.equal(path.dirname(root), parent);
    assert.equal(await realpath(root), root);
    for (const link of links) {
      const relative = path.relative(root, link);
      assert.ok(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`));
      assert.ok(!path.isAbsolute(relative));
      assert.ok((await lstat(link)).isSymbolicLink());
      await unlink(link);
    }
    // Removing a link must leave its target intact before fixture removal.
    for (const [filename, contents] of files)
      assert.equal(await readFile(filename, "utf8"), contents);
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  });
  await mkdir(directory);
  await mkdir(sibling);
  const logPath = path.join(directory, "observations.jsonl");
  const warnings = [];
  observer = await createObserver({
    directory,
    logPath,
    origin: "constructed",
    warn: (message) => warnings.push(message),
  });
  let calls = 0;
  return {
    directory,
    sibling,
    file: async (filename, contents) => {
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, contents);
      files.set(filename, contents);
      return filename;
    },
    link: async (target, filename, type) => {
      try {
        await symlink(target, filename, type);
      } catch (error) {
        if (!["EPERM", "EACCES", "ENOSYS", "ENOTSUP", "EOPNOTSUPP"].includes(error.code))
          throw error;
        t.skip(`${type} link unavailable on ${process.platform}: ${error.code}`);
        return false;
      }
      links.push(filename);
      return true;
    },
    observe: async (filePath) => {
      const input = {
        sessionID: "s",
        callID: String(++calls),
        tool: "inspect_source",
        args: { filePath },
        target: { filePath },
      };
      const terminal = { ...input, status: "completed", text: "native output", source: "fixture" };
      const original = structuredClone(terminal);
      await observer.recordToolStart(input);
      await observer.recordToolFinish(terminal);
      assert.deepEqual(terminal, original);
      assert.deepEqual(input, {
        sessionID: original.sessionID,
        callID: original.callID,
        tool: original.tool,
        args: original.args,
        target: original.target,
      });
    },
    finish: async () => {
      await observer.dispose();
      const records = (await readFile(logPath, "utf8")).trim().split("\n").map(JSON.parse);
      const finished = records.filter((record) => record.type === "tool_finished");
      assert.equal(finished.length, calls);
      assert.ok(finished.every((record) => record.result.text === "native output"));
      assert.ok(records.every((record) => record.origin === "constructed"));
      assert.deepEqual(warnings, []);
      const summary = summarize(records);
      assert.equal(summary.observation_integrity.status, "closed");
      assert.equal(summary.verified_task_completion, null);
      return finished;
    },
  };
}

test("lexical traversal and similarly prefixed sibling files are excluded while workspace Python is hashed", async (t) => {
  const s = await workspace(t);
  const contents = "value = 1\n";
  const outside = await s.file(path.join(s.sibling, "outside.py"), "outside = True\n");
  const inside = await s.file(path.join(s.directory, "inside.py"), contents);
  await s.observe(path.join("..", path.basename(s.sibling), "outside.py"));
  await s.observe(outside);
  await s.observe(inside);
  const records = await s.finish();
  for (const record of records.slice(0, 2)) {
    for (const snapshot of [record.before, record.after]) {
      assert.equal(snapshot.status, "outside_workspace");
      assert.equal(snapshot.sha256, undefined);
    }
  }
  const expected = {
    path: "inside.py",
    status: "ok",
    sha256: createHash("sha256").update(contents).digest("hex"),
    bytes: Buffer.byteLength(contents),
  };
  assert.deepEqual(records[2].before, expected);
  assert.deepEqual(records[2].after, expected);
});

test("unsupported extensions and Python-named directories keep explicit non-hash evidence", async (t) => {
  const s = await workspace(t);
  const unsupported = await s.file(path.join(s.directory, "notes.txt"), "native text\n");
  const folder = path.join(s.directory, "folder.py");
  await s.file(path.join(folder, "sentinel.txt"), "directory contents\n");
  await s.observe(unsupported);
  await s.observe(folder);
  const records = await s.finish();
  for (const snapshot of [records[0].before, records[0].after]) {
    assert.equal(snapshot.status, "unsupported_file");
    assert.equal(snapshot.path, "notes.txt");
    assert.equal(snapshot.sha256, undefined);
  }
  for (const snapshot of [records[1].before, records[1].after]) {
    assert.ok(["not_file", "unavailable"].includes(snapshot.status));
    assert.equal(snapshot.path, "folder.py");
    assert.equal(snapshot.sha256, undefined);
  }
  assert.ok((await stat(folder)).isDirectory());
});

test("workspace directory links to outside files are excluded before hashing", async (t) => {
  const s = await workspace(t);
  await s.file(path.join(s.sibling, "outside.py"), "outside = True\n");
  const alias = path.join(s.directory, "outside-link");
  if (!(await s.link(s.sibling, alias, process.platform === "win32" ? "junction" : "dir"))) return;
  await s.observe(path.join(alias, "outside.py"));
  const [record] = await s.finish();
  for (const snapshot of [record.before, record.after]) {
    assert.equal(snapshot.status, "outside_workspace");
    assert.equal(snapshot.path, path.join("outside-link", "outside.py"));
    assert.equal(snapshot.sha256, undefined);
  }
});

test("workspace directory links to inside files retain their logical path and source hash", async (t) => {
  const s = await workspace(t);
  const contents = "value = 1\n";
  const target = path.join(s.directory, "source");
  await s.file(path.join(target, "inside.py"), contents);
  const alias = path.join(s.directory, "inside-link");
  if (!(await s.link(target, alias, process.platform === "win32" ? "junction" : "dir"))) return;
  await s.observe(path.join(alias, "inside.py"));
  const [record] = await s.finish();
  const expected = {
    path: path.join("inside-link", "inside.py"),
    status: "ok",
    sha256: createHash("sha256").update(contents).digest("hex"),
    bytes: Buffer.byteLength(contents),
  };
  assert.deepEqual(record.before, expected);
  assert.deepEqual(record.after, expected);
});

test("workspace file symlinks to outside files are excluded when link privileges are available", async (t) => {
  const s = await workspace(t);
  const target = await s.file(path.join(s.sibling, "outside.py"), "outside = True\n");
  const alias = path.join(s.directory, "outside.py");
  if (!(await s.link(target, alias, "file"))) return;
  await s.observe(alias);
  const [record] = await s.finish();
  for (const snapshot of [record.before, record.after]) {
    assert.equal(snapshot.status, "outside_workspace");
    assert.equal(snapshot.path, "outside.py");
    assert.equal(snapshot.sha256, undefined);
  }
});
