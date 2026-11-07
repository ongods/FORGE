# FORGE: plan from the current prototype to a defensible release

This plan follows the [product architecture](architecture.md) and
[pilot protocol](pilot.md).

## Intended finish

Deliver a portable recovery adapter layer around existing coding agents, a
reproducible comparison, and an honest report of where it helps or fails. Keep
shared file/read/attempt tracking and recovery decisions in the core; connect each
existing agent through a small adapter. OpenCode is the first integration, not
the product's permanent boundary. The portable release needs evidence for a second
existing agent. Start with Python bug-fixing sessions and failed text replacements.
Add syntax repair only after observations justify reliable file attribution. Use
program rules and one recorded agent/model configuration per primary comparison.

Describe this first prototype as **a DARC-inspired investigation of whether file
and attempt tracking improves coding-agent recovery**. The replacement-error
mechanism tests one part of that question. It does not demonstrate recovery across
changing failure types or a general extension of DARC.

Completion does not require a positive result: ship the simpler rule if it works
equally well, narrow supported conditions if appropriate, or archive a mechanism
that is unhelpful. An inconclusive pilot is not a confirmed negative result.
Dashboards, a web app, a new coding loop or model client, model training, online
rule learning, automatic rollback, and general orchestration remain outside this
plan. Additional existing-agent adapters are a staged product requirement.

## Product boundary and compatibility

Follow the [product architecture and internal adapter contract](architecture.md).
The existing coding agent owns its model/provider connection, tools, conversation,
permissions, and native recovery safeguards. FORGE observes normalized evidence and
will request bounded recovery through native agent controls. The experiment runner
is separate evaluation machinery. The Codex development harness is separate again.

Model compatibility and agent compatibility have different gates. Models are
configured through each existing agent's provider support; a new agent requires
an adapter with verified event identity, failure capture, file/read attribution,
and any claimed delivery/cancellation controls. Unknown capabilities stay unknown.
Observation-only support does not imply active recovery or strict budget control.
A synthetic adapter fixture is not a second live integration, and a model API
connection is not evidence of universal agent compatibility.

The user reports that this development machine cannot host a local model. Continue
mechanism tests, constructed replay, task preparation, and adapter implementation
here. Live experiments require a compatible execution environment made available
separately, with actual agent/model/server/host settings recorded. Local-model
evaluation can use another compatible machine; changing to paid/remote inference
or a different study model requires an explicit experiment decision. Do not make
local model installation on this laptop a prerequisite for independent development.

## What exists and what is unknown

- Implemented: passive opt-in observer, file hashes and read evidence, candidate
  failures, limited previous-attempt comparisons, constructed replay, per-log
  summaries, and development quality tooling. The shared observer now accepts
  normalized records; `src/adapters/opencode.mjs` owns OpenCode hook/event mapping,
  native diagnostic recognition, and read metadata. The plugin remains opt-in.
  `src/observation-log.mjs` validates supported log envelopes/identities and reports
  lifecycle/tool integrity, with explicit incomplete-measurement CLI results.
  Adapter-neutral fixtures test the internal contract without establishing another
  supported agent. Contract checks and replay do not verify live integration
  or the future controller/evaluator.
- Not implemented: recovery requests or policies, task-budget enforcement,
  general independent acceptance evaluator, multi-task experiment runner, comparison modes,
  aggregate completion/cost analysis, a second live agent adapter, or measured
  recovery benefit. This is a development prototype, not a finished portable release.
- Supported OpenCode runtime versions remain unverified. Record the actual
  version and demonstrate live capabilities before relying on an integration.
- No working model/server or full evaluation-host configuration is recorded.
  Local inference is unavailable on this machine under the user's stated hardware
  constraint. One Boltons development task has validated setup/reference checks;
  live task readiness remains open. Inference throughput, evaluation size, and
  minimum worthwhile benefit are unset.
- Current snapshots cover direct Python `read`/`edit`/`write` targets up to 1 MiB.
  Shell syntax output has no reliable file-version/history association. Read
  ranges may be partial and concurrent snapshots uncertain. Unknown stays unknown.
- Current budget/recovery fields and final acceptance remain null. Token summaries
  retain latest message updates but do not yet produce experiment-level totals.
  Observer timings are partial, not full task cost or causal overhead estimates.

## Implementation tracking

Update this record with each implementation increment and its observed checks.
Phase 0 remains in progress; local tests do not complete a live experiment gate.
Checked, crossed-out items are completed substeps within the stated scope; no
whole phase has met its exit condition yet.

**Repeat: complete current step → QA → update roadmap → next step.**

QA includes relevant behavior coverage, focused checks, review against starting
contents, and the full quality gate. Fix supported findings and rerun affected
checks before updating progress. Update both the checklist in the relevant phase
below and this implementation record: check and cross out only the completed
scope, attach its actual evidence, and leave partial or unverified work unchecked.
Record PASS, FAIL, NOT RUN, and explicit skips. A local QA pass does not complete
live or model-dependent acceptance conditions. Cross out a whole phase only after
its exit condition is met; if the next step lacks a prerequisite, record that
dependency and continue independent authorized work.

Current position: Phase 0 has tested local foundations, and Phase 2 has one
validated development-task preparation. The next live step is Phase 1's working
agent/model configuration, alongside Phase 2's enforced task/reference isolation.
Both remain unverified; no complete phase or recovery-benefit claim is finished.

