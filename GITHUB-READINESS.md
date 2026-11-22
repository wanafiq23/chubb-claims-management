# CHUBB GitHub readiness report

Verified on 2026-11-22. **Ready for a local Windows assessment/demo repository, with the documented limitations below.** The original verification preceded the initial Git commits. The repository now has an origin remote at https://github.com/wanafiq23/chubb-claims-management. This is not a production deployment security certification.

Latest startup changes: the single broker now has a local hostname mapping, and the launcher waits up to 180 seconds and automatically recreates it once on `UnknownHostException: kafka`, preserving its data volume. Compose configuration and simulated CMD startup/recovery checks passed. Docker Desktop was stopped during this follow-up, so these latest changes have not been verified with a live broker; the live results below describe the earlier configuration.

## Reproducibility and scope of verification

The repository was copied using the files Git would include, excluding local databases, node_modules, bin/obj/dist, Angular caches, test reports and Git metadata. Both clean copies used normal full Windows paths containing spaces. No existing application database or installed project dependency directory was copied.

The first copy installed npm and locked NuGet dependencies into new empty caches. It ran a separate Kafka Compose project with a brand-new named volume, a new root SQLite database, and isolated API/frontend ports. The real Kafka publisher remained enabled throughout browser workflows and the outage test. The original application, SQLite files and Docker volume were preserved.

A second source-only copy tested the documented one-command path: **only `start.cmd`**, with no installed node_modules or generated backend files and with another pair of empty dependency caches. It automatically installed/restored dependencies, started both service windows, and passed readiness checks with a new SQLite database. This second copy reused the isolated broker already tested with a fresh volume.

This verifies clean checkout/ZIP-equivalent source on the available Windows computer. It was not a remote GitHub clone or a newly installed Windows VM: at verification time no GitHub repository/remote had been configured, and the host prerequisites were already installed.

## Executed results

| Check | Result |
| --- | --- |
| Source-only copies contain no existing databases/dependency/build folders | Passed |
| Fresh-cache `npm ci` | Passed |
| Fresh-cache `dotnet restore --locked-mode` | Passed |
| Fresh Docker named volume, automatic ownership setup, broker health and topic creation | Passed |
| Windows CMD launcher fresh backend/frontend branches | Passed |
| Launcher automatically installs dependencies in a second source-only copy | Passed |
| First SQLite schema creation; Customer/Staff/Manager protected reads initially show zero claims | Passed |
| Backend integration suite | **20 passed, zero failed/skipped** |
| Angular production build | Passed; initial bundle 310.20 kB, estimated transfer 85.01 kB |
| Application and Playwright-source TypeScript checks | Passed |
| Desktop Chrome suite against clean copy, Kafka enabled | **9 passed, zero failed/skipped; 36.7 seconds** |
| Live Kafka smoke test | Passed; consumed the new claim's matching ClaimSubmitted event |
| Real broker outage: REST save and durable pending outbox row | Passed |
| Broker recovery: pending row acknowledged/published and matching event consumed | Passed |
| .gitignore probes | **19/19 sensitive/generated paths excluded**; required source/configuration/lockfiles retained |
| Publishable source secret/personal-path scan and manual configuration review | No private credentials or personal paths found |
| npm production dependency vulnerability audit | **0 vulnerabilities** |
| Locked .NET direct/transitive vulnerability audit | No vulnerable packages reported by the configured public source |

The Chrome suite covers Customer submission/list/detail/documents, Staff shared queue/review/estimates/information requests/decisions, customer replies and attachments, Manager totals/drill-down/polling, approval and rejection, privacy, invalid inputs, missing resources, role/ownership checks, logout, stale-version recovery, and partial upload recovery. Backend tests additionally cover transactional rollback and outbox retry/ordering/acknowledgement behavior. Backend integration tests use a fault-injecting publisher; the separate smoke/outage checks used the real isolated Kafka broker.

Final consistency review after the README rewrite reconfirmed all 81 manifest entries, documentation links/anchors, frontend/backend enums and upload limits, Kafka settings, proxy and default URLs. TypeScript checks and the production build passed again. A normal backend test build hit the running API's Windows EXE lock; a rerun using isolated temporary build output passed all 20 tests without stopping the app. The docs now explain stopping the API or using a separate checkout for normal test builds. The previously passed Chrome/Kafka checks were not rerun for these documentation-only corrections.

Verified host tools included .NET SDK 10.0.404, Node 22.20.0 and Docker Compose 5.7.0. The project targets .NET 10 and Angular 21. Docker Compose v2+ must support the commands listed in README. Tests used installed desktop Chrome, not downloaded Playwright browser binaries.

## Changes made for first-run reliability

