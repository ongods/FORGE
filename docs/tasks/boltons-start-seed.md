# Boltons separator task: starting seed

This operator procedure prepares a separate copy of the pinned starting revision
for the [task record](boltons-separator.json). It supports the task-preparation
work in the [roadmap](../roadmap.md). The seed remains operator-owned and is
**not live-ready**: agent permissions and evaluator/reference isolation have not
been verified. No agent, model, or recovery policy is run by these commands.

The earlier `.forge/preparation/boltons-separator/source` checkout fetched the
answer commit while creating its reference worktree. That repository and its
reference worktree are validation-only and must never become live agent
checkouts. A clean working tree does not remove answer objects from Git.

Use a new direct upstream clone for the seed rather than copying either
preparation worktree. Do not fetch the reference commit into this seed. A failed
local clone reporting dubious ownership is a setup failure; it does not justify
changing global Git trust settings. The direct public clone keeps this procedure
independent of that local repository's ownership and object database.

## Observed seed audit

The local audit at `2026-11-07T03:47:17.587Z` inspected
`.forge/task-seeds/boltons-separator-start` on Windows x64 with Node 22.14.0.
Its raw commands, outputs, exit codes, and timestamps are retained in ignored
`.forge/task-seeds/boltons-separator-start-audit.json`.

| Check | Observed result |
| --- | --- |
| HEAD and history | PASS: shallow repository; the only reachable commit and only local commit object is `1d525271754ed7aea7f2347ed16ddbcedb1097a3` |
| Full object inventory | PASS: 124 objects inspected; lookup of answer commit `e53353583dc01d688ccb21cdc9c0126ae77fc43f` exited 128 as expected |
| Object storage and origin | PASS: separate `.git` directory, no `objects/info/alternates`; origin is `https://github.com/mahmoud/boltons.git` |
| Allowed-change scope | PASS: exit 0; no changed, untracked, or ignored paths |
| Starting behavior | FAIL (expected): exit 1; 20 of the same 32 cases fail for ignored separators |
| Visible module doctests | PASS: exit 0 |
| Working-tree status | PASS: clean before and after the checks |
| Agent access isolation | NOT RUN; verification remains false |

The inspected `boltons/strutils.py` SHA-256 was
`abe1375a79a6072b14eed16a4232e9b42cd4986b6ebc9c4d8864842372f61d0a`.
This records seed preparation, with verified task completion still `null`.

## Create and inspect a fresh seed

Run from the FORGE repository root in PowerShell, with Git, Node >=22, and Python
on PATH. The destination must not already exist; preserve any existing seed and
its evidence. The commands below describe reproduction; the audit above records
the completed local inspection separately.

```powershell
$forgeRoot = (Get-Location).Path
$seedRoot = Join-Path $forgeRoot ".forge/task-seeds/boltons-separator-start"
$startingRevision = "1d525271754ed7aea7f2347ed16ddbcedb1097a3"
if (Test-Path -LiteralPath $seedRoot) { throw "Choose a fresh seed destination." }
git clone --depth 1 --branch 26.1.0 --single-branch https://github.com/mahmoud/boltons.git $seedRoot
if ($LASTEXITCODE -ne 0) { throw "Seed clone failed." }
$seedRevision = git -C $seedRoot rev-parse --verify HEAD
if ($LASTEXITCODE -ne 0 -or $seedRevision -ne $startingRevision) {
  throw "Seed revision does not match the pinned starting commit."
}
git -C $seedRoot rev-parse --is-shallow-repository
git -C $seedRoot rev-list --all --count
git -C $seedRoot show-ref
git -C $seedRoot status --porcelain=v1 --untracked-files=all
```

Require the exact commit above; the tag name alone is insufficient. Expect a
shallow repository, one reachable commit, refs resolving to the pinned commit or
its annotated tag, and no working-tree changes. Record each command's exit code
and output; stop on a setup error or an unexpected revision/history result.

Inspect all available objects as well as reachable history. An answer object can
be present without a branch pointing to it. This command includes loose and packed
objects, including unreachable objects; retain the full inventory in operator
evidence and inspect every reported commit object.

```powershell
git -C $seedRoot cat-file --batch-all-objects '--batch-check=%(objectname) %(objecttype)'
git -C $seedRoot cat-file -e 'e53353583dc01d688ccb21cdc9c0126ae77fc43f^{commit}'
Test-Path -LiteralPath (Join-Path $seedRoot ".git/objects/info/alternates")
```

Require the pinned starting commit to be the only commit in the object inventory.
The known answer lookup should fail because that commit is unavailable; distinguish
this expected lookup failure from an unreadable repository or failed inventory.
The alternates path should be absent, so the seed does not borrow objects from a
reference repository. Retain inventory, refs, shallow-history results, and failure
diagnostics rather than reporting only a clean Git status.

## Check scope and starting behavior

The [allowed-change checker](check-boltons-separator-changes.mjs) and
[behavior verifier](verify-boltons-separator.mjs) remain outside the seed. Run them
as the operator. The behavior verifier imports the selected source file directly
using Python `-I -B`; no dependency installation or model is needed.

```powershell
node (Join-Path $forgeRoot "docs/tasks/check-boltons-separator-changes.mjs") $seedRoot
node (Join-Path $forgeRoot "docs/tasks/verify-boltons-separator.mjs") $seedRoot
Push-Location -LiteralPath $seedRoot
try {
  python -B -m doctest boltons/strutils.py
} finally {
  Pop-Location
}
git -C $seedRoot status --porcelain=v1 --untracked-files=all
```

Capture each result separately before invoking the next command. Expect scope
exit 0 with no changed, untracked, or ignored paths; behavior exit 1 with 20 of
32 cases failing for ignored custom separators; and visible doctests exit 0.
Behavior exit 2 is unassessed and must not be counted as the intended bug.
The post-check tree should remain clean. For every fresh reproduction, record
actual observations rather than copying the earlier seed's results.

Record raw commands, outputs, exit codes, timestamps, and artifact hashes in
`.forge/task-seeds/boltons-separator-start-audit.json`. This ignored local artifact
is the seed-audit location; its presence alone does not prove that every
required check ran or passed. The earlier
[preparation record](boltons-separator-validation.md) concerns different worktrees
and cannot stand in for the seed's own audit.

## Remaining live gate

An audited initial object inventory establishes only what was inspected at that
time. It does not prevent a later fetch, prove that every source blob lacks answer
information, authenticate Git metadata, or enforce agent access restrictions.
Before any live task, enforce and test permissions that keep FORGE task records,
verifier scripts, outputs, and reference worktrees inaccessible to the evaluated
agent; protect repository metadata and constrain access to additional answer
objects. Recheck the actual task checkout immediately before use.

The existing agent still owns its tools, conversation, model connection, and
native safeguards. A compatible inference host, recorded agent/model settings,
runtime integration evidence, and an approved study batch remain separate work.
This seed procedure establishes no live task outcome or recovery benefit.
