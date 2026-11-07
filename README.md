# FORGE

FORGE is a recovery adapter layer for existing coding agents. A shared core tracks
file state and previous attempts; agent-specific adapters connect it to native
events and will deliver recovery through supported controls. It asks whether that
evidence improves recovery beyond the agent's normal behavior and credible
current-error rules.
No recovery benefit has been measured yet.

This first increment is an **observation-only OpenCode plugin**. It records ordinary
tool runs so we can manually check whether unsuccessful text replacements and
Python syntax errors are worth targeting. It does not request recovery, edit task
files, modify tool results, or change OpenCode's native safeguards.

OpenCode is the first integration. The product is intended to support additional
existing agents through tested adapters. Only OpenCode observation is implemented;
live integration and compatibility with another agent remain unverified. The
existing agent owns its model connection, tools, conversation, and permissions.
See the [product architecture and adapter contract](docs/architecture.md).

## Try the mechanism without a model

Node.js 22 or newer is sufficient for tests. No runtime npm dependencies are needed.
The demo also needs `python` on PATH.

```powershell
node --test
node scripts/demo.mjs
```

The demo replays constructed OpenCode hook inputs, including repeated failed
edits, a retry after a file change, and a successful test response. It also runs
the real Python parser on invalid code and replays that error. All demo records
are labeled `constructed`. The test response is simulated; neither the demo nor
tests run OpenCode or a model. These checks establish mechanisms, not real-world
failure frequency or recovery benefit.

## Observe an ordinary OpenCode run

The project plugin is `.opencode/plugins/forge-observer.js`. It stays off unless
the OpenCode process inherits `FORGE_OBSERVE=1`. OpenCode discovers local plugins
at startup; reload the project in a fresh process after enabling observation.

For an installed Windows desktop app, adjust the executable path as needed:

```powershell
$env:FORGE_OBSERVE = '1'
& "$env:LOCALAPPDATA\Programs\@opencode-aidesktop\OpenCode.exe"
```

Exit any already-running desktop instance first so that it receives the new
environment variable, then open the task repository. This repository already has
the plugin; to observe another repository, copy the `src/` directory and
`.opencode/plugins/forge-observer.js` preserving their relative layout. The entry
point imports `src/adapters/opencode.mjs`, which uses the shared observer.

If a CLI is separately installed, start `opencode` from the task directory in
the same shell after setting the variable.

Configure the existing agent with the study's recorded model before a live pilot.
The user reports that this development machine cannot host the local model. Tests
and constructed replay can run here; live experiments need a compatible execution
environment and a working model served to the agent. No model or endpoint has been
selected, and FORGE does not install one or provide a model client. Record the
actual execution/inference hosts and settings before runs. The environment variable
above enables logging, not a model.
For deliberately induced stress cases, set `FORGE_OBSERVATION_ORIGIN=constructed`
before starting OpenCode; otherwise the origin defaults to `ordinary`. Keep those
cases separate from ordinary pilot tasks.
To disable logging, remove the variable and restart OpenCode:

```powershell
Remove-Item Env:FORGE_OBSERVE
```

Each observer instance writes `.forge/observations/<run-id>.jsonl`, one JSON record
per line. Seeing `observer_started` proves plugin initialization; verify actual
`tool_started` and `tool_finished` records before collecting pilot data. Live
OpenCode loading and model runs still need verification.

```powershell
node scripts/summarize.mjs .forge/observations/<run-id>.jsonl
```

Summaries retain successes and failures, list candidates for manual review, and
leave final task acceptance unknown. A tool marked `completed` may contain a
nonzero shell exit or failed tests. Candidate syntax-error text can also be quoted
or printed intentionally. Always inspect the underlying evidence.

`session_error_records` counts captured native session-error records, including
duplicates and errors without a session ID. It does not count distinct incidents
or failed tasks, and zero does not prove there were no runtime errors. Keep it
separate from `tool_errors`; summing them does not yield unique failures. Captured
error text stays in the original log and is not copied into the summary.

The importer checks the schema-1 envelope, run/origin consistency, and identifiers
and statuses used by the summary. Malformed, unsupported, or mixed-run/origin logs
are rejected; captured tool text is not echoed in parse diagnostics. This is not
validation of every captured payload or proof that a reported read was sufficient.
Existing schema-1 observation files remain supported.