- Added a one-shot `kafka-storage-init` service that sets the new named volume directory owner to Kafka's UID 1000 before broker startup. It does not delete or recursively rewrite existing data.
- Added optional API/frontend/Kafka port overrides for isolated local verification; normal addresses remain 5080/4200/9092.
- Replaced the fixed JSON Angular dev proxy with `proxy.conf.cjs`, supporting the API port override while preserving the default API and same-origin requests.
- Made `start.cmd` restore locked .NET dependencies and keep Kafka publishing enabled. Replaced Windows `timeout` with a non-interactive PowerShell sleep so redirected input cannot skip the readiness delay.
- Added public-only `NuGet.Config`, `Directory.Build.props` and both NuGet package lockfiles. The existing npm lockfile is committed alongside all source.
- Added the missing `@types/node` development dependency, a browser-test tsconfig and a `typecheck` script. The previously documented optional browser-test typing limitation is resolved.
- Added `scripts/test-kafka.ps1`, which creates one labelled test claim and verifies its matching lifecycle event through Docker's Kafka consumer.
- Expanded `.gitignore` and added `.gitattributes` for Windows script line endings.
- Updated README, frontend README and API documentation with portable Windows CMD instructions. Historical AI journal entries remain intact; the latest entry records current results.

No customer/staff/manager business logic, EF schema, REST contracts, authentication rules or desktop styles were changed.

## Run after cloning or downloading the ZIP

Install the .NET 10 SDK, compatible Node.js 22/npm, Docker Desktop with Linux containers, and Chrome. Start Docker Desktop. Extract the repository or clone its eventual published GitHub URL, then open **Windows CMD** in its root:

```cmd
cd /d "C:\Projects\CHUBB"
.\start.cmd
```

Use your actual extracted folder if different. Open **http://localhost:4200**. Select Customer, Claims Staff or Manager, then Continue. No password or database seed command is needed. Customer defaults to Alice; Bob's backend token is available for ownership testing. Keep the backend/frontend CMD windows open.

Explicit install and verification commands, also from the root:

Stop the backend before the normal `dotnet test` command on Windows, or run it from a separate checkout. A running backend EXE can lock its build output; this does not require deleting the database.

```cmd
dotnet restore Chubb.sln --locked-mode
npm.cmd --prefix frontend ci
dotnet test Chubb.sln --no-restore
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run build
```

With the app running against a test database:

```cmd
npm.cmd --prefix frontend run test:e2e
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test-kafka.ps1
```

Browser and Kafka smoke tests create real test records. Use a separate checkout/database for these. Kafka remains enabled. See README for manual three-terminal startup, broker event inspection, alternate ports and shutdown.

## Security and remaining limits

- Demo tokens are intentionally public development credentials, not production passwords. Demo authentication is disabled outside Development/Testing. Do not expose the demo API or dev server publicly. Host bindings use loopback; local Kafka is PLAINTEXT.
- Full npm audit reports **16 moderate development-tool advisories**, with no high/critical findings, in Angular CLI's transitive glob/minimatch chains. Production dependencies are clean according to the current audit. No forced incompatible framework change was applied. Review upstream compatible fixes before using this tooling with untrusted build inputs.
- No credentials are needed for public NuGet/npm packages. The SQLite connection string and Kafka cluster identifier are local public configuration, not account secrets. Real env files, user databases, uploaded document bytes, certificates, private keys and local secret configuration are ignored. Ignore rules do not protect files manually force-added with `git add -f`.
- No actual private keys, API keys, passwords, connection credentials or personal machine paths were found in the publishable source scan/manual review. Scan results are bounded to the current source snapshot; do not add real claims or credentials later.
- Existing MVP limits: one API/dispatcher replica, SQLite document blobs and in-process report aggregation, EnsureCreated rather than schema migrations, signature checks without malware scanning, no submission idempotency, and at-least-once Kafka delivery with consumer deduplication and no outbox pruning job. No payments, claim reopening or completed-claim search is provided.
- Production static hosting requires SPA fallback and an API reverse proxy. Production identity, TLS, rate limiting, backups and operational retention/alerting are outside this local assessment.
- Start from the normal full Windows folder path, not an 8.3 alias such as a short-form temporary path. The first diagnostic run used an alias and produced duplicate dev-server Angular modules; restarting from the canonical path with a fresh generated Angular cache resolved it. The final Chrome run used the canonical path successfully.
- Fresh package restores require Internet access. One initial native Kafka package download was retried automatically after a truncated network response; the restore then succeeded. No physical second Windows machine, new OS installation, alternate browser engine, or public deployment was tested.

## Git state and what to commit

The folder initially had **no Git metadata or history**. Local Git was initialised on `main` solely to validate status and ignore rules. At that verification stage there were no commits, staged files or remotes, and nothing had been pushed. Commits and the origin remote were added afterward. Existing databases and any external Git history were not deleted or modified.

`COMMIT-FILES.txt` lists all **81** candidate source/documentation/configuration files. All listed files are currently untracked and should be reviewed and included in the initial commit. It includes frontend/backend source, npm/NuGet lockfiles, tests, public configuration, scripts, API docs, this report and AI-JOURNAL. Generated files and local data are excluded. The final Git dry run succeeded, matched the manifest, and left the index empty.

Review locally before submission:

```cmd
git status --short --untracked-files=all
git add --dry-run .
```

**Not performed:** staging, committing, adding a GitHub remote, or pushing. The remaining submission step is your review and initial commit followed by publishing to the GitHub repository you choose. There are no known missing application dependencies or required source files after the fixes above.