- [x] ~~Separate the shared observer from OpenCode-specific mapping and the opt-in plugin entry point.~~
- [x] ~~Add adapter-neutral contract fixtures for file/read evidence, retries, sessions, and duplicate events.~~
- [x] ~~Implement schema-1 log validation, integrity reporting, and distinct CLI results for closed, incomplete, and invalid logs.~~
- [x] ~~Add task-preparation and run-manifest templates.~~ Actual task preparation remains open.
- [x] ~~Add the local formatting/lint/test gate and CI workflow configuration.~~ Hosted CI execution remains unverified.
- [x] ~~Make observer disposal idempotent and test queued work, late callbacks, pending calls, and shutdown-write failure.~~ Live shutdown verification remains open.
- [x] ~~Document a primary-source screen of Goose and Aider interfaces.~~ Candidate selection and a second live adapter remain open.
- [x] ~~Verify exact capture limits and missing/deleted-file evidence, then review and run the full quality gate.~~ Constructed local cases only.
- [x] ~~Verify workspace path exclusions and link handling, then review and run the full quality gate.~~ Windows local cases; Linux and concurrent link replacement remain open.
- [x] ~~Prepare and validate one real Python development task against its starting revision and an upstream repair; retain isolation and live-run gaps.~~ Task-specific preparation only; task remains `not_ready` for live use.
- [x] ~~Prepare and inspect a fresh starting checkout without reference-fix Git objects; retain the separate agent-isolation gate.~~ Operator-owned seed only; enforced agent access remains unverified.
- [x] ~~Detect contradictory tool names/statuses before deduplication, preserving an incomplete log and native execution.~~ Constructed core/hook cases; live ordering remains unverified.
- [x] ~~Keep incomplete OpenCode read ranges/truncation unknown and match native zero-offset behavior without changing the shared core.~~ Constructed mapping checks and pinned source reference only.
- [ ] On a compatible execution host, record a working agent/model configuration and verify task/evaluator/reference access boundaries before live runs.

| Date (Asia/Singapore) | Change | State | Evidence and remaining limits |
| --- | --- | --- | --- |
| 2026-11-07 | ~~Add supplied README branding image~~ | QA PASS | Added the user-supplied assets/forge-logo.png above the centered FORGE title at width 240 with descriptive alt text. Viewed the local 851 x 526 PNG and used it without editing. Asset/header/link checks PASS; full gate PASS: Biome (23 files), 75/75 tests, 0 skipped. Evidence under .forge/qa/readme-branding/. Live GitHub rendering NOT RUN; branding does not establish release readiness |
| 2026-11-07 | ~~Preserve LF text checkouts for the development quality gate~~ | QA PASS | Added .gitattributes and documented the line-ending rule. Full model-free gate PASS: Biome (23 files), 75/75 tests, 0 skipped. Staged whitespace check initially FAIL on an extra final blank line in .gitignore; corrected check PASS. Exported all 38 staged text files with core.autocrlf=true: bytes match the index and retain LF. Raw gate/export results under .forge/qa/commit-progress/. Generated logs and dependencies excluded; hosted CI and live agent checks remain NOT RUN |
| 2026-11-07 | ~~Preserve uncertainty in OpenCode read metadata~~ | QA PASS | RED: 4 groups FAIL, 1 PASS; GREEN: 5/5 groups PASS. Missing/malformed/empty returned ranges and non-boolean truncation flags become null; valid partial ranges remain intact. Zero offset maps to one per pinned read source; zero limit stays zero. Both hooks and terminal-only events tested, with input preservation and session isolation. Reviewed mapper, tests, callers, and docs against starting contents; no unresolved finding in scope. Full gate PASS: Biome (23 files), 75/75 tests, 0 skipped on Windows; .forge/qa/opencode-read-metadata/. Supplemental log-count check initially FAIL (UTF-16 decoded as UTF-8); corrected check PASS, failed check retained. Live metadata behavior remains NOT RUN |
| 2026-11-07 | ~~Contain conflicting tool evidence before deduplication~~ | QA PASS | RED: 11 FAIL, 3 PASS; GREEN: 14/14 PASS. Tool-name and terminal-status conflicts disable capture before changing stored evidence; ordinary duplicates, changed-file retries, and session isolation remain valid. Reviewed observer, new tests, callers, and contract docs against starting contents; no unresolved finding in scope. First full gate stopped at formatting (test stage NOT RUN); corrected gate PASS: Biome (22 files), 70/70 tests, 0 skipped on Windows. Raw results under .forge/qa/observer-conflicts/. No schema change or live ordering/support claim |
| 2026-11-07 | ~~Validate identities/statuses before observer capture~~ | QA PASS | Pre-fix: 4 groups FAIL, 1 PASS. Added passive core validation; targeted 5/5 groups PASS (61 invalid-input cases plus valid sessions/null fields). Reviewed source, tests, and contract docs against starting contents; no unresolved finding in scope. Full gate PASS: Biome (20 files), 53/53 tests, 0 skipped; retained under .forge/qa/observer-input-contract/. Valid prefixes remain incomplete after disablement; native execution stays intact. No live support claim |
| 2026-11-07 | ~~Expose native session-error record counts in summaries~~ | QA PASS | Pre-fix: 3 regressions FAIL; after the additive summary field, targeted 3/3 PASS. Reviewed summary, hook/CLI tests, callers, and docs against starting contents; no unresolved finding in scope. Full gate PASS: Biome (21 files), 56/56 tests, 0 skipped; constructed replay PASS with seven paired tools, task acceptance null. Logs/results saved under .forge/qa/session-error-summary/. Duplicate/global errors count as records without exposing captured payload text or inferring failed tasks; legacy CLI outcomes retained |
| 2026-11-07 | ~~Phase-level completion checklists and persistent QA/update loop~~ | QA PASS | All 10 phase sections now show scoped completed/open work. Reviewed roadmap and AGENTS.md against starting contents; links, whitespace, progress markers, and loop instructions PASS. Initial documentation check failed on its Unicode loop-string comparison; corrected check PASS. Full gate PASS: Biome (19 files), 48/48 tests, 0 skipped; saved under .forge/qa/phase-tracking/. Live and whole-phase completion claims remain open |
| 2026-11-07 | ~~Exact file/text/call capture limits and missing/deleted-file evidence~~ | QA PASS | 12 new constructed tests PASS; full gate PASS: Biome (15 files), 43/43 tests. Reviewed new tests, surrounding observer behavior, README limit units, and roadmap against starting contents; no unresolved finding in that scope. No runtime change was needed; live/platform claims remain unverified |
| 2026-11-07 | ~~Workspace path exclusions and link handling~~ | QA PASS | 5 new constructed tests PASS; full gate PASS: Biome (16 files), 48/48 tests, 0 skipped on Windows x64 / Node 22.14.0. Targeted formatting failure corrected before gate. Reviewed fixture cleanup, path assertions, and surrounding observer code; no source change or unresolved finding. Fixed junctions/file symlink tested; Linux and concurrent replacement NOT RUN |
| 2026-11-07 | ~~Prepare one real Python development task~~ | QA PASS | [Boltons task and evidence](tasks/boltons-separator-validation.md): starting revision fails 20/32 behavior checks (expected); code-only upstream repair passes 32/32; visible doctests and scope checks pass on both. Controlled checker failures/mutations match expected outcomes. Reviewed task checkers/records and retained artifacts; resumed full gate PASS: Biome (19 files), 48/48 tests, 0 skipped. Interrupted gate had no recoverable final result; resumed gate saved under .forge/qa/resume-preparation/. No model run or live isolation claimed |
| 2026-11-07 | ~~[Fresh starting checkout without reference-fix objects](tasks/boltons-start-seed.md)~~ | QA PASS | Audited shallow checkout: only the pinned start is a local/reachable commit; reference fix absent, no object alternates, clean status, scope and visible doctest PASS; baseline behavior fails 20/32 checks (expected). Reviewed seed procedure, raw inventory, manifest, and evidence consistency. Full gate PASS: Biome (19 files), 48/48 tests, 0 skipped; saved under .forge/qa/seed-checkout/. Docs/data checks and six retained task artifact hashes PASS. Local clone failed Git ownership checks; direct public clone succeeded without changing Git trust settings. Agent isolation remains unverified |
| 2026-11-07 | Working live configuration and enforced access boundaries | NOT RUN | No compatible inference host or working model/server configuration is available in this workspace. Clean Git history and task checks do not establish live agent isolation, runtime capture, recovery delivery, or cancellation |
| 2026-11-07 | ~~Idempotent observer disposal and suppression of capture after shutdown~~ | IMPLEMENTED; local checks PASS | New regressions reproduced three failures before the fix. Adapter/core tests then passed 10/10; full quality gate passed Biome (13 files) and 31/31 tests. Constructed replay passed with seven paired tool calls; final acceptance remains null. Live shutdown behavior NOT RUN |
| 2026-11-07 | ~~[Primary-source screening of another existing agent](agent-integration-candidates.md)~~ | DOCUMENTED; runtime checks NOT RUN | Goose/Aider interfaces and unresolved evidence recorded; primary references checked. No second adapter selected, implemented, or live-tested |

