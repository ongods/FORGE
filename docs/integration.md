# Integration readiness

FORGE is a recovery adapter layer around existing coding agents; see the
[architecture and internal contract](architecture.md) and [roadmap](roadmap.md).
`src/observer.mjs` accepts normalized records. Native hook/event decoding,
diagnostic recognition, and read metadata live in `src/adapters/opencode.mjs`;
`.opencode/plugins/forge-observer.js` is the opt-in deployment entry point.
The agent owns its model connection, coding loop, tools, history, and safeguards.
Record actual agent/adapter versions in the [run manifest](run-manifest.example.json);
the nullable `opencode_version` log field does not establish a supported version.

## Capabilities and limits

| Integration/capability | Available evidence | Remaining limit |
| --- | --- | --- |
| OpenCode observation mapping | Contract tests and constructed replay | Live loading, native read-edit-test, and actual failure capture remain unverified |
| Shared core with different tool/argument names | Synthetic normalized-event fixture with read/version/session/duplicate checks | This is not another live agent integration |
| Log import and integrity reporting | Schema/identity validation, lifecycle/tool checks, and CLI regression tests | Consistency does not authenticate events or establish complete capture or task correctness |
| Recovery delivery and cancellation | Planned per-agent capability checks | No implemented recovery controller or verified strict-budget mechanism |
| Second existing-agent adapter | Required by the portable-release roadmap | No second adapter selected, implemented, or live-verified |

The [second-agent interface screen](agent-integration-candidates.md) records primary
sources for Goose and Aider. It establishes neither runtime support nor selection.

The summary CLI exits 0 for closed records, 2 for incomplete measurements with
JSON output, and 1 for invalid or unreadable input. `verified_task_completion`
remains null even when tool output claims tests passed. The task manifest is a
preparation template, not a validated task or implemented acceptance evaluator.
`session_error_records` exposes captured native error records without copying
their payload text into the summary. Duplicates/global errors count as records;
these counts and CLI exit codes do not classify a task outcome.

## Runtime verification

The user reports that this development machine cannot host the local model.
Local model installation is not a development prerequisite. Live evidence needs
a compatible execution environment and a recorded agent/model/server/host
configuration. No substitute endpoint, paid service, or study model is implied.

1. Record the actual runtime versions, provider/model settings, execution and
   inference hosts, budgets, and capability evidence in the run manifest.
2. Verify the plugin loads with `FORGE_OBSERVE=1` in a fresh OpenCode process.
   Initialization alone is insufficient; confirm actual tool start/finish records.
3. Demonstrate native read-edit-test and live failure capture with correct
   session/call/file attribution while preserving native behavior. Label induced
   cases `constructed` and keep them separate from ordinary observations.
4. Verify recovery delivery and cancellation separately before claiming those
   capabilities or strict budget enforcement.
5. Prepare actual task records and external acceptance checks, then collect
   ordinary runs under the [pilot protocol](pilot.md), retaining all outcomes.

Contract tests cover thrown failures, duplicate terminal events, read evidence,
file changes, session isolation, logging failures, successful retries, once-only
disposal, and suppression of late capture. The
constructed demo includes a real Python parser error. These checks do not run
OpenCode or a model. Choose recovery rules only after reviewing ordinary failures;
verify a second existing-agent adapter before the portable product release.

## Interface references

The adapter references OpenCode's [plugin documentation](https://opencode.ai/docs/plugins/)
and versioned source for the [plugin interface](https://github.com/anomalyco/opencode/blob/v1.18.23/packages/plugin/src/index.ts),
[tool execution](https://github.com/anomalyco/opencode/blob/v1.18.23/packages/opencode/src/session/tools.ts),
[edit diagnostics](https://github.com/anomalyco/opencode/blob/v1.18.23/packages/opencode/src/tool/edit.ts),
and [read metadata](https://github.com/anomalyco/opencode/blob/v1.18.23/packages/opencode/src/tool/read.ts).
These are interface references, not certification of an installed runtime.
The mapper uses terminal events for thrown errors and deduplicates successful
hooks/events by session/call; observation stays disabled unless explicitly enabled.
