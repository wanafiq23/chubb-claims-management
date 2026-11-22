# AI journal

Entries below are chronological. Earlier environment limitations describe those earlier checks; the latest GitHub-readiness entry supersedes them with clean-copy and live Kafka results.

## 2026-11-22 — Initial backend implementation

- Agent: OpenAI Codex, GPT-6 (the system identifies the model family as GPT-6; an exact serving snapshot is not exposed).
- Work: architecture, ASP.NET Core API, EF Core SQLite persistence, demo role authentication, documents, reporting, Kafka transactional outbox, integration tests, and operational documentation.
- Decisions: single backend process and shared staff queue; MYR represented as integer sen; application-managed GUID concurrency token; explicit customer DTOs; SQLite document blobs for atomic persistence; at-least-once Kafka delivery.
- Validation and limitations are recorded in README.md and the final implementation report. No other AI agents were used.

### Validation performed

- `dotnet restore Chubb.sln`: passed. The initial native SQLite dependency produced a security advisory; explicitly upgrading SQLitePCLRaw.bundle_e_sqlite3 to 3.0.2 removed the restore warning.
- `dotnet test Chubb.sln --no-restore --logger 'console;verbosity=minimal'`: passed, 20 tests, zero failures/skips; final build produced zero warnings.
- Tests execute against real on-disk SQLite with the ASP.NET Core HTTP pipeline and a fault-injecting Kafka publisher. Windows sandbox restrictions required running the test host outside the sandbox.
- A real local Kestrel server with Kafka publishing enabled and no reachable broker accepted the complete `scripts/demo.ps1` workflow. Its customer view hid the estimate, approval appeared in workload, and manager outstanding totals excluded it. The outbox worker logged delivery timeouts and retained pending events.
- The HTTP smoke test found SQLite DateTime.Kind loss; UTC read conversion and timestamp regression assertions were added. Earlier tests also found child GUID tracking problems; application-generated keys are now explicitly marked ValueGeneratedNever.
- `docker compose config --quiet`: passed. `docker version` confirmed the Docker daemon was unavailable. No broker container was started and live Kafka acknowledgement/recovery was not verified; retry and acknowledgement bookkeeping were tested using the fault-injecting publisher.
- Known MVP tradeoffs: fixed development tokens; one service replica/dispatcher; EnsureCreated instead of migrations; database document blobs; signature validation without malware scanning; at-least-once event delivery and no outbox retention job.

## 2026-11-22 — Angular frontend implementation

- Agent/model: OpenAI Codex, GPT-6, as identified by the session's developer instructions. An exact serving snapshot is not exposed. No sub-agents were used.
- Inspected the actual backend controllers, response DTOs, demo authentication, ownership rules, version preconditions, uploads and claim transitions before writing frontend code.
- Added `frontend/`: Angular 21 (resolved framework 21.2.26, CLI 21.2.30), TypeScript 5.9, HTML/SCSS, Router, HttpClient, Reactive Forms, lazy feature routes and signals. Added a dependency lockfile, dev proxy, desktop Playwright tests and startup/API-mapping documentation.
- Implemented Customer, Claims Staff and Manager demo sign-ins using existing fixed tokens verified with protected backend reads; role guards, bearer interceptor, session restoration and logout.
- Implemented customer dashboard/list/submission, documents/downloads, status/history, information replies and final decisions; staff queue/review/estimates/requests/decisions and workload reports; manager totals, Motor/Property groups, missing-estimate drill-down, read-only inspection and 15-second polling.
- Preserved customer/internal response shapes, the original claimed amount, estimate privacy, exact statuses, approval estimate requirement and final-state restrictions. Existing-claim commands send quoted If-Match versions. Conflicts require an explicit reload; no write is automatically replayed.
- Matched the actual 5 MiB/file, five files/request and 20 documents/claim limits. Added actual upload progress, field validation, loading/empty/error states, decision confirmation and recovery when document upload fails after the claim has already saved.
- Scope correction: the user explicitly requested desktop only during implementation. Removed the mobile sidebar/menu, narrow-screen stacked tables, mobile breakpoints and mobile test project. Final UI has a fixed sidebar, desktop tables, and a minimum desktop width of 1180px. Updated README instructions accordingly.
- Backend preservation: source and test file checksums matched the pre-frontend snapshot. No backend business logic, DTOs, schema, authentication, Kafka settings or Compose configuration were modified. Browser tests used an isolated `frontend-e2e.db`, with Kafka dispatch disabled by process environment only.

