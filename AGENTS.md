# Developing FORGE

This file is the entry point for repository development instructions. See
[README.md](README.md) for use, [docs/pilot.md](docs/pilot.md) for the evaluation
protocol, [docs/integration.md](docs/integration.md) for integration evidence, and
[docs/quality.md](docs/quality.md) for development tooling and verification limits.
For research design, follow [docs/roadmap.md](docs/roadmap.md).

## Product direction

FORGE is a recovery adapter layer around existing coding agents. Read
[docs/architecture.md](docs/architecture.md) for ownership and the internal adapter
contract. Keep shared observation and future recovery decisions independent of
native hook payloads, tool names, and diagnostic strings. Put each agent's mapping
and control transport in its adapter. The existing agent owns its model connection,
coding loop, tools, history, permissions, and native safeguards.

OpenCode is the first observation adapter. Additional agents need their own
verified integrations; a synthetic fixture or compatible model API does not prove
support. The portable release requires live capability evidence for a second
existing agent. Keep evaluation runner work separate from the product adapter and
the development harness. A new coding agent, model client, or general orchestrator
is outside the product scope.

The user reports that this development machine cannot host a local model. Continue
tests, constructed replay, task preparation, and adapter work without a model here.
Live experiments need a compatible execution environment and recorded agent/model/
server settings. Do not install a model locally or silently substitute remote/paid
inference or a different study configuration.

## Current implementation

- The development harness is Codex; OpenCode is the initial integration under
  observation. Keep development configuration separate from evaluated agents.
- The implementation is JavaScript ES modules on Node.js >=22 with no runtime
  dependencies. Biome is a pinned development dependency. Python files are observed
  task inputs, not the implementation language. The constructed demo also requires
  `python` on PATH.
- `src/observer.mjs` records bounded JSONL observations, Python file hashes,
  read evidence, adapter-supplied failure candidates, and previous-attempt comparisons
  through neutral record methods.
- `src/adapters/opencode.mjs` maps native hooks/events, diagnostic strings, and
  read metadata into the observer. `.opencode/plugins/forge-observer.js` is its
  deployment entry point and returns no hooks unless `FORGE_OBSERVE=1`.
- `scripts/demo.mjs` replays constructed hook calls; `scripts/summarize.mjs`
  summarizes one log. `src/observation-log.mjs` validates supported log envelopes
  and reports lifecycle/tool integrity. Summarize exits 0 for closed records,
  2 for an incomplete measurement with JSON output, or 1 for invalid/unreadable
  input. Closed records do not establish complete capture or task acceptance.
- Node tests cover OpenCode behavior, the shared adapter boundary, log import,
  and CLI reporting. `docs/task-manifest.example.json` is a preparation template;
  it is not a validated task or implemented acceptance evaluator.
- `docs/tasks/` contains a concrete Boltons development-task record and external
  preparation checks. A task-specific check is not a general evaluation runner;
  its live readiness and evaluator/reference isolation remain separate gates.
- Recovery actions, comparison baselines, experiment-wide independent evaluation,
  and measured benefits are planned, not implemented. Candidate counts do not
  establish task completion or real-world failure frequency.

## Development commands

Run from the repository root. In Windows PowerShell use `npm.cmd` because this
machine blocks `npm.ps1`; elsewhere use `npm` or the direct Node commands.

| Workflow | Command | Direct equivalent |
| --- | --- | --- |
| Install pinned development tools | `npm.cmd ci --ignore-scripts` | — |
| Full non-mutating quality gate | `npm.cmd run quality:check` | Biome check, then `node --test` |
| Formatting validation | `npm.cmd run format:check` | — |
| Correctness linting | `npm.cmd run lint` | — |
| Optional formatting edits | `npm.cmd run format` | — |
| Existing tests | `npm.cmd test` | `node --test` |
| Constructed demo | `npm.cmd run demo` | `node scripts/demo.mjs` |
| Summarize a log | `npm.cmd run summarize -- <log.jsonl>` | `node scripts/summarize.mjs <log.jsonl>` |

Run existing tests after behavior changes. For observer or adapter changes,
cover unchanged repetition, valid retries after file changes, session isolation,
duplicate events, and observation failures as appropriate. Use the demo when a
hook-contract smoke check helps; it does not verify loading in OpenCode.
Biome covers JS/ES modules and JSON, including the hidden OpenCode adapter and new
files; it excludes generated `.forge/`, dependencies, build output, and the npm
lockfile. Follow `biome.json`: two spaces, double quotes, semicolons, LF endings.
There is no type-check or build step for this JavaScript prototype. GitHub Actions
runs the same quality gate on Windows and Linux. Keep fixes separate from checks.

## Quality workflow and review

Inspect the task scope and acceptance conditions, make a small change with relevant
behavior tests, then use cheap formatting/lint checks while iterating. Before
handoff, run `npm.cmd run quality:check`, review the selected changes, fix supported
findings, and rerun affected checks after the final edit. Report checks as PASS,
FAIL, NOT RUN, or NOT APPLICABLE; do not hide a failed stage or claim review proves
correctness. The gate does not call a model or require a model endpoint.

Repeat: complete the current step, run QA and fix supported findings, update
`docs/roadmap.md`, then continue to the next step. Before moving on, update both
the implementation record and the checklist inside the relevant phase. Check and
cross out only work whose stated scope passed QA; retain evidence, partial work,
NOT RUN checks, and unmet dependencies. A phase stays open until its actual exit
condition is met. If the next step needs unavailable evidence or an execution
host, record that dependency and continue independent authorized work.

For a meaningful change, review it in the current Codex session or request native
review (`/review`; CLI `codex review --uncommitted` includes staged, unstaged, and
untracked files). State the chosen scope first. Inspect `git status --short`,
`git diff`, `git diff --cached`, and relevant new files; for a branch comparison,
verify the requested base and merge-base before using `codex review --base <base>`.
Do not assume `main`, stage unrelated files, or attribute pre-existing work to the
task. When working in a dirty tree, compare with the task's starting contents.

Read surrounding code and callers. Prioritize concrete contract breaks, swallowed
failures, misleading success, async races, resource leaks, and violations of the
adapter/observer boundary. For existing FORGE behavior, check capture bounds,
valid retries after file changes, session isolation, duplicate events, and cumulative
token accounting. Do not invent checks for the unimplemented recovery controller.
Report each supported finding with file/line, severity, separate confidence,
failure scenario or maintenance cost, evidence, and a practical fix. Keep findings
advisory unless a concrete defect or explicit requirement blocks completion; omit
formatter complaints, personal style preferences, and quotas for findings.

Simplification runs only on request or for a concrete clarity issue found in
review. Limit it to the selected change; preserve interfaces, observable outputs,
failure semantics, diagnostic logs, and relevant performance. Establish behavior
coverage first when needed, make the smallest refactor, then rerun checks and
review the final diff. Do not add speculative abstractions, remove diagnostics,
suppress warnings, or weaken tests. Review and simplification are on demand, with
no additional agent, automatic per-edit hook, or paid inference step in the gate.

## Experiment boundaries

- Keep the observer passive and disabled by default. Logging failures must leave
  native tool execution intact; preserve workspace and capture limits.
- Keep constructed and ordinary observations distinct. Logs under `.forge/`
  are ignored generated output and can contain captured tool text.
- Preserve user edits and native agent safeguards. Development setup must not
  silently change benchmark prompts, models, budgets, policies, or acceptance checks.
- Report missing measurements as unknown. Verify research and integration claims
  against primary sources before relying on them. Use the pilot protocol and
  roadmap for baseline requirements when implementing evaluation.