The first formatting check for this increment failed on the new test formatting;
targeted formatting corrected it before the passing gate. The review scope was
the observer/mapper lifecycle change, its four regressions, and associated docs,
compared with the task's starting contents. No unresolved defect was found within
that scope; review and checks do not establish live compatibility or correctness
outside their coverage.

## Sequence and dependencies

Each phase produces an inspectable artifact and has an exit condition. Do not
expand a mechanism merely because implementation is possible. Start Phase 1's
runtime setup and Phase 2's task preparation alongside Phase 0's minimum trust
checks. The first ordinary batch needs those checks, live passive capture, ready
tasks, and a declared stop rule. Broader hardening can follow the supported
implementation; it is not all a prerequisite for the first live experiment.

| Phase | Work and deliverable | Exit condition |
| --- | --- | --- |
| 0. Establish the shared core and trustworthy observation | Preserve bounded capture and native behavior through a neutral observer contract and agent-specific mapping; address minimum trust gaps | Contract tests pass; capture limits, incomplete evidence, and deferred cases are explicit |
| 1. Prove the first adapter's runtime contract | On a compatible execution host, record one working configuration; demonstrate native read-edit-test, live failure capture, recovery-message delivery, and cancellation | Traces distinguish initialization, observation, message delivery, and cancellation on the selected version |
| 2. Prepare tasks now, then observe them | Validate task setup and external checks; fix the first batch and total allowance before running native recovery | Task records and all attempted outcomes are inspectable; evidence informs whether recovery is worth testing |
| 3. Make comparisons reproducible | Small task runner, independent acceptance, run registry, enforced declared budgets, and complete outcome accounting | Known good/bad/timeout/infrastructure cases are recorded correctly without evaluator leakage |
| 4. Test one recovery action | Implement native and credible current-error-only modes with the same fixed recovery opportunity | Live bounded requests work; development comparisons establish whether the action is promising |
| 5. Test added state/history | Add an explicit decision function and recovery ledger using the same action templates and limits | Policy tests and live development trials isolate selection value; uncertain cases defer |
| 5a. Demonstrate a second agent integration | Inspect a second existing agent, implement its adapter, and reuse the shared core and action semantics | Live capability evidence distinguishes portable behavior from first-agent assumptions; no new coding loop is needed |
| 6. Freeze the study | Choose primary outcome, worthwhile change, tasks, analysis, budgets, policies, and comparison versions | Versioned protocol and split manifest are fixed before final runs |
| 7. Evaluate unseen tasks | Run frozen comparisons on held-out repositories, then independently verify and analyze all attempts | Audit-ready results and uncertainty support continue/simplify/narrow/stop decisions |
| 8. Finish the supported adapter product | Resolve release-critical issues; publish agent/version capability matrix, installation, controls, evidence, and limits | Another developer can reproduce runs; a portable release has live evidence for at least two existing agents |

## Phase 0: establish the minimum trust needed for a live experiment

Status: in progress. Completed items below cover local mechanisms and checks.

- [x] ~~Separate the shared observer, OpenCode mapper, and opt-in plugin entry point.~~
- [x] ~~Test neutral records, file/read evidence, retries, session isolation, duplicates, cumulative usage, and passive observation failures.~~
- [x] ~~Validate schema-1 log identities and report missing, duplicate, reordered, and inconsistent lifecycle/tool evidence.~~
- [x] ~~Distinguish closed, incomplete, and invalid logs in the summary CLI without inferring task acceptance.~~
- [x] ~~Make disposal idempotent and test queued work, late callbacks, pending calls, and shutdown-write failure.~~
- [x] ~~Test exact file/text/call capture boundaries and missing/deleted/recreated files.~~
- [x] ~~Test traversal, sibling exclusions, unsupported targets, and fixed links/junctions on Windows.~~ Linux remains unverified.
- [x] ~~Clean up test-owned temporary directories and run the local quality gate.~~ Hosted CI execution remains unverified.
- [x] ~~Keep text checkouts on LF when Windows Git enables CRLF conversion, matching the formatter configuration.~~ Staged export verified locally with core.autocrlf=true; hosted CI remains unverified.
- [x] ~~Validate required normalized identities and terminal statuses before emitting records; preserve a parseable incomplete prefix and native execution on invalid input.~~ Local contract coverage only.
- [x] ~~Expose captured native session-error record counts in summaries, keeping duplicate observations and task outcomes distinct.~~ Captured error payload text stays in the log.
- [x] ~~Test printed syntax-error text through hooks and the CLI as a manual-review candidate while preserving completed status and unknown task acceptance.~~ Constructed case only.
- [x] ~~Detect contradictory tool names or terminal statuses for the same session/call before suppressing duplicates; keep the valid prefix incomplete without changing native behavior.~~ 14 constructed regressions; unchanged retries, changed-file retries, and other sessions retained.
- [x] ~~Normalize OpenCode read-range and truncation uncertainty, including empty reads and native zero-offset handling.~~ Five constructed test groups and pinned source comparison; live read metadata remains unverified.
- [ ] Compare capture with actual runtime traces for the selected agent/version.
- [ ] Record startup failures without logs and verify native permissions/results/recovery in live sessions.
- [ ] Complete relevant remaining snapshot, concurrency, alias, and platform hardening as support develops.
- [ ] Meet the phase exit condition for the first live experiment.

