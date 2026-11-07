# Boltons separator task: preparation evidence

Recorded 2026-11-07 (Asia/Singapore); final raw preparation capture
`2026-11-06T16:55:42.971Z`. Scope: one public development task, selected before its
acceptance execution. No agent, model, recovery policy, or ordinary task batch ran.
This record does not establish failure frequency or recovery benefit.

Repository: [mahmoud/boltons](https://github.com/mahmoud/boltons), starting revision
`1d525271754ed7aea7f2347ed16ddbcedb1097a3` (26.1.0), verified from the checkout.
The tag has a distinct annotated-tag object; the revision here is the actual
commit. The [task record](boltons-separator.json) describes the
[upstream separator bug](https://github.com/mahmoud/boltons/pull/454).
The reference worktree uses that same starting revision plus only the
`boltons/strutils.py` patch from upstream commit
`e53353583dc01d688ccb21cdc9c0126ae77fc43f`. No unrelated later changes or upstream
test edits were applied.

Environment: Windows x64, Node 22.14.0, Python 3.13.7, Git
2.47.1.windows.2. No pip install was needed. The verifier imports the selected file
directly with Python `-I -B`, rather than an installed package. The original
source checkout remained clean after preparation checks.

| Check | Observed result | Meaning |
| --- | --- | --- |
| Starting revision, 32 behavior cases | FAIL (expected), exit 1; 20 mismatches | Reproduces ignored custom separators; this is not a setup failure |
| Starting revision, visible module doctests | PASS, exit 0 | Existing examples do not expose this bug |
| Reference patch, same 32 behavior cases | PASS, exit 0; 0 mismatches | This check distinguishes the upstream repair from the starting behavior |
| Reference patch, same visible doctests | PASS, exit 0 | Existing examples continue to pass |
| Allowed-change scope on source/reference | PASS, exit 0 for each | Source is unchanged; reference changes only the allowed file |
| Controlled allowed source edit | PASS, exit 0 | The scope check permits an edit to the allowed file |
| Controlled forbidden tracked edit | Rejected, exit 1 | Outside-file working-tree changes are caught |
| Forbidden staged edit with working file restored | Rejected, exit 1 | Restoring working bytes cannot hide a protected index change |
| Controlled untracked / ignored additions | Each rejected, exit 1 | Extra files cannot silently pass the scope check |
| Allowed target replaced by a symlink | Rejected, exit 1 | The target must remain a regular file |
| Controlled import failure / early zero exit | Each unassessed, exit 2 | A failed or skipped check is not task success |
| Missing checker argument / checkout | Unassessed, exit 2 | Invalid invocation does not become a failed repair or a pass |
| Restored controlled scope fixture | PASS, exit 0 | Mutation QA left its checkout restored |
| Live agent permissions / independent isolation | NOT RUN | The task remains `not_ready` |

The external check covers three public functions through four routes: `args2sh`,
`args2cmd`, and both explicit `escape_shell_args` styles. It tests eight cases per
route. Passing these cases is not exhaustive correctness. In particular, scope
checks do not authenticate Git metadata or enforce a filesystem sandbox.

Raw command arguments, exit codes, standard output/error, timestamps, and artifact
hashes are retained locally in ignored
`.forge/preparation/boltons-separator/validation.json` and its per-command files.
They are generated preparation output, not committed research results. Reproduce
them using the [preparation instructions](README.md).

These SHA-256 values identify the inspected working bytes on this Windows host;
line-ending conversion can change checkout hashes elsewhere:

| Artifact | SHA-256 |
| --- | --- |
| Behavior verifier | `30dffb9de8deb22c3cbc212e55c9fcd0efb754a30ac23a93aeddcff59230d270` |
| Allowed-change checker | `5d23ecde1fa93ec921e91bcefb4c8de7b3cc38d1bb13c8e1083e2484e3ef8d29` |
| Starting `strutils.py` | `abe1375a79a6072b14eed16a4232e9b42cd4986b6ebc9c4d8864842372f61d0a` |
| Reference `strutils.py` | `6f772949f3eec4210f82049a738e1fe38811ea013b16b58078505238466a1550` |
| Code-only upstream patch | `77fe9a920f622ab04f04b3e56dabc968836e3890ac21fd0e83c9b7238d8c9f15` |
| Upstream license | `c301912653a8d8c99eab6212aa3aea8d164ea249d8ad53c941e0558a0a5ac1e3` |

Both preparation worktrees can access answer objects. They must never become live
agent checkouts. A fresh restricted checkout, verified evaluator/reference
isolation, compatible inference host, runtime integration evidence, and a declared
live batch allowance are still required. No live outcome is recorded here.
