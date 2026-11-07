# Observation pilot

Purpose: determine whether the two supported failure types occur in ordinary
Python bug-fixing runs and whether avoidable repetitions consume meaningful effort.
This pilot does not test recovery effectiveness.

FORGE is an adapter around an existing coding agent. OpenCode is the first
integration; later adapters follow the [shared contract](architecture.md). Keep
the agent's model/provider connection, coding tools, history, permissions, and
native safeguards. Compare modes within one agent/model configuration; record
agent and adapter versions and separate observation/control capabilities.

The user reports that this development machine cannot host the local model.
Prepare tasks and test mechanisms here; a live pilot needs a compatible execution
environment supplied separately. Record the actual execution and inference hosts.
Do not treat constructed replay as a substitute for that missing live evidence.

1. Select an actual Python bug-fixing task and a fresh task checkout that preserves
   the user's working copy. Record its repository revision, task input and visible
   tests using `task-manifest.example.json`. Fill setup commands, allowed/protected
   edits, and an executable external acceptance check. Confirm the starting bug
   fails that check; where available, confirm a known correct repair passes the
   same check. Keep task/reference records outside agent access. The template's
   `not_prepared` status and empty lists do not establish readiness. Record missing
   evidence and unverified assumptions. Choose the first task batch, per-run limits,
   total execution allowance, and stopping rule before seeing outcomes. Keep a
   record of every attempted task, including stopped runs.
2. Fill out a copy of `run-manifest.example.json` outside the agent's task checkout.
   Populate the agent and adapter blocks, capability evidence, and execution/
   inference hosts. The legacy `opencode_version` field stays null for another
   agent; for OpenCode, keep it consistent with `agent.version`.
   Declare overall time/token limits and how the operator will stop the run. The
   observer does not enforce budgets; its remaining-allowance field is unknown.
3. Use the existing agent with normal safeguards. Enable the observer, verify it
   writes actual tool records, then run the task with the study's recorded model
   through the existing agent. Keep any change of model or inference environment
   explicit; do not silently change the declared experiment to make it runnable.
   Do not inject faulty edit instructions to create ordinary failures. Label
   deliberately induced failures and hook replays `constructed` separately.
4. Keep final acceptance checks outside the agent's context. Evaluate the resulting
   code independently; do not count weakened tests or evaluator changes as repairs.
   Record acceptance, unsuccessful stops, total wall time and human assistance in
   the manifest. Do not infer completion from a successful tool or an idle session.
5. Summarize the log and manually review all tool/session errors and a sample of
   successful calls, not just candidate flags. `session_error_records` counts
   captured records, including repeated/global errors; do not treat it as unique
   failures or failed tasks, add it to tool errors as a distinct-failure count, or
   infer no runtime errors from zero. Check syntax-looking output against the actual
   failed parser/test. Record detection misses, benign repetitions, native retries,
   stale information and possible interventions with call IDs as evidence. Retain
   the summary reference and `observation_integrity` status/issues in the run
   manifest's `observation_quality`. Exit code 2 preserves incomplete-log summaries;
   exit code 1 means the input could not be trusted/read. Record either case as a
   measurement issue and retain the original evidence. If no log exists after a
   startup failure, record that directly; the summarizer cannot recover absent data.
6. Retain runs without failures. Keep infrastructure and agent failures distinguishable
   and report both; do not silently exclude incomplete logs. A logging failure is a
   measurement issue, not evidence the agent failed or succeeded.

The log importer validates supported schema-1 envelopes, identity, and fields used
by summary counts, not every payload or the truth of the tool's output. A `closed`
log only has consistent lifecycle/tool records. Require actual tool capture and
manual runtime comparison before treating an adapter as live-verified. Incomplete
or invalid logs remain attempted runs and require a declared reporting decision;
they must not become automatic agent successes/failures or silently disappear.

For each candidate, record: genuine target failure or false positive; action and
file version; read range; subsequent native recovery; time/tools spent; and why an
available recovery action might change the outcome. A repeat is not automatically
avoidable, and a file change does not establish useful progress.

Before a later comparison, define identical recovery actions and overall budgets
for the current-error rule and state/history rule, preserve native safeguards, and
separate development tasks from unseen evaluation tasks/repositories. Add a faithfully
documented DARC-inspired comparison only if testing that extension claim. Choose
the primary outcome, worthwhile improvement and study size after pilot throughput
and variability are known, before confirmatory evaluation. No thresholds are set yet.
