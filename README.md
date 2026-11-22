# CHUBB Claims Management

A desktop claims management MVP for the CHUBB full-stack assessment, built with **Angular 21, ASP.NET Core 10, EF Core/SQLite and Kafka**. Customers report Motor or Property incidents, claims staff assess them, and managers monitor outstanding work and estimated liability. All amounts use **MYR**.

[Quick start](#quick-start) | [Features](#features) | [Tests](#tests) | [Demo](#demo-walkthrough) | [Architecture](#architecture-decisions) | [Limitations](#limitations) | [Project files](#project-files)

## Quick start

### Prerequisites

- **.NET 10 SDK**, not just the runtime.
- **Node.js 22.12+ within the 22.x series**, including npm. Other supported versions are listed in `frontend/package.json`.
- **Docker Desktop**, running Linux containers, with Docker Compose supporting `up --wait` and `wait`. Enable WSL 2/hardware virtualisation as required by Docker Desktop.
- **Google Chrome** for manual and automated desktop testing.
- Windows **CMD**, PowerShell 5.1+ and curl. Git is optional when downloading a ZIP.

The first run needs Internet access for npm/NuGet packages and the Kafka Docker image. No API keys, existing database, global Angular CLI, Java installation, Python or ZooKeeper are needed. This is a source download: each computer needs the prerequisites above.

### Download and run

1. Clone the repository, or select **Code > Download ZIP** on GitHub and extract it.
2. Start **Docker Desktop** and wait for its engine to be ready.
3. Open **Windows CMD** in the folder containing `start.cmd` and `compose.yaml`.
4. Run:

   ```cmd
   .\start.cmd
   ```

5. Open **http://localhost:4200** in Chrome.
6. Choose **Customer**, **Claims Staff** or **Manager**, then click **Continue**. No password is required.

The launcher installs missing frontend dependencies, restores locked .NET packages, initialises Kafka storage and its lifecycle topic, and opens separate backend/frontend CMD windows. **Kafka publishing stays enabled.** Keep those service windows open while testing. The launcher does not open Chrome automatically.

The backend creates an empty `claims.db` at the repository root on first startup. Demo identities are predefined in code and need no database seed command. Customer sign-in uses Alice's demo account. Uploaded documents are stored in SQLite; local databases are excluded from Git.

For explicit dependency installation, run these from the root before starting:

```cmd
dotnet restore Chubb.sln --locked-mode
npm.cmd --prefix frontend ci
```

### Services and local files

| Component | Location | Address / file |
| --- | --- | --- |
| Angular frontend | Windows host | http://localhost:4200 |
| ASP.NET Core backend | Windows host | http://localhost:5080 |
| API health, also available through the frontend proxy | Windows host | http://localhost:5080/health |
| SQLite and document bytes | Windows host | Repository-root `claims.db` |
| Kafka broker | Docker | Host `localhost:9092`; container network `kafka:19092` |
| Storage and topic initialisers | Docker, one-shot containers | Both finish with exit code 0 |

Kafka uses KRaft, so ZooKeeper is unnecessary. The storage initialiser sets the volume directory owner to Kafka's UID 1000 without deleting data. The topic initialiser creates `chubb.claims.lifecycle.v1` with three partitions and replication factor one. Host services bind to loopback.

Stop the backend and frontend with **Ctrl+C in their windows**, then stop Kafka from the root:

```cmd
docker compose down
```

Restart with `.\start.cmd`. SQLite and Kafka's named volume persist; do not use `down -v` if you want to retain Kafka records.

<details>
<summary>Manual startup in Windows CMD</summary>

Install dependencies using the commands above. Open three CMD terminals at the repository root.

**Terminal 1 - Kafka:**

```cmd
docker compose up -d --wait --wait-timeout 180 kafka
docker compose up -d --no-deps kafka-init
docker compose wait kafka-init
docker compose ps -a
```

Expect Kafka to be healthy and both initialisers to have exited with code 0.

**Terminal 2 - backend:**

```cmd
set "CHUBB_ROOT=%CD%"
set ASPNETCORE_ENVIRONMENT=Development
set DemoAuth__Enabled=true
set Kafka__Enabled=true
set Kafka__BootstrapServers=localhost:9092
set "ConnectionStrings__Claims=Data Source=%CHUBB_ROOT%\claims.db;Default Timeout=5"
cd src\Chubb.Api
dotnet run --no-restore --no-launch-profile --urls http://localhost:5080
```

**Terminal 3 - frontend:**

```cmd
set CHUBB_API_PORT=5080
cd frontend
npm.cmd start
```

The Angular dev proxy forwards `/api/**` and `/health` to the backend. No backend CORS change is required. Check both routes with:

```cmd
curl.exe --fail http://localhost:5080/health
curl.exe --fail http://localhost:4200/health
```

</details>

### Troubleshooting a fresh download

- Run `dotnet --list-sdks` and `node --version` to check the prerequisites. Restart CMD after installing them.
- If Docker is unavailable, open Docker Desktop and wait for the engine. This launcher requires Docker and keeps Kafka enabled.
- If Kafka exits with a hostname-resolution error for `kafka`, recreate its container using the recovery steps below, then rerun `.\start.cmd`.
- If dependency installation fails, check network/proxy access to NuGet, npm and Docker Hub, then retry. Do not install frontend dependencies with `--ignore-scripts`.
- If ports 5080, 4200 or 9092 are occupied, stop the previous instance. Existing responding services are reused; their original environment settings remain in effect. Stop a previously Kafka-disabled backend before launching again.
- For manual demo sign-in, use `ASPNETCORE_ENVIRONMENT=Development` and enable demo authentication as shown above.
- Inspect errors in the backend/frontend CMD windows. Startup logs are not written to a separate log directory.
- Use the normal full Windows folder path. If an 8.3 path alias or a moved dev-server cache causes Angular injection errors, stop Angular, run `node node_modules/@angular/cli/bin/ng.js cache clean` from `frontend`, then restart from the full path.

For an isolated second instance, use a separate checkout and set `CHUBB_API_PORT`, `CHUBB_FRONTEND_PORT`, `CHUBB_KAFKA_PORT` and a distinct `COMPOSE_PROJECT_NAME` before launching. Defaults are 5080, 4200 and 9092. The launcher and proxy respect these overrides. There are no `-SkipKafka` or `-NoBrowser` launcher switches.

#### Kafka cannot resolve its own hostname

If startup fails, inspect the broker log from the folder containing `compose.yaml`:

```cmd
docker compose logs --tail 100 kafka
```

If the log reports that Kafka cannot resolve `kafka` (for example, `UnknownHostException: kafka`), recreate the broker container and wait for it to become healthy:

```cmd
docker compose up -d --force-recreate --wait --wait-timeout 180 kafka
.\start.cmd
```

Recreating the container refreshes its Docker network attachment and reuses the existing `kafka-data` volume. The launcher then ensures the lifecycle topic exists before starting the application. No application-code or SQLite changes are needed for this recovery. Do not run `docker compose down -v`: it deletes the Kafka volume and its stored records. If the recreated broker still fails, inspect its new logs before retrying.

## Features

| Role | What they can do |
| --- | --- |
| Customer | Submit Motor/Property claims with amounts and documents; view their own claims, statuses and history; reply to information requests with optional attachments; read decisions and reasons. |
| Claims Staff | Review the shared queue and documents; save liability estimates; request information; approve/reject with reasons; view team workload, outcomes and average/median completion times. |
| Manager | Inspect outstanding claims, Motor/Property counts and totals, known estimates and missing-estimate counts. Read-only dashboard refreshes every 15 seconds while visible. |

The customer's **claimed amount** and staff's **estimated liability** are separate. Customer responses never include the internal estimate. Both Approved and Rejected claims are excluded from outstanding totals.

Uploads allow up to **five nonempty PDF/JPG/JPEG/PNG files per request**, **5 MiB per file**, and **20 documents per claim**. The server checks extensions, MIME types and signatures. Incident details, information requests, replies and decision reasons require **1-4000 nonblank characters**. Amounts allow at most two decimal places; estimates can explicitly be zero.

Initial documents are uploaded after the claim saves and while it remains Submitted. If that upload fails, the frontend links to the saved claim for retry without creating a duplicate. Later attachments accompany information replies.

## Tests

From the repository root, after installing dependencies:

On Windows, stop the backend with Ctrl+C before the normal `dotnet test` command so its running EXE does not lock the build output. Alternatively, test from a separate checkout. Backend tests use their own temporary databases.

```cmd
dotnet test Chubb.sln --no-restore
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run build
```

| Latest completed check | Result |
| --- | --- |
| Backend integration tests | **20 passed** |
| Angular production build | **Passed** |
| Application and browser-test TypeScript checks | **Passed** |
| Desktop Chrome workflow tests | **9 passed** |
| Live Kafka publishing | **Passed** |
| Real Kafka outage and outbox recovery | **Passed** |
| Clean source-only Windows copies | **Dependency installation, one-command startup, database creation and all three role sign-ins passed** |

These are executed local results, not GitHub Actions results. No CI workflow is currently configured. Clean-copy checks used the available Windows computer with installed host prerequisites, not a new Windows OS installation or a remote GitHub clone. Details and remaining concerns are in [GITHUB-READINESS.md](GITHUB-READINESS.md).

### Desktop browser tests

With Chrome installed and the complete app running against a **separate test database/checkout**, run:

```cmd
npm.cmd --prefix frontend run test:e2e
```

The tests use real REST requests and create real claims. Do not run them against personal data. Set `CHUBB_E2E_BASE_URL` for a different frontend URL, or `CHUBB_BROWSER_CHANNEL=msedge` to use installed Edge. Evidence is saved in `frontend/test-results/` and `frontend/playwright-report/`, both ignored by Git.

Coverage includes both decisions, shared/customer lists, documents/downloads, information replies, zero estimates, privacy, validation, permissions, missing resources, logout, stale versions, manager refresh/drill-down and recovery from a failed document upload. This is desktop Chrome verification, not an exhaustive cross-browser or accessibility audit.

### Kafka events and API-only checks

With Kafka publishing enabled and the app running:

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test-kafka.ps1
```

This creates one labelled Motor claim for MYR 10 and checks that its matching `ClaimSubmitted` event reaches Kafka. For an isolated instance, pass `-BaseUrl http://localhost:5082 -ComposeProject YOUR_TEST_PROJECT`. The test does not delete the claim.

To watch lifecycle events, then press Ctrl+C to stop watching:

```cmd
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:19092 --topic chubb.claims.lifecycle.v1 --from-beginning --property print.key=true
```

REST writes still save when the broker is unavailable. The enabled outbox worker retries after recovery. To demonstrate this on disposable test data, stop Kafka, submit a claim, restart Kafka and inspect the event. Clearing SQLite does not clear existing Kafka records.

For a complete REST workflow without using the frontend:

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\demo.ps1
```

This creates and approves a demo claim. Its PDF-signature fixture verifies the upload path but is not a complete reader-ready PDF. Individual endpoint examples are in [API.md](API.md) and [examples/claims.http](examples/claims.http).

## Demo walkthrough

1. **Customer:** Submit a Motor claim for MYR 3,000 and attach a document.
2. **Claims Staff:** Open it in the queue, click Start review, download the document, and save a MYR 2,500 liability estimate.
3. **Claims Staff:** Request a quotation. **Customer:** Reply with text and an optional attachment. The status returns from AwaitingInformation to UnderReview.
4. **Manager:** Check that the claim appears with MYR 2,500 estimated liability and can be inspected without editing.
5. **Claims Staff:** Approve with a reason and confirm. **Customer:** Read the final decision. **Manager:** Confirm that it leaves the outstanding list and totals.
6. Repeat with a **Property** claim and reject it. Staff outcomes should show one Approved and one Rejected claim if these are the only completed claims.

Approval requires a saved estimate, including an explicit zero; rejection does not. Decisions require a reason and cannot bypass an unanswered information request. Final claims cannot be edited or reopened. Use Refresh in My Claims and staff list/dashboard pages, Reload in claim details, or browser refresh on the customer dashboard. Managers poll automatically.

```text
Submitted -> UnderReview
UnderReview -> AwaitingInformation -> UnderReview
UnderReview -> Approved / Rejected
```

## Architecture decisions

| Assessment question | Decision and reasoning |
| --- | --- |
| What are the core entities? | Claim owns documents, information requests/replies and ordered history entries. OutboxMessage stores each lifecycle event and delivery state. Customer identity comes from authentication, not a seeded user table. |
| One backend service or several? | One ASP.NET service keeps deployment small and allows the claim, document bytes, history and pending event to commit in one SQLite transaction. There is no individual officer assignment. |
| What is synchronous versus event-driven? | REST handles commands, queries and authenticated downloads. A background worker publishes the transactional outbox to Kafka; REST never waits for the broker. |
| What defines the API contract? | Explicit DTOs, role/ownership checks, validation and exact backend statuses. Angular uses the customer shape or the internal claim wrapper as appropriate. See API.md for all routes. |
| How are conflicting updates prevented? | Existing-claim writes require the current quoted GUID version in If-Match. An EF concurrency token prevents two writers from committing the same version. Missing preconditions return 428; stale writes return 412; invalid transitions/database contention can return 409. The UI offers reload without replaying writes automatically. |
| How does the team manage workload? | One shared outstanding queue, incident details, documents, replies and history support review. Team metrics show status counts, Approved/Rejected outcomes and average/median hours from submission to decision, including customer waiting time. |
| What does reporting know about exposure? | It separates claimed amounts from estimates, totals only known estimates on outstanding claims, counts missing estimates separately, and provides the underlying rows for inspection. Both Motor and Property groups appear even when empty. |
| Why integer sen and SQLite blobs? | Integer sen avoids currency rounding ambiguity. Document blobs keep attachments and related changes atomic, at the cost of database size and memory use. |

Each committed mutation records a history entry and an event: ClaimSubmitted, DocumentsAdded, ReviewStarted, LiabilityEstimated, InformationRequested, InformationReplied, ClaimApproved or ClaimRejected. Events carry a stable eventId, schemaVersion, claimId, claimVersion, timestamp, type, status and MYR currency. Payloads omit incident text, documents, questions/replies and financial amounts.

Kafka delivery is **at least once**. The single worker processes pending rows in sequence, marks publication only after broker acknowledgement, stops on failure and retries. Messages use claim ID as the partition key, preserving per-claim order; consumers must deduplicate by eventId. A crash between broker acknowledgement and the SQLite marker can produce a duplicate. Published rows are retained.

## Limitations

- **Decisions and payments:** Approved records a decision; payment processing is outside scope. Outstanding totals exclude Approved/Rejected and do not represent all unpaid insurance liabilities.
- **Demo security:** Fixed development tokens, local HTTP and Kafka PLAINTEXT are intentional for this local assessment. Demo authentication is disabled outside Development/Testing. Production identity, TLS, rate limiting and operational hardening remain required before public deployment.
- **Team scope:** One shared queue and all-time team metrics. Individual assignment, officer performance, reopening and completed-claim search are not implemented.
- **Persistence and scale:** One API instance/outbox dispatcher. EnsureCreated creates a fresh database but does not perform versioned migrations. Blob loading and in-process aggregation suit an MVP; published outbox rows need a retention policy for long-term operation.
- **Documents and retries:** Signature validation does not replace malware scanning or full document parsing. Submission has no idempotency key; check My Claims before resubmitting after a lost response. Initial claim creation and document upload are separate requests.
- **Reports:** Customer KPIs fetch all own-claim pages. Manager totals and drill-down are separate reads and can briefly straddle concurrent changes until refresh. Lists are paginated; advanced filters are excluded.
- **Frontend hosting:** Desktop-only. Production static output is `frontend/dist/chubb/browser` and needs SPA fallback plus a same-origin API reverse proxy. The dev proxy is not included in that output.
- **Dependency security:** The latest audit found zero production npm vulnerabilities and no known vulnerable .NET packages, but 16 moderate Angular CLI development-tool advisories remain. See the readiness report for scope and dates.

## Project files

| Part | Main files | Purpose |
| --- | --- | --- |
| Backend API and workflow | `src/Chubb.Api/Program.cs`, `ClaimsController.cs`, `ClaimService.cs`, `ReportsController.cs` | REST endpoints, workflow validation, permissions and reports. |
| Backend data and infrastructure | `Data.cs`, `Contracts.cs`, `DemoAuth.cs`, `Uploads.cs`, `Outbox.cs` in `src/Chubb.Api/` | EF storage, response DTOs, demo identity, uploads and reliable Kafka publishing. |
| Frontend | `frontend/src/app/`, `main.ts`, `styles.scss` | Role-specific routes/pages, services, guards, forms and shared desktop design. |
| Build configuration | `Chubb.sln`, `global.json`, `Directory.Build.props`, `NuGet.Config`, project/lockfiles; frontend package/lockfiles, Angular/TypeScript configuration and `proxy.conf.cjs` | Public dependencies, reproducible restore, compilation and dev proxy. |
| Startup | `start.cmd`, `compose.yaml` | One-command local startup, Kafka broker and initialisers. |
| Verification | `tests/Chubb.Api.Tests/`, `frontend/e2e/`, `frontend/playwright.config.ts`, `scripts/demo.ps1`, `scripts/test-kafka.ps1` | Backend, browser, REST and live Kafka checks. |
| Submission documentation | `API.md`, `AI-JOURNAL.md`, `GITHUB-READINESS.md`, `COMMIT-FILES.txt` | API contract/examples, AI record, verification evidence and initial commit candidates. |
| Git configuration | `.gitignore`, `.gitattributes` | Exclude local data/secrets/generated files and preserve suitable script line endings. |

Before committing, review `git status --short --untracked-files=all` and `git add --dry-run .`. GitHub clones and ZIP downloads contain committed files only. Include the complete source, public configuration, lockfiles, scripts, tests and documentation; exclude databases, uploaded data, node_modules, build outputs, reports, private keys and local secrets. There is no configured CI workflow or published GitHub remote yet.

[API reference](API.md) | [Frontend notes](frontend/README.md) | [GitHub readiness](GITHUB-READINESS.md) | [AI working journal](AI-JOURNAL.md)