The 2026-11-06 workspace separates `src/observer.mjs` from native mapping in
`src/adapters/opencode.mjs`. The entry point remains `.opencode/plugins/forge-observer.js`.
Contract coverage includes neutral tool names/argument schemas, read and file
changes, session isolation, duplicates, usage updates, and contained startup/mapping
failures. This establishes an internal boundary; live integration remains pending.

Keep observation passive and prioritize four checks for the selected experiment:

- [ ] Capture the actual replacement failure, including a thrown tool error, rather
  than relying only on a successful after-hook or a replayed diagnostic string.
- [ ] Associate the call with the correct session and supported in-workspace file;
  preserve file-version/read uncertainty and deduplicate terminal events.
- [ ] Expose missing terminal records, observer-disablement, and startup/write
  failures in the run record. A parseable log alone does not prove completeness.
- [ ] Preserve native tool results, permission decisions, edits, and recovery when
  observation succeeds or fails. Observer-only startup failures need the same
  containment as later write failures. Retain existing capture/workspace limits.

Use focused regression checks and Phase 1's live traces to establish these
properties. Validate identity/schema/origin for the logs used by the pilot;
preserve legacy logs or version schema changes. Clean up test-owned temporary
directories. This phase introduces no interventions or new logging framework.

Completed for log import: supported schema-1 envelopes and summary identities are
checked; mixed origins/runs and invalid summary identities/status fields are
rejected; missing shutdown, unpaired/duplicate/reordered tool records, tool identity
conflicts, and pending-call disagreements are reported. Closed means record
consistency, not complete runtime capture. The CLI preserves incomplete summaries
with exit code 2 and uses exit
code 1 for invalid/unreadable input. The run manifest can retain summary references
and integrity issues. Full payload verification and live trace comparison remain
separate requirements; startup failures without a log need an operator run record.

Disposal now drains accepted observations once and ignores later capture. A pending
tool at shutdown remains incomplete. The shutdown-write-failure regression retains
an incomplete log and contains the failure. This covers repeated disposal and late
callbacks locally; live runtime shutdown verification remains pending.

Local boundary coverage now includes snapshots one byte below, at, and above
1 MiB; argument/result/session-error capture at and above 16,000 JavaScript string
code units; and exact 10,000-call admission through starts and terminal-only events.
Duplicates do not consume another call slot; existing pending calls may finish at
capacity until overflow disables capture. Logs after overflow remain incomplete.
Missing files, deletion during a read, recreation, and subsequent unchanged retries
retain unknown version evidence where appropriate. These are constructed tests.

Local workspace tests also cover lexical traversal, similarly prefixed siblings,
unsupported files/directories, fixed directory junctions to inside/outside targets,
and an outside-file symlink on Windows. Native results and target contents remain
unchanged. Linux execution and concurrent replacement of links remain unverified;
these checks do not establish an adversarial filesystem sandbox or shared history
across multiple aliases of the same file.

Required producer identities and terminal statuses are validated before capture;
invalid inputs disable observation without corrupting the readable prefix or
native execution. Summaries now expose native `session_error_records`, including
duplicates/global errors, without copying captured error text. Constructed
hook/CLI tests retain printed syntax text as a candidate rather than a verified
parser failure or task outcome. A zero error-record count does not prove no
runtime errors occurred.

Deduplication now checks tool identity and terminal status before discarding a
repeated session/call event. Contradictions passively disable capture and preserve
the valid incomplete prefix; they do not identify which report was correct.
Constructed core and OpenCode hook/event tests cover both status orders, pending
and terminal-only calls, ordinary duplicates, file-change retries, and sessions.
Other payload conflicts and actual runtime ordering remain separate limits.

OpenCode read metadata now retains only positive safe-integer returned ranges in
ascending order and boolean truncation flags. Missing, malformed, or empty
coverage remains null instead of a tuple with missing endpoints; no range is
inferred from text or requested limits. The mapper follows the pinned source's
zero-offset-to-one behavior and preserves zero limits. Tests cover successful
hooks and terminal-only events, partial ranges, and replacement of earlier known
coverage with later unknown evidence within the correct session. This checks
mapping behavior without authenticating native metadata or proving live capture.

Schedule the remaining hardening as support develops: files changing during an
individual snapshot; concurrent link changes and alias identity; broader reordered-event/disposal cases; completed
shell calls with failing exits; and ordinary-run syntax candidate false positives/misses. Investigate
memory/buffering changes only where evidence shows a need. Complete relevant
coverage before claiming support for those conditions and release-critical
hardening before Phase 8. Report unavailable platform cases explicitly. A known
defect affecting the chosen experiment must be fixed or excluded before its runs.

Exit condition for the first live experiment: focused trust checks and the quality gate
pass, supported limits and deferred cases are recorded, and measurement failures
cannot be mistaken for agent success or failure. Remaining boundary/platform
coverage does not hold up the first supported live run.

## Phase 1: prove integration before choosing the controller architecture

Status: live verification not run; a compatible execution host is needed.

- [ ] Record a working host/agent/adapter/model/server configuration and run manifest.
- [ ] Demonstrate native read-edit-test and compare live failure capture with runtime traces.
- [ ] Verify focused recovery-message timing, once-only delivery, and native safeguards.
- [ ] Verify cancellation, continuing child work, latency, and accounting limits.
- [ ] Retain traces that satisfy the phase exit condition on the selected version.