### Frontend validation performed

- Dependency installation completed successfully using Node 22.20.0 and npm 10.9.3.
- Started the existing backend on `http://localhost:5080` and Angular development server on `http://localhost:4200`. The Angular login page returned HTTP 200 and the proxied `/health` request succeeded. No backend CORS changes were required.
- Final `npm.cmd run build`: passed after the desktop-only changes; initial bundle 310.40 kB, estimated transferred size 85.06 kB. Output is `frontend/dist/chubb/browser`.
- Final `npm.cmd run test:e2e`: **9 desktop browser tests passed in 35.6 seconds**, no failures/skips. Tests used installed Chrome, real HTTP endpoints and real SQLite persistence; no mock API responses were supplied.
- Verified Motor submission with documents → review → estimate → information request → customer reply with attachment → Approved; repeated with Property → Rejected. Verified downloads, customer estimate privacy, final-state action removal, manager exclusion of both outcomes, zero estimates, mandatory reasons, invalid files/amounts/dates, route permissions, backend ownership/403 checks, missing resources, logout, stale-version reload, 15-second manager refresh, supported drill-down and upload failure recovery without duplicate creation.
- Existing backend regression suite: **20 passed, zero failures/skips**, using `dotnet test Chubb.sln --no-restore --logger 'console;verbosity=minimal'`.
- Inspected desktop screenshots from actual browser runs. Earlier broad viewport checks were superseded by the user's desktop-only scope; the final test configuration contains only the desktop project.
- `npm.cmd audit --omit=dev --json`: zero production dependency vulnerabilities. Full audit reported 16 moderate advisories in Angular CLI's transitive development tooling (glob/minimatch chains); no high/critical findings. Did not apply npm's suggested incompatible major downgrade/upgrade.
- Windows sandbox restrictions required elevated execution for dependency/network access, esbuild directory access, the test host and browser launch. npm.cmd avoids the restricted npm.ps1 execution-policy shim.

### Remaining frontend limitations

- Fixed demo credentials are not production authentication; Customer sign-in selects Alice. Backend permissions remain authoritative.
- Staff completed-claims search has no backend endpoint; the UI provides the supported completed count, outcomes and completion-time metrics only.
- Submission and initial documents use two backend operations. Files can be retried while Submitted; an interrupted submission response requires checking My Claims before resubmitting because the backend has no submission idempotency key.
- Customer KPI counts fetch all own-claim pages. Manager totals/table are separate reads and can briefly straddle concurrent changes until refresh. Production static hosting requires SPA fallback and a same-origin API reverse proxy.
- Desktop Chrome was tested. Mobile support is excluded at the user's request; other browser engines, production hosting and live Kafka delivery were not newly verified. Existing backend limitations remain as documented above.

## 2026-11-22 — Combined Windows CMD startup

- Agent/model: OpenAI Codex, GPT-6; exact serving snapshot is not exposed.
- Added root `start.cmd` so one command waits for healthy Docker Compose Kafka, runs the topic initializer, and launches the backend and frontend in separate CMD windows when needed. Newly launched backend processes explicitly enable Kafka publishing and use the repository-root SQLite database.
- Added prerequisite checks, missing frontend dependency installation, readiness checks for backend/frontend/API proxy, and reuse of already-running services. Reused backend processes retain their original environment; README explains restarting a previously Kafka-disabled backend.
- Validation: executed `.\start.cmd` successfully against the running local application. Kafka was healthy, initialization exited 0, existing backend/frontend were reused without interruption, all readiness checks passed, and the launcher printed the correct localhost URL. The fresh service-window launch branch was reviewed but not exercised to avoid stopping the user's running application.
- No application source, backend schema, Kafka configuration, or business features were changed. Updated README with one-command startup and shutdown instructions.