`observation_integrity` reports missing shutdown or tool records, duplicates,
ordering/identity conflicts, and inconsistent pending-call counts. Its `closed`
status means those records are consistent, not that all runtime events were
captured. Check `tool_capture_observed`; initialization alone does not prove hooks
worked. Incomplete logs retain available counts with explicit issues. CLI exit
codes are 0 for a consistent closed log, 2 for an incomplete log with a JSON
summary, and 1 for invalid/unreadable input or missing arguments. Treat these as
measurement results; task acceptance remains unknown until checked externally.
The integrity check cannot authenticate a log or detect every omitted or invented
event. A tool's success text is not independent evidence of a correct repair.

## What is recorded

- Attempted tools, arguments, outputs or reported errors, and session/call IDs.
- SHA-256 hashes (content fingerprints) of directly addressed Python files before
  and after tools, up to 1 MiB; file contents are not separately copied.
- Successful read ranges when available, with file-version evidence. A partial
  read does not establish that the agent saw the relevant edit region. Missing,
  malformed, or empty native ranges remain unknown; requested lines and result
  text do not supply missing coverage.
- The previous candidate failure on that file within the same session, whether
  its action and file bytes match, and observed model parameters and token usage.
  `null` means unknown; a changed hash is not evidence of progress.
- Tool durations and partial observer work timings. These are not full task
  duration or an isolated estimate of the observer's causal overhead.

Logs include literal tool arguments and outputs, which can contain private source
or secrets. `.forge/` is ignored by Git. Review logs before sharing. Text is capped
at 16,000 JavaScript string code units per captured field, with a hash of the full
original text. File snapshot limits count bytes; text capture does not count UTF-8
bytes or user-perceived characters.

Snapshots are sampled outside the tool's own file lock and do not prove the exact
bytes used by a concurrent tool. Changed-during-read snapshots are uncertain.
Only `read`, `edit`, and `write` with `filePath` yield file snapshots; shell paths,
patch tools, external files and larger files have unknown versions. Only explicit
supported replacement messages and Python exception-style syntax messages are
candidates; other diagnostics can be missed. Manual review must check misses too.

The observer records at most 10,000 distinct tool calls per instance, then disables
itself with a warning. I/O failures also disable logging without breaking agent
tools. Invalid required identities or terminal statuses likewise disable capture
before writing unusable records; the existing valid prefix remains incomplete.
Conflicting tool names or terminal statuses for one session/call also disable
capture; ordinary same-tool/status duplicates still count once. Conflicting
reports do not establish which tool outcome actually occurred.
Missing terminal records and incomplete logs require a reporting decision,
not an assumed success. `dispose` drains already queued observations and records
shutdown once; repeated calls share that result, and later callbacks are ignored.
Pending native calls remain incomplete evidence; disposal does not cancel them.
Abrupt shutdowns or logging failures may omit the shutdown record. Budgets,
acceptance results, exact OpenCode version,
and inference-server settings require the [pilot manifest](docs/run-manifest.example.json).

## Next experiment

Follow the [pilot protocol](docs/pilot.md): collect ordinary runs, including
successful ones, and manually check both error types before developing recovery
rules. The adapter follows the documented plugin API and versioned source;
see [integration evidence and current status](docs/integration.md).

The [roadmap](docs/roadmap.md) includes a second existing-agent adapter and live
capability checks before a release claims support across agents. A model server
alone is not a coding-agent integration. Recovery comparisons use each existing
agent's own native behavior as its baseline.

Prepare each real task using the [task record template](docs/task-manifest.example.json).
It records setup, allowed edits, external checks, and starting/reference validation;
it is not an executable task or evaluator. Keep filled records and hidden answers
outside agent access. Fix the pilot batch and total allowance before observing
outcomes, as described in the [pilot protocol](docs/pilot.md).

The [first concrete development task](docs/tasks/README.md) has task-specific
preparation checks; live-agent readiness and isolation are still separate gates.

Recovery comparisons, a controller, and a DARC-inspired baseline are future work.
There are no research results yet.

See the [end-to-end roadmap](docs/roadmap.md) for implementation phases,
acceptance checks, comparison design, and continue/simplify/stop decisions.

## Development checks

Install the pinned development tool and run the non-mutating quality gate:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run quality:check
```

Use `npm` in other shells. The gate runs Biome formatting/correctness linting and
the existing Node tests; it makes no model calls. `npm.cmd run format` applies
formatting separately. Review meaningful changes before handoff; simplify only
when requested or justified by a concrete review finding. See [AGENTS.md](AGENTS.md)
for the authoritative workflow and [development tooling](docs/quality.md) for
configuration, verification limits, and update instructions.
