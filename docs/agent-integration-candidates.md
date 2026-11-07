# Second-agent integration candidates

Primary-source inspection: 2026-11-07 (Asia/Singapore). Scope: Goose and Aider only.
This is an interface screen, not a selection, implementation, or compatibility
claim. No agent, model, server, or integration was run. No supported release or
version has been established for either candidate.

Follow the [adapter admission requirements](architecture.md#admission-of-another-agent).
The existing agent must retain its model connection, coding loop, tools, history,
permissions, and safeguards. An adapter can consume native events and deliver
native requests; implementing another agent with either project's libraries would
exceed FORGE's product scope.

## Documented interfaces

| Requirement | Goose | Aider |
| --- | --- | --- |
| Programmatic entry point | Existing `goose acp` binary over stdio; `goose serve` also exposes ACP over HTTP/WebSocket. [Goose ACP guide](https://goose-docs.ai/docs/gdk/acp/) | CLI `--message` / `--message-file` processes one instruction and exits. Repeated `Coder.run(...)` calls are illustrated, but the Python API has no compatibility guarantee. [Scripting](https://aider.chat/docs/scripting.html) |
| Session and call identity | Guide describes `session/update` notifications with session IDs and matching `toolCallId` values for `tool_call` / `tool_call_update`. [Goose ACP guide](https://goose-docs.ai/docs/gdk/acp/) | The inspected scripting/options pages do not establish a supported event stream with session/call IDs. History-file options document conversation logging. [Options](https://aider.chat/docs/config/options.html) |
| Success, failure, file/read evidence | ACP v1 defines `completed` / `failed` statuses, optional raw input/output, file locations, and read/edit kinds. These are protocol fields, not verified Goose payloads. Reporting initial calls is a SHOULD requirement. [ACP tool calls](https://agentclientprotocol.com/protocol/v1/tool-calls) | The inspected public scripting documentation does not establish per-edit terminal events or read-version/range evidence. That remains unknown, rather than proof that no integration is possible. [Scripting](https://aider.chat/docs/scripting.html) |
| Recovery request delivery | Follow-up `session/prompt` with the same session ID retains context. This establishes a documented message route, not context-only injection or safe delivery during a running turn. [Goose ACP guide](https://goose-docs.ai/docs/gdk/acp/) | Python examples retain a coder object across instructions. This is a possible between-turn route through an unsupported API; in-flight delivery is unestablished. [Scripting](https://aider.chat/docs/scripting.html) |
| Cancellation | Guide identifies `session/cancel` for the active turn. [Goose ACP guide](https://goose-docs.ai/docs/gdk/acp/) | Interactive Control-C interruption retains the partial response in the conversation. This does not establish programmatic cancellation, subprocess cleanup, or a strict stop deadline. [In-chat commands](https://aider.chat/docs/usage/commands.html) |

The current Goose repository links its official documentation at
[goose-docs.ai](https://github.com/aaif-goose/goose). The former `block/goose`
repository URL redirects there. The inspected documentation is moving material,
not evidence that an installed or released binary implements every interface.

## Inferences and unresolved evidence

Goose's structured transport is a plausible way to connect the shared observer
without decoding terminal presentation. That is an engineering inference. ACP file
locations are optional display metadata, not proof of an exact read range or file
version. Missing metadata must remain unknown. Replay after session loading must
also be distinguished from new execution to avoid duplicate observations.

For Aider, CLI automation alone does not close the event-identity and read-evidence
gaps. Parsing transcripts or instrumenting internal Python objects would add
maintenance assumptions that need separate investigation. Do not describe those
possibilities as an existing supported adapter.

Cancellation needs live evidence for both candidates: acknowledgement, final
events, native tool outcomes, and work continuing after interruption. The
[ACP cancellation specification](https://agentclientprotocol.com/protocol/v1/cancellation)
explicitly distinguishes optional request cancellation and optional propagation to
nested terminal requests; a protocol notification alone cannot prove all child
processes stopped.

Model-server support is a separate question. For example, Aider documents
[connecting to Ollama](https://aider.chat/docs/llms/ollama.html); that establishes
provider configuration, not FORGE observation/control compatibility or tool-calling
quality. No model installation or inference substitution is implied here.

Before selecting or implementing a second adapter, pin a candidate release and
inspect its actual event/control mapping. Then, on a compatible execution host,
record native read-edit-test and replacement-failure traces, stable identities,
missing/duplicate terminal events, read uncertainty, permission behavior, bounded
delivery, and cancellation. Retain native history and safeguards. Publish only
capabilities demonstrated by those traces; neither candidate currently passes
FORGE's second-agent release gate.