## 2026-11-22 — Repository cleanup and regression verification

- Agent/model: OpenAI Codex, GPT-6, as identified by the session instructions. An exact serving snapshot is not exposed. No sub-agents were used.
- Reviewed Angular source/templates/styles/routes/services, ASP.NET entities/controllers/authentication/validation/outbox, integration/browser tests, package manifests and lockfile, startup/demo scripts, Docker/SDK/launch/proxy configuration, and assessment documentation.
- Removed the compiler-confirmed unused `ClaimRecord` import from `frontend/src/app/services/claims.service.ts`.
- Removed the unreferenced `menu` SVG path from `frontend/src/app/shared/components/icon.component.ts`, the unused `.icon-button` rule from `frontend/src/styles.scss`, and the obsolete `claim-cell`, `type-cell`, `status-cell`, `action-cell` classes and `data-label` attributes from `frontend/src/app/shared/components/claim-table.component.ts`. Searches across source, styles and tests verified these were remnants of the removed mobile interface, with no current consumers. Visible text, desktop layout, table headers, accessibility labels and active styles were retained.
- Added `frontend/src/app/services/upload.ts` to share multipart field construction and typed response/progress handling. Updated documents/review services, claim submission and claim details to use it. Claim details now shares upload save/error/success handling for additional documents and replies. Existing validation, version headers, form reset behavior, notifications, indeterminate progress and partial-submission recovery are preserved.
- Added `frontend/src/app/shared/claim-list-state.ts` and reused it in customer My Claims and staff Claims Queue, removing duplicated pagination/loading/loaded/error/row state and request handling. The customer DTO remains separate from internal staff data; no endpoints or query behavior changed.
- Enabled TypeScript `noUnusedLocals` and `noUnusedParameters`. Updated the frontend architecture notes. Extended the existing Motor/Property browser workflows to open My Claims and refresh its list before opening claim details. No test cases were removed.
- Entire files removed: **none**. The TypeScript import-graph audit found all 34 Angular source files reachable from the application entry point. Other source, scripts, configuration, examples and documentation have current runtime, build, test or assessment uses.
- Dependencies removed: **none**. Runtime/build/test dependencies were retained, including Angular compiler tooling, Playwright, xUnit coverage collection and the explicit patched SQLite native bundle. Package manifests and lockfile are unchanged; no dependency was added just for cleanup.
- Backend and backend-test source/configuration checksums match the pre-cleanup snapshot. REST, SQLite model/schema, Kafka producer/outbox, permissions, ownership, concurrency and validation implementations were not changed. Startup scripts, Compose, launch profiles, API examples, assessment documentation and all existing databases were retained. No Git operations were performed.

### Cleanup verification results