Arrange a compatible execution host before model runs; this development laptop
cannot provide local inference under the user's stated constraint. Record that
host's hardware, OS, agent and adapter versions, model-serving location, model
identity/weights, quantization, context, inference settings, and server version.
Select a configuration only after checking hardware fit and tool-calling behavior;
do not invent an endpoint or install a model on this machine. OpenCode is the first
adapter to verify. Use an isolated task checkout and
[run manifest](run-manifest.example.json). Record observation, recovery delivery,
and cancellation as separate capabilities with evidence for the selected version.

First demonstrate a native read-edit-test cycle with that configuration in an
isolated task checkout. Save the commands, actual tool/test outcomes, and model
response as evidence that the runtime can perform basic work. Then enable passive
observation and prove actual tool capture, a thrown replacement failure, a shell
command reporting failure, and duplicate-event handling. Retain session/call IDs,
file-version evidence, and original results so capture can be checked against the
runtime trace. Label deliberately triggered failures `constructed`, even when
they use real OpenCode tools. Verify permission requests, edits, and native
recovery remain intact. Initialization alone is not a live integration pass.

Then run a narrow feasibility spike for a separate focused recovery note.
The [SDK documentation](https://opencode.ai/docs/sdk/) describes context-only
messages through `session.prompt` with `noReply: true` and session cancellation
through `session.abort`. The versioned plugin interface also exposes a message
transform. These are candidates to test on the selected version; documented
interfaces do not prove timing or behavior in a running session. Verify session
identity, delivery before the intended next model call, once-only delivery, no
recursive run launch, and no duplicate request after retries. Do not rewrite the
failed tool's result.
Recheck permissions immediately before delivery; never clear a denial, restart a
stopped session, or bypass the agent's native loop safeguards.

Separately test abort while a model request, tool/child process, or permission
request is pending. Identify ownership of each process and any work that continues
after abort. A step setting or SDK endpoint is not proof of a hard budget.
Record cancellation latency and token-accounting lag. Any watchdog controls only
the experiment-owned session/processes, never an unrelated desktop/model service.

Exit condition: captured traces prove the selected transport and cancellation contract on
the selected version. If transport is unsafe, continue as an observer and defer
active recovery. If cancellation is insufficient, use a declared manual pilot
stop rule and do not claim automated experiments enforce strict budgets.

Primary sources, checked for feasibility rather than live proof:
[plugin interface at 1.18.23](https://github.com/anomalyco/opencode/blob/v1.18.23/packages/plugin/src/index.ts),
[tool execution](https://github.com/anomalyco/opencode/blob/v1.18.23/packages/opencode/src/session/tools.ts),
[prompt delivery](https://github.com/anomalyco/opencode/blob/v1.18.23/packages/opencode/src/session/prompt.ts),
[native processing/safeguards](https://github.com/anomalyco/opencode/blob/v1.18.23/packages/opencode/src/session/processor.ts),
and [SDK controls](https://opencode.ai/docs/sdk/).

## Phase 2: establish frequency and cost before adding recovery

Status: one development task validated for preparation; no ordinary agent batch run.

- [x] ~~Add the task-preparation and run-manifest templates.~~ Templates alone do not establish readiness.
- [x] ~~Record the Boltons separator task's pinned revision, public bug, license, setup, and allowed changes.~~
- [x] ~~Implement and validate its external behavior and allowed-change checks, including controlled checker failures.~~
- [x] ~~Confirm the starting bug fails the same check that the code-only upstream repair passes; retain doctest outcomes and hashes.~~
- [x] ~~Prepare and audit a separate starting checkout without reference-fix objects.~~ Operator-owned seed only.
- [ ] Verify enforced agent isolation from task records, hidden checks, outputs, and reference answers.
- [ ] Finish the intended development task set and validate it on the selected execution host.
- [ ] Fix the ordinary batch, repetitions, run order, total allowance, and stopping rule before agent outcomes.
- [ ] Run native recovery, retain every attempted outcome/cost, and externally check final repairs.
- [ ] Audit tool errors and unflagged calls; assess frequency, avoidable cost, and Gate A.

Begin task preparation immediately, before building a runner or recovery policy.
Choose a small development set of real Python bug-fixing tasks, including easy
successes, using recorded selection rules rather than known looping runs. Keep
these tasks/repositories separate from final evaluation candidates. Each initial
task needs an inspectable record:

Use the [task record template](task-manifest.example.json) for this preparation.
It contains unknown/not-prepared values and provides no actual task or evaluator.
The first [concrete development-task preparation](tasks/README.md) now records a
Boltons separator bug and task-specific external checks. Setup/reference validation
is separate from live readiness; evaluator/reference isolation remains unverified.

| Task field | Required evidence |
| --- | --- |
| Starting point | Repository/provenance, exact starting revision, and bug description supplied to the agent |
| Setup | Environment/dependency versions, setup command, and visible test command that work in a fresh checkout |
| Allowed changes | Editable paths and constraints, including test/evaluator integrity rules |
| External acceptance | Verifier reference, command/environment, and expected result that distinguishes a correct repair from an incorrect one; keep hidden checks and answers outside agent access |
| Task validation | Starting revision's failure on the target check and, where available, a known correct repair passing the same check; retain outcomes and any unverified assumptions |

Separate the intended bug from environment/setup failures. Resolve a broken setup
or acceptance check before spending inference on that task. When a known correct
repair is unavailable, record that limitation and the validation performed rather
than assuming the evaluator is reliable. Keep reference repairs outside agent
access. A task is ready only when its setup and external check are executable.

Before seeing batch outcomes, record the chosen task IDs/revisions, run order or
ordering rule, repetitions, per-run limits, total execution allowance, and review/
stopping rule. Use a task-count and wall-time ceiling, plus a token ceiling where
accounting supports one. Record every launch, including failed starts and runs
without complete logs. Additional collection needs an explicit rationale and a
revised allowance. The first batch debugs the process and reveals examples; a
small batch cannot establish that an uncommon failure is unimportant.

Use native recovery and the observation pilot's explicit operator-enforced limits.
Keep independent final checks out of the agent's context from the first ordinary
run, even if verification is initially a manual external script. Record human help,
native interventions, elapsed time, available tokens, stops, and missing data.
Manually review all tool errors and candidate failures plus a sample of successful
and unflagged calls; expand inspection when misses are suspected. Do not infer
frequency from constructed cases. Track both frequency across tasks and cost spent
on the target failures.

Gate A: is there enough evidence of recoverable cost to warrant a recovery
experiment? Sparse or absent failures in a small pilot remain inconclusive about
uncommon failures. Gather more representative observations only when justified,
narrow the use case, or stop for stated feasibility/cost reasons. If syntax errors
dominate, verify parser filename and workspace attribution before making file/
history-based syntax decisions; otherwise keep syntax passive. No fixed task
count or gain threshold is assumed.
Record why the estimated recoverable waste warrants the expected monitoring and
recovery costs; a detector finding an error alone does not satisfy this gate.

## Phase 3: build only the experiment machinery needed next

Status: not implemented; Phase 2's task-specific checks do not complete this runner.

- [ ] Automate isolated attempts, stable IDs, manifests, and external final verification.
- [ ] Enforce and test declared budgets, cancellation, bookkeeping, and evaluator integrity.
- [ ] Validate all outcome classes and complete cost accounting against the exit condition.

Automate the manual run protocol in a small external evaluation runner. It uses
existing-agent controls through adapters and does not implement a coding loop.
Give each task/attempt a stable ID, fresh isolated checkout/session, selected mode,
run manifest, external output directory, and final status. Capture the initial
revision and allowed edits. Preserve the user's working checkout. Use a manifest
to join task IDs, observer instance logs, sessions, interventions, and verification.

Keep the final verifier outside the task checkout and inaccessible to agent tools
with the actual execution permissions in use; a hidden filename or prompt rule
alone does not isolate it. If the environment cannot enforce that boundary, mark
independent evaluation blocked and do not claim a clean final comparison.
Verify expected test/evaluator integrity and reject success based on weakened
visible tests, modified evaluators, or unacceptable changes. Run final checks only
after agent execution stops and never return hidden answers to policy selection.

Enforce an overall wall-time budget with verified cancellation, plus supported
per-call/model limits and tool/recovery limits. Count recovery inside the overall
task allowance. A two-recovery cap is a provisional development setting, not an
optimum. Specify when a request reserves/consumes an attempt, whether it was
delivered, and how failed delivery is recorded; duplicate events must not spend
allowance twice. Bound transport retries separately. Record overshoot rather than
claiming token limits are exact when usage arrives late.

Register attempts before launch. Keep outcomes such as verified success,
unsuccessful repair, budget stop, native denial, infrastructure failure, and
measurement failure distinct. Declare any exclusion policy before comparisons;
show the all-attempted completion denominator and a sensitivity analysis for
externally classified infrastructure issues. Preserve costs for unsuccessful runs.
Never treat missing tokens as zero or an idle session as task success.

Exit condition: known good/bad patches, weakened tests, timeout/cancel, missing telemetry,
and failed startup all produce the expected records and verifier decisions.
Costs include task startup, model/tool work, monitoring and recovery; record final
verification separately and total end-to-end cost too. Choose timing boundaries
once and apply them uniformly.

## Phase 4: test the action before claiming better selection

Status: not implemented; requires the earlier runtime and measurement evidence.

- [ ] Implement the fixed reread/repair action with verified native delivery and limits.
- [ ] Implement matched native and credible current-error-only comparison modes.
- [ ] Test controlled delivery and ordinary development outcomes; decide Gate B.

Start with one fixed action: ask the agent to reread the relevant supported file
region and make a focused replacement. Let the agent perform its normal approved
tools; FORGE does not silently write a patch or roll back a user's edits. Keep
agent-specific hook/transport details in its adapter and a small testable policy
function in ordinary JavaScript. Keep the passive observer's public behavior and
the agent's model connection, tools, history, permissions, and safeguards.

Implement switchable native and current-error-only modes first. The reactive rule
must be useful: react to a verified supported replacement error, request the same
focused action, honor deduplication and budgets, and avoid unsupported failures.
Its decision does not use file-version, read, or earlier-outcome evidence; its
available recovery actions and underlying agent capabilities match the later
FORGE mode. All modes retain the agent's normal conversation history and native
context/compaction behavior. Controllers may track request IDs, delivery status,
recovery counts, and remaining allowance for deduplication and budget bookkeeping.
That bookkeeping does not make the reactive decision use FORGE's additional
file/read/attempt evidence, and normal agent memory must not be removed to create
the comparison.

Use controlled cases to verify delivery and naturally occurring development tasks
to assess action usefulness. Keep constructed and ordinary results separate.
Compare against native recovery under matched conditions; annotate effects of
sampling variation. Review an apparently helpful action for regressions, wasted
requests, and harmful interruption of native recovery.

Gate B: does the action itself plausibly improve outcomes or resource use enough
to continue? If not, revise/narrow or stop the action. Formal causal claims require
the later frozen comparison; a few development successes are only exploratory.

## Phase 5: test state/history as the additional information

Status: candidate rule documented; decision function/controller not implemented.

- [x] ~~Document the candidate replacement-failure decision rule and its uncertainty/duplicate safeguards.~~ Design only.
- [ ] Implement that decision function and bounded history using the same action templates and limits.
- [ ] Test rereads, changed files, equivalent retries, stale notes, cancellation, and transport failures.
- [ ] Compare against the credible reactive rule in live development trials; decide Gate C.

Use the same action templates, budgets, model, and permissions. Add explicit
decisions: continue native execution, request the supported action, or stop only
at declared execution limits. Unknown or unsupported evidence defers to native
behavior within the task allowance. A repeated error or changed hash alone is not
a decision rule proving intervention or progress.

Start with this explicit candidate rule for replacement failures. It is an
experimental choice, not an assumed improvement. Apply it only to a confirmed
supported error with sufficient session/file/region evidence, at the verified
delivery point, while permissions and the shared task/recovery limits allow it.

| Observed situation | Candidate decision |
| --- | --- |
| Replacement failed; relevant current contents have not been reread since the failure | Request one focused reread and repair using the same action template as the reactive mode |
| Relevant current contents were already reread after that failure | Continue native recovery; do not issue the same reread request again |
| A request for that unresolved failure, current file version, and region is already pending or delivered | Suppress duplicate requests and let native execution proceed; record delivery failures within the bounded transport policy |
| File changed after the read or failed attempt | Treat earlier read evidence as potentially outdated; reassess only on a confirmed supported failure with current evidence, within the remaining allowance |
| Evidence is missing, partial for the relevant region, inconsistent, or uncertain | Defer to native recovery within the task allowance |

Treat equivalent failed retries on unchanged bytes as the same unresolved case;
a new call ID alone must not reset reread/request suppression. A successful read
of another region does not satisfy the rule. A changed hash alone does not trigger
an intervention or prove progress. Test decisions at the actual delivery point so
a native reread or file change observed before delivery can prevent a stale note.

Track a bounded per-task history of action identity, error, supported file version,
read region and confidence, changes since failure, delivered recovery requests,
subsequent outcomes, and remaining budget. Reset it across tasks. Distinguish a
successful tool call, target error resolution, and independently verified task
completion. Test legitimate retries after changes/rereads/transient failures as
well as unchanged unsuccessful repetitions. Handle reordered/duplicated events,
task cancellation, cap exhaustion, and recovery transport failure.

For shell syntax failures, either add trustworthy in-workspace filename/parser
attribution with explicit uncertainty tests, or leave syntax-state selection out
of the supported controller. Two failure types are a scope ceiling, not an
obligation to implement both before evidence exists.

Gate C: does the additional information offer promise beyond the credible reactive
rule? Use development evidence to decide whether to keep, simplify, or narrow the
policy before spending on a final study. Freeze changes later; do not learn rules
online from final tasks.

## Phase 5a: demonstrate portability to another existing agent

Status: preliminary interface screen complete; no second adapter selected or tested live.

- [x] ~~Document primary-source interface evidence and unresolved gaps for Goose and Aider.~~ No support claim.
- [ ] Select and pin a second agent from actual need and verified integration capabilities.
- [ ] Implement its adapter using the shared core and run the common contract checks.
- [ ] Demonstrate live observation, supported recovery/cancellation, and native safeguards.
- [ ] Meet the portability gate and assess benefits within that agent's own configuration.

The [Goose/Aider interface screen](agent-integration-candidates.md) records initial
primary-source evidence and gaps. It does not select an agent or satisfy this gate.

After development evidence supports continuing, select a second existing agent
from actual user need and documented integration capabilities. Inspect its native
event/control contract before coding. Reuse the shared observer and policy; map
native tool names, arguments, errors, reads, usage, delivery, and cancellation in
its adapter. Do not build another agent loop or a direct model client to satisfy
this milestone. Version the adapter and record unsupported capabilities explicitly.

Run the common contract checks and live native read-edit-test, thrown-failure
capture, session/file attribution, and native-safeguard preservation. Verify each
claimed recovery/cancellation capability independently. Missing read or file
evidence defers selection to native recovery. Keep fixtures and live traces
distinct. Observation-only compatibility may be reported as such; it does not
complete the portable recovery release's active-control acceptance conditions.

Portability gate: the second adapter works through the same core without
agent-specific branches in shared tracking or recovery selection. Compare recovery
against that agent's own native/reactive behavior under matched conditions before
claiming recovery benefits there. Engineering compatibility and measured benefit
are separate claims. If integration cannot meet the contract, document the limit
and select another justified candidate or retain a scoped preview.

## Phase 6: freeze a fair comparison

Status: comparison requirements documented; study protocol not frozen.

- [x] ~~Document planned comparison modes, retained native history, matched actions/budgets, and all-attempt cost accounting.~~ Design requirements only.
- [ ] Use development evidence to choose the primary outcome, worthwhile change, analysis, study size, and compute allowance.
- [ ] Freeze tasks/splits, configurations, policies, evaluator, exclusions, budgets, and run order.
- [ ] Define and include a separate DARC-inspired arm before making the broader extension claim, if pursued.

The main comparison modes are:

| Mode | Added controller decision information | Required fairness constraint |
| --- | --- | --- |
| Native | Existing agent's recovery | Retain normal permissions, retries, and loop safeguards |
| Reactive | Current supported error | Same available action templates, caps, and delivery mechanism as FORGE |
| FORGE | Same error plus file/read/attempt evidence | Added information is the intended difference |
| DARC-inspired, conditional | Frozen development-derived diagnosis/recovery policy | Required before claiming an extension of DARC; document adaptation and departures |

All four modes retain normal agent conversation history. Common controller
bookkeeping may include request IDs, delivery status, and recovery counts. FORGE's
intended additional information is what its decision function uses about file
versions, relevant reads, and earlier attempt outcomes. The reactive controller
does not use those signals to choose its action; the underlying agent still has
its ordinary conversation and tools.

Use the same common measurement layer in each primary comparison, with no native
interventions added to the native arm. Separately calibrate native behavior with
observer off/on to estimate instrumentation overhead and check that measurement
does not change tool contracts. Report overhead; do not silently remove FORGE's
monitoring/recovery costs from its resource budget. Report actual deployment cost
against native behavior alongside the common-instrumentation comparison, so shared
measurement does not conceal additional observer cost. Match task inputs, revisions,
model/server settings, tools, initial context, execution allowance, native settings,
and operator assistance rules. Document any unavoidable difference.

Make native/reactive/FORGE comparisons within the same agent/model configuration.
Record agent and adapter versions and capability evidence alongside model/server
settings. Keep results for different agents/configurations separate; they are not
interchangeable treatment arms. A benefit on the first agent does not establish
the same benefit on the second, even if both adapters pass integration checks.

Decide the primary outcome before final evaluation: for example, independently
verified completion under the common budget. Set the minimum worthwhile change
using developer priorities and pilot costs; do not assign a universal percentage.
Specify how a claim about similar completion with lower cost would be evaluated
separately. Select uncertainty analysis, repetitions, study size, and feasible
compute allowance from actual throughput/variation; repetitions do not substitute
for independent tasks. Balance/randomize mode order and record seeds/settings
where supported. Control warming, caching, and shared-server contention.

Version the task/repository split, policies, templates, action/cancellation contract,
budget settings, model/environment manifest, evaluator, infrastructure policy,
analysis, and study target. Keep final repositories unseen during rule development.
If the model or rules must change after final outcomes are examined, label that
study exploratory and use fresh held-out data for a confirmatory claim.

The [DARC paper](https://arxiv.org/abs/2608.11772) builds recovery policies from
development failures and freezes them for evaluation. Its
[conclusion and limitations](https://arxiv.org/html/2608.11772v1#S7) identify dynamic
decisions for individual runs with mixed failure types as future work (source
rechecked 2026-10-26). The first replacement-error policy investigates one component
of that direction; it does not establish mixed-failure recovery. Keep the initial
claim to a DARC-inspired investigation of file/attempt tracking in coding-agent
recovery. Add a separate DARC-inspired comparison only once its behavior is clearly
defined and the broader extension claim is ready to evaluate.

The paper does not establish reusable code, a code license, or Python/OpenCode
compatibility. Verify availability and licensing before reusing upstream code;
for an independent DARC-inspired implementation, document departures and validate
compatibility. Include that documented arm before making the extension claim;
otherwise report the native/reactive/FORGE comparison within its supported scope.

## Phase 7: run, audit, and decide

Status: not run; requires the frozen protocol.

- [ ] Execute all frozen comparisons on held-out tasks with complete outcome/cost records.
- [ ] Independently verify final repairs and audit uncertainty, measurement gaps, and intervention harms.
- [ ] Report the evidence and decide whether to continue, simplify, narrow, or stop.

Run the frozen protocol on held-out tasks/repositories. Apply declared stop rules,
keep all attempts and resource use, and keep final verifier output out of agent
feedback. Investigate infrastructure problems without tuning the policy to final
failures. Report completion and understandable uncertainty across tasks, with
repository-level variation where the design supports it.

Report total elapsed time, available input/output and cache/reasoning token
categories without double-counting cumulative updates, observer/recovery overhead,
intervention frequency, harmful/unnecessary interventions, retries, and human help.
Include failed attempts in resource-per-success calculations; if there are no
successes, report that ratio as undefined rather than zero. Report missing and
estimated measurements. Review candidate false positives/misses separately from
actual task outcomes and avoid selected-subset headline gains.

Expand only for repeatable benefit over strong simpler behavior at comparable
budgets. Simplify if the reactive rule captures the gain; narrow if benefit occurs
under identifiable conditions; revise/stop when harm and overhead outweigh benefit.
A small uncertain difference may require a larger study or an explicitly
inconclusive report, not a claim of equivalence or a successful negative result.

## Phase 8: finish and hand off

Status: release conditions remain unmet; current tooling/docs describe a prototype.

- [x] ~~Add the supplied anvil-and-hammer image to the centered README header with a local asset and alt text.~~ Branding only; supported release packaging remains open.
- [ ] Resolve release-critical findings and publish the tested agent/version capability matrix.
- [ ] Package the supported adapter product with reproducible setup, controls, evidence, and limits.
- [ ] Verify reproduction in a clean environment and actual hosted CI execution.
- [ ] Meet the two-agent portable-release gate or explicitly scope an earlier preview.
- [ ] Complete the supported handoff/publication or document the decision to archive.

Release readiness means reproducible adapter setup, explicit opt-in modes, supported
agent/adapter/model/environment versions, bounded behavior, predictable cancellation,
privacy-aware log handling, and a documented disable/uninstall path. Publish a
capability matrix distinguishing observation, file/read evidence, recovery delivery,
cancellation, and usage accounting for each tested agent/version. The portable
adapter release needs live evidence for at least two existing agents and the
capabilities its recovery policy requires. An earlier OpenCode-only preview must
state that scope. Do not advertise universal agent or model compatibility.

Choose the smallest distribution mechanism supported by the verified agents;
a private package and installation instructions may suffice before considering
a public npm release. A local API or CLI can be added for an evidenced adapter
need later; neither a public service nor a standalone coding agent is required.

Ship policy/config versions, task licenses/provenance, shareable sanitized traces,
manifest/schema references, reproduction commands, analysis and results, known
limitations, and successful/unsuccessful examples. If raw tasks or logs cannot be
shared, document the access limit and supply a lawful inspectable reproduction.
Have another developer follow the instructions in a clean environment. Run the
quality gate and actual hosted CI once the relevant changes are available there;
neither config parsing nor replay substitutes for that execution.

Resolve release-blocking findings; retain justified open issues with scope.
Publication, remote CI dispatch, paid compute, or global setup is a separate user
decision. A valid finish may instead be an archived experiment plus evidence and
an explanation of why its mechanism should not expand.

## Immediate work packet

The workspace now has a shared observer, an OpenCode mapper, an internal adapter
contract, validated log import/integrity reporting, and a task-preparation template.
One [development task](tasks/README.md) now has concrete setup, acceptance, and
allowed-change validation; its live access isolation remains unverified.
Continue independent work here: populate actual task records with executable setup
and external checks, address remaining experiment-critical observation gaps, and
inspect a second agent's integration capabilities without claiming support. A
template alone does not complete task preparation. Keep these steps separate from
installing a model locally.

The next live milestone needs a compatible execution environment made available
separately. Do not replace that missing environment with replay evidence. Once it
is available, complete this small evidence packet:

1. Record one working existing-agent/model configuration, starting with OpenCode,
   including execution/inference hosts, hardware, agent/adapter/server versions,
   inference settings, capability evidence, and the run manifest.
2. Demonstrate a native read-edit-test cycle in an isolated checkout and retain
   the actual tool and test outcomes.
3. Capture a live replacement failure with correct session/call/file attribution;
   expose missing observations and preserve native behavior. Label induced cases
   `constructed` and distinguish them from replay-only checks.
4. Test focused recovery-message delivery and cancellation in a controlled
   session. Record timing, once-only delivery, permission handling, and any work
   continuing after abort. Use a declared manual stop rule if needed; do not claim
   strict automated budget enforcement without evidence. A failed transport test
   leaves the following ordinary batch passive.
5. Run a predetermined small batch of prepared ordinary tasks using native
   recovery, with fixed total allowance and external final checks. Retain every
   attempted outcome, unsuccessful cost, human intervention, and measurement gap.

Deliver the configuration/run manifests, task setup and acceptance-validation
records, separate controlled and ordinary traces, and a short Gate A assessment.
The immediate question is whether the real runtime can be observed and controlled
reliably enough to support the proposed experiment. Build the runner and recovery
policy only after this evidence supports the corresponding next phase. Complete
Phase 5a before finalizing the product's claim to work across existing agents.

No calendar or compute estimate is promised yet. After the first ordinary pilot,
estimate effort from engineering spike results, time per task, task independence,
needed repetitions and available local inference throughput. Proceed phase by
phase; later stages are conditional on the preceding evidence gates.
