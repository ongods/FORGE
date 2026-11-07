# Development task preparation

These operator records and external checks belong outside agent access. They are
preparation artifacts, not a task runner or live recovery results. The example
manifests remain blank templates; concrete records in this directory report their
own readiness and evidence.

## First selected task

Selection recorded before acceptance execution on 2026-11-07 (Asia/Singapore):
prepare only `boltons-separator-454`, the documented separator bug in
[upstream PR #454](https://github.com/mahmoud/boltons/pull/454), at commit
`1d525271754ed7aea7f2347ed16ddbcedb1097a3`. It was selected for an inspectable
upstream repair and standard-library-only setup, not observed agent failures.
This public, easy task can debug setup and checking; it is neither a representative
failure-frequency sample nor held-out research evidence.

The preparation allowance is one task, no agent/model launches, and the same
32-case external check on the starting code and a reference repair, with a
10-second Python-probe timeout per check. This is not an enforced end-to-end task
budget. Run the existing module doctests on both versions.
Stop and record setup/import failures instead of calling them failed repairs.
Additional checks require a supported preparation defect or a documented scope
change. A live batch, repetitions, inference budgets, and stop rules remain unset;
this preparation allowance does not authorize an ordinary agent run.

The [task record](boltons-separator.json) carries the revision, task input, allowed
edits, setup, verifier, and validation evidence. The
[external check](verify-boltons-separator.mjs) exercises `args2sh`, `args2cmd`, and
both explicit wrapper styles. It checks default/custom/multiple/empty separators,
quoting, empty input, single arguments, and empty arguments. It generates strings;
it does not execute shell commands. Exit 0 means those checks passed, 1 means a
behavior mismatch/exception, and 2 means the check could not assess the checkout.
This is a task-specific check, not a complete proof of correctness or integrity.
Missing/contradictory check reports also exit 2, including a candidate module
exiting with code 0 before the checks run. A zero child exit alone cannot pass.
Run the [allowed-change check](check-boltons-separator-changes.mjs) before accepting
the behavior result. It requires the pinned revision, a regular supported target,
only allowed staged/working-tree changes, and no extra untracked/ignored files.
Its exit codes are 0 for accepted scope, 1 for a scope violation, and 2 when scope
could not be assessed. Scope alone does not establish a correct repair or enforce
the agent's access permissions. Git metadata protections still need actual agent
permission checks.

Observed preparation results and artifact hashes are in the
[validation record](boltons-separator-validation.md). Live readiness remains
`not_ready`; no agent/model was run.
The [fresh starting-checkout audit](boltons-start-seed.md) separately checks an
operator-owned checkout without reference-fix objects. It does not verify the
evaluated agent's access permissions or make that checkout live-ready.

## Reproduce preparation

Use a fresh operator-owned directory, with Node >=22, Python 3.13.7 (the validated
version), and Git. No pip install or model is needed for these checks. Download
the public source and reference commit:

```powershell
git clone --depth 1 --branch 26.1.0 --single-branch https://github.com/mahmoud/boltons.git source
git -C source rev-parse HEAD
# Require exactly 1d525271754ed7aea7f2347ed16ddbcedb1097a3; stop on disagreement.
git -C source fetch --depth 2 origin e53353583dc01d688ccb21cdc9c0126ae77fc43f
git -C source diff --output=../reference.patch e53353583dc01d688ccb21cdc9c0126ae77fc43f^ e53353583dc01d688ccb21cdc9c0126ae77fc43f -- boltons/strutils.py
git -C source worktree add --detach ../reference 1d525271754ed7aea7f2347ed16ddbcedb1097a3
git -C reference apply --check ../reference.patch
git -C reference apply ../reference.patch
```

Replace `<FORGE>` below with this repository's absolute path. Run the same verifier
against each checkout and record the actual exit codes and output. Expect the
starting check to fail and the reference check to pass; an expectation is not an
execution result. Run `python -B -m doctest boltons/strutils.py` from each checkout
for the visible check. Record Git status/diff and hashes before and after checks.

```powershell
node <FORGE>/docs/tasks/verify-boltons-separator.mjs ./source
node <FORGE>/docs/tasks/verify-boltons-separator.mjs ./reference
node <FORGE>/docs/tasks/check-boltons-separator-changes.mjs ./source
node <FORGE>/docs/tasks/check-boltons-separator-changes.mjs ./reference
```

The local preparation copies and raw outputs live under ignored
`.forge/preparation/boltons-separator/`. The reference patch changes only
`boltons/strutils.py`; existing upstream tests remain unchanged. The upstream
[BSD license](https://github.com/mahmoud/boltons/blob/1d525271754ed7aea7f2347ed16ddbcedb1097a3/LICENSE)
must accompany any redistributed source. These records link to upstream code;
they do not vendor it.

Both preparation checkouts contain or can access answer objects. **Never give
them to a live agent.** Create a separate fresh task checkout, keep reference
commits, this FORGE repository, hidden checks and outputs inaccessible using the
actual agent's enforced permissions, and verify that separation before a live run.
Those permissions, the compatible model host, and runtime integration remain
unverified. Passing preparation checks does not establish independent live
acceptance, an agent repair, or recovery benefit.