- `node node_modules/typescript/bin/tsc --project tsconfig.app.json --noEmit`: passed with unused checks enabled.
- `npm.cmd run build`: passed with no Angular warnings/errors. Initial production bundle: 310.20 kB, estimated transfer 85.01 kB.
- `dotnet test Chubb.sln --no-restore --logger 'console;verbosity=minimal'`: **20 passed**, zero failures/skips; build had zero warnings/errors. Backend tests use their existing isolated SQLite fixtures.
- `npm.cmd run test:e2e` with `CHUBB_E2E_BASE_URL=http://localhost:4201`: **9 desktop tests passed in 39.5 seconds**, zero failures/skips. A separate API on port 5081 used a new database in the system temporary directory; a temporary proxy configured port 4201. Existing application ports 4200/5080, the root `claims.db`, its WAL/SHM files and the existing `frontend-e2e.db` were not used for test writes. No mock API responses were used.
- Browser coverage includes My Claims loading/refresh, shared staff queue, Motor approval, Property rejection, uploads/downloads, information requests/replies, estimate privacy, required-field/file validation, zero estimates, role/ownership restrictions, missing resources, logout, stale-version recovery, manager polling/drill-down and partial upload recovery without duplicate submission.
- Inspected generated desktop screenshots; current design is preserved. Only the isolated verification servers were stopped afterward; the user's original application was left running.
- PowerShell parser check of `scripts/demo.ps1`: passed. `docker compose config --quiet`: passed. No scripts were executed against user claims during cleanup.
- Import-graph audit: 34/34 Angular source files reachable; no orphan source modules. `npm.cmd ls --depth=0`: passed with the declared top-level dependency set.
- An optional standalone TypeScript check of Playwright source could not resolve Node typings because this repository does not declare `@types/node`. This is separate from the application build and Playwright's existing runtime transpilation; the real browser suite passed. No additional dependency was introduced solely for this optional audit.
- Security audit: `npm.cmd audit --omit=dev --json` reports **zero production vulnerabilities**. Full `npm.cmd audit --json` reports **16 moderate development-tool advisories**, no high/critical advisories, in the Angular CLI's transitive glob/minimatch dependency chains. No forced incompatible framework change or unverified dependency override was applied.
- Final read-only runtime checks: original backend `/health` succeeded, original Angular `/login` returned HTTP 200, and Kafka's lifecycle topic offsets remained available (partition offsets 0, 4 and 7). Ports 5081/4201 were no longer listening after isolated verification teardown. Existing services and lifecycle records remain available.

### Remaining issues

- The pre-existing development-tool advisories and lack of a standalone typed Playwright-check configuration remain documented above. The supported application production build and browser/backend test commands pass.
- Existing MVP limits remain: development authentication, a single SQLite service/dispatcher, EnsureCreated rather than migrations, signature-based uploads without malware scanning, and at-least-once Kafka delivery with retained outbox rows. Cleanup did not broaden scope or change these behaviors.

## 2026-11-22 — GitHub readiness and clean Windows startup verification

- Agent/model: OpenAI Codex, GPT-6, as identified by the session instructions; an exact serving snapshot is not exposed. No sub-agents were used.
- Goal: verify clone/ZIP-equivalent Windows startup with Kafka enabled, preserving existing data, functionality and the desktop design. No GitHub push was requested or performed.
- Initial Git check found no .git metadata/history. Initialised an empty local Git repository on main to inspect status and ignore rules; did not stage, commit, add a remote or push. No existing Git history was removed.
- Added a Kafka storage initialiser to set the named-volume directory owner to UID 1000 before the broker starts. A genuinely new verification volume reproduced first-run setup and started successfully without manual chown. Existing application volume/data were not modified by verification.
- Added optional CHUBB_API_PORT, CHUBB_FRONTEND_PORT and CHUBB_KAFKA_PORT overrides, and replaced the fixed frontend proxy JSON with proxy.conf.cjs so a clean isolated instance can use the same source/configuration and launcher. Normal ports and URLs are unchanged. Kafka publishing is explicitly enabled by start.cmd.
- Added NuGet.Config with only the public nuget.org source, Directory.Build.props enabling lockfiles, and both generated packages.lock.json files. start.cmd now restores in locked mode. npm package-lock.json remains included.
- Added the previously missing @types/node dev dependency, tsconfig.spec.json and the typecheck script; both application and Playwright-source typechecking now pass. No application business logic or styles changed.
- Added scripts/test-kafka.ps1 to submit a labelled test claim and consume/assert its matching ClaimSubmitted lifecycle event. The script runs through Windows PowerShell from CMD and needs no Python installation.
- Expanded .gitignore for local env/secret/certificate files, other SQLite extensions/journals, caches, logs, test evidence and temporary output; added .gitattributes for Windows script line endings. Tested 19 sensitive/generated path examples using Git's null-delimited check-ignore protocol; all were excluded, while required source/configuration/lockfiles remained includable.
- Replaced personal-machine README paths with a generic example and documented both clone/ZIP + CMD distribution and the single start.cmd command. Added exact manual CMD commands, prerequisites, first-run database/demo identity behavior, localhost URLs, live Kafka verification, test-data warnings and stop/restart instructions. Updated API.md to acknowledge the frontend and add CMD script examples. Added GITHUB-READINESS.md and COMMIT-FILES.txt.

