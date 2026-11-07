# Development tooling

The development workflow and review policy live in [AGENTS.md](../AGENTS.md).
FORGE uses JavaScript ES modules on Node.js 22 or newer, Node's built-in test
runner, and an exact Biome development dependency. There are no runtime npm
dependencies, type-check command, or build stage. Python is needed only for the
constructed demo and observed task inputs.

## Setup and checks

Run from the repository root:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run quality:check
```

Use `npm` outside Windows PowerShell. Keep `package-lock.json`: installation
uses its resolved packages and integrity hashes. Biome's platform binary is an
optional dependency, so do not omit optional dependencies when installing tools.

The quality gate checks formatting and correctness linting, then runs the Node
tests. A failed Biome check prevents the test stage from running. Checks do not
apply fixes or call a model. Use `npm.cmd run format` for intentional formatting
edits; `format:check`, `lint`, and `test` are available separately.

## Configuration and coverage

`biome.json` covers `.js`, `.mjs`, and `.json` files recursively, including new
files and `.opencode/plugins/`. It excludes `.forge/`, `node_modules/`, `.git/`,
`dist/`, `coverage/`, and the generated npm lockfile. Markdown, YAML, and Python
task inputs are outside the mechanical formatting/lint gate.

Formatting uses two spaces, double quotes, semicolons, LF endings, and a
100-column print width. Correctness and suspicious-rule groups are enabled;
warnings fail the gate. Import-assist rewrites are disabled.
The repository's `.gitattributes` keeps text checkouts on LF even when Windows
Git enables automatic CRLF conversion, matching the formatter's requirement.

Node tests cover the shared observer, OpenCode mapping and plugin entry point,
log validation/integrity, CLI exit codes, and cumulative usage updates. Review
behavior changes for legitimate retries, session isolation, duplicate events,
capture bounds, and passive observation failures. Review documentation links and
CI YAML separately because Biome does not check those formats here.

The workflow in `.github/workflows/quality.yml` installs locked dependencies and
runs the same quality gate on Windows and Ubuntu. Action references are pinned
to commits; the selected project Node version is declared in that workflow.
Hosted execution must be checked on GitHub separately.

## Verification limits and maintenance

Tests and constructed replay establish local mechanisms, not live OpenCode
loading, model behavior, ordinary failure frequency, or recovery benefit. A closed
observation log does not establish complete capture or task acceptance. Follow
[integration readiness](integration.md) before collecting live pilot evidence.

To update Biome, inspect the intended release and compatibility, then install an
exact version:

```powershell
npm.cmd install --save-dev --save-exact @biomejs/biome@<reviewed-version> --ignore-scripts
```

Update the schema URL in
`biome.json`, review any configuration migration and lockfile changes, and rerun
the quality gate. Check file selection and failure propagation if tool behavior
changes. Review CI action updates and their pinned references separately.