### Clean-copy procedure and issues corrected

- Created source-only copies from Git's candidate file list, excluding databases, node_modules, .angular, bin, obj, dist, reports and Git metadata. Used directories with spaces. The host SDK/runtime/browser/Docker prerequisites were installed; no fresh OS/second physical Windows machine was used and no remote clone could be performed before publication.
- First copy used new empty npm and NuGet caches. npm ci succeeded. dotnet restore --locked-mode succeeded; a truncated native Kafka package download retried automatically and then completed.
- Used an isolated Compose project, a brand-new Kafka named volume and host port 29092, with API/frontend ports 5082/4202 and a newly created empty SQLite database. The application's existing ports, database and Docker project remained intact.
- Found that Windows timeout skips its delay with redirected stdin, causing premature readiness failure even while the backend started. Replaced it with a non-interactive PowerShell Start-Sleep and reran fresh backend/frontend launch successfully.
- An initial temporary-directory 8.3 alias made the dev-server resolve duplicate Angular core modules and render a blank login (NG0203). Confirmed only one installed Angular core version; restarted from the canonical full Windows path with a fresh generated Angular cache. The login and final full Chrome run then passed. Canonical paths are used in the documented instructions; the limitation is documented in the readiness report.
- A second source-only copy used another pair of empty dependency caches, no installed project dependencies, no bin/obj and no database. Ran only start.cmd; it automatically installed/restored dependencies, started both service windows with Kafka enabled and passed all readiness checks. It reused the isolated broker already verified on a fresh volume. Chrome successfully signed in as Customer, Claims Staff and Manager on this second copy.

### Executed verification results

- Clean-copy backend integration tests: **20 passed, 0 failed/skipped**; no build warnings/errors.
- Clean-copy Angular production build: **passed**; initial 310.20 kB, estimated transfer 85.01 kB.
- Clean-copy npm run typecheck: **passed**, including the previously unconfigured browser-test typing check.
- Clean-copy desktop Chrome suite, real REST/SQLite with real Kafka publisher enabled: **9 passed, 0 failed/skipped, 36.7 seconds**. Covers both Motor approval and Property rejection, lists, documents/downloads, estimates/privacy, information requests/replies/attachments, mandatory reasons/zero estimates, permissions/ownership, missing resources, logout, conflicts, manager reporting/polling and partial upload recovery.
- First startup: no database was copied; the schema was created automatically and all three role-protected reads initially returned zero claims. Demo accounts required no seed command or private credentials.
- scripts/test-kafka.ps1 against the isolated backend/broker: **PASS**; consumed the unique newly submitted claim's matching ClaimSubmitted event with valid schema and GUID event ID.
- Real broker outage: stopped only the isolated broker, submitted a Property claim for MYR 99, verified REST saved it as Submitted and its outbox row remained pending with failed delivery attempts. Restarted the broker with publishing still enabled; the same row gained PublishedAt and cleared LastError. Consumed the same claim/event ID from Kafka after recovery. **PASS**; no fake transport was used in this outage check.
- npm production audit: **0 vulnerabilities**. Full npm installation audit: **16 moderate development-tool advisories**, no high/critical findings. Locked .NET direct/transitive audit: **no vulnerable packages reported** by the public source. No forced incompatible dependency updates were applied.
- Publishable-source patterns for private keys, AWS/GitHub/OpenAI tokens and personal machine paths: no findings; manually reviewed public configuration/demo tokens. No real account secrets are required. All non-documentation source/config files matched the tested clean copy byte-for-byte before final reporting.
- Only isolated test services were stopped afterward; original API health and original Angular login still returned success. Isolated containers/network were removed without deleting their named volume; all existing SQLite databases and original Docker data were retained.
- Full results, limits, startup commands and Git state are in GITHUB-READINESS.md. COMMIT-FILES.txt records the initial commit candidates; nothing has been staged, committed or pushed.
- Final Git check: git add --dry-run . succeeded for all 81 candidate files, matching COMMIT-FILES.txt. No forbidden data/build artifacts or sensitive-pattern findings were present in the final source scan. The index remained empty and both original SQLite database files remained present.

### Readiness conclusion

- Ready for review and initial GitHub commit as a local Windows assessment/demo with the required prerequisites. Both explicit install and one-command clone/ZIP-equivalent paths were exercised.
- Remaining limits: 16 moderate CLI development dependency advisories; development-only identity and local plaintext transports; existing single-service/SQLite/outbox/upload limitations; canonical-path dev-server caveat; no second Windows OS installation, alternate browser engine, public deployment or remote GitHub clone tested. These are documented rather than represented as production readiness.

## 2026-11-22 — README presentation aligned with supplied reference

- Agent/model: OpenAI Codex, GPT-6; exact serving snapshot is not exposed.
- Reorganised README.md to follow the user's example: linked Quick start, Features, Tests, Demo walkthrough, Architecture decisions, Limitations and Project files sections. Kept the one-command Windows CMD path prominent and moved the three-terminal alternative into an expandable section.
- Preserved the actual CHUBB paths, Kafka-enabled startup, root SQLite database, demo identity behavior, upload/text limits, concurrency status codes and previously executed verification results. Did not copy unsupported SkipKafka/NoBrowser switches, automatic browser opening, startup log files, CI configuration, mobile checks, different backend paths, 10 MiB uploads or invented test counts from the reference.
- Preserved assessment reasoning for entities, one backend, REST versus events, the API contract, concurrency, shared workload, liability reporting, integer sen, document storage and at-least-once Kafka delivery. Linked API/readiness/frontend documentation for further detail.
- Documentation-only change; no application code, dependency, configuration, startup behavior or user data changed. Verified README links/anchors and code-fence structure. The displayed test results refer to the completed clean-copy verification above; tests were not rerun for this prose-only edit.

## 2026-11-22 — Final cross-file consistency review

- Agent/model: OpenAI Codex, GPT-6; exact serving snapshot is not exposed.
- Cross-checked README, API.md, frontend README, readiness report, journal history, commit manifest, package/scripts/lockfile setup, proxy, Compose configuration, backend/frontend enums and upload validation.
- Automated consistency checks passed: all 81 source candidates match COMMIT-FILES.txt; referenced documentation files/anchors exist; Markdown fences balance; Motor/Property and all five status names match across tiers; 5 MiB upload limits match; Kafka is enabled with the same lifecycle topic; proxy/default URLs match; no files are staged.
- Clarified the available Refresh/Reload controls in README to distinguish My Claims/staff pages/claim details from browser refresh on the customer dashboard.
- Reran application and Playwright-source TypeScript checks: passed. Reran the Angular production build: passed, unchanged 310.20 kB initial bundle and 85.01 kB estimated transfer.
- The normal dotnet test build could not overwrite the running API's EXE on Windows (MSB3027/MSB3021). Added the practical requirement to stop the API before normal test builds or use a separate checkout in README, frontend README and the readiness report. This was a build-output lock, not a failed test assertion or a business-logic change.
- Reran backend tests with a new temporary --artifacts-path and RestoreLockedMode=true, leaving the running app untouched: **20 passed, zero failed/skipped**. Final resolved Docker Compose configuration validated successfully.
- Earlier clean-copy **9 Chrome tests** and real Kafka publishing/outage/recovery results remain recorded as earlier executed checks; they were not represented as newly rerun in this consistency-only turn.
- No application code, design, database, user data, dependency or Git history changes. Nothing staged, committed or pushed. Remaining documented limitations and the 16 moderate development-tool advisories are unchanged.
