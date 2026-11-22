# CHUBB Angular frontend

Angular 21, TypeScript 5.9, HTML/SCSS, Router, HttpClient and Reactive Forms. Claims and reports come from the ASP.NET API; there are no mock application responses or direct browser connections to Kafka. The UI is desktop-only.

## Start on Windows

Install the .NET 10 SDK, compatible Node.js 22 with npm, Docker Desktop with Linux containers, and Chrome. Open Docker Desktop. From the repository root in **Windows CMD**:

```cmd
.\start.cmd
```

Open **http://localhost:4200**. Choose Customer, Claims Staff or Manager; no password is needed. Customer uses Alice. The backend creates a fresh SQLite database automatically, and Kafka publishing stays enabled.

The [root README](../README.md) contains the complete prerequisites, three-terminal CMD alternative, Docker initialisers, stop/restart commands, Kafka checks and isolated-instance options. Angular and ASP.NET run locally; Kafka runs in Docker. No global Angular CLI is needed. `npm.cmd` avoids PowerShell's npm.ps1 shim execution-policy restriction.

`proxy.conf.cjs` forwards `/api/**` and `/health` to `localhost:5080`, or the port in `CHUBB_API_PORT`. The default frontend port is 4200; `npm.cmd start -- --port 4202` selects another port. Restart the dev server after changing its environment. The production output needs its own same-origin API reverse proxy.

## API mapping

The actual controllers, DTOs, auth handler, upload validation and transition checks were inspected before implementation.

| Frontend function | Existing API |
| --- | --- |
| Demo Customer sign-in verification | `GET /api/claims?pageSize=1`, `customer-alice` token |
| Demo Staff sign-in verification | `GET /api/staff/workload`, `staff-demo` token |
| Demo Manager sign-in verification | `GET /api/manager/outstanding`, `manager-demo` token |
| Customer KPIs + recent claims | Paginated `GET /api/claims`; aggregate the full own-claims result |
| My Claims | `GET /api/claims?page=&pageSize=20` |
| Submission | `POST /api/claims` followed by optional `POST /api/claims/{id}/documents` |
| Details, status, history, requests/replies | `GET /api/claims/{id}` |
| Download document | Authenticated `GET /api/claims/{id}/documents/{documentId}` as a blob |
| Shared queue | `GET /api/staff/queue` |
| Start review | `POST /api/claims/{id}/review` |
| Save liability estimate | `PUT /api/claims/{id}/estimate` |
| Ask for information | `POST /api/claims/{id}/information-requests` |
| Customer reply + attachments | `POST /api/claims/{id}/information-requests/{requestId}/reply` |
| Final decision | `POST /api/claims/{id}/decision` |
| Team metrics and completion times | `GET /api/staff/workload` |
| Manager totals and Motor/Property groups | `GET /api/manager/outstanding` |
| Manager table/type/missing-estimate drill-down | `GET /api/manager/outstanding/claims` |

There is no login endpoint. Tokens are the backend's fixed development credentials, selected by role and verified with a protected read before navigation. This is demo authentication, not production identity management. The frontend stores only the role in `sessionStorage` and restores its predefined demo account; backend authorization and ownership checks remain authoritative.

## Structure and behavior

```text
src/app/
  core/auth/           Demo session service and login
  core/guards/         Authentication and role route guards
  core/interceptors/   API bearer headers and 401 session handling
  shared/components/   Layout, table, KPIs, badges, icons, files, states, confirmation
  shared/validation.ts Text, money, incident-date and file validators
  shared/claim-list-state.ts Shared customer-list/staff-queue loading and pagination state
  features/customer/  Dashboard, My Claims, submission
  features/staff/     Dashboard and shared queue
  features/manager/   Read-only reporting dashboard
  features/claims/    Role-aware claim details and review forms
  features/reports/   Reusable team workload/completion summary
  models/            Typed backend response contracts
  services/          Claims, documents, review actions, reports, notifications
```

Standalone Angular components, lazy feature routes and signals keep the application small. Reusable services group related review actions without creating a separate class for every HTTP command. Typed DTOs preserve the customer shape and the internal `{ claim, customerId, estimatedLiability }` wrapper. Customer screens never render estimated liability. Guards control navigation; they do not replace server permissions.

`services/upload.ts` shares multipart construction and upload-progress/response handling across submission, additional documents and information replies. `shared/claim-list-state.ts` shares pagination/loading/error state between My Claims and Claims Queue while retaining their separate role-specific endpoints. TypeScript unused-local and unused-parameter checks are enabled in `tsconfig.json`.

The desktop-only blue/white/slate design uses a fixed sidebar, dashboard cards, data tables, visible keyboard focus, labeled forms, live errors/loading states and a native confirmation dialog. The desktop layout has a minimum width of 1180px. There is no mobile navigation or stacked mobile table layout. The status badges display the backend's exact names: Submitted, UnderReview, AwaitingInformation, Approved and Rejected. No editing/reopening/payment or individual assignment is added.

### Versions, validation and failure recovery

- Every mutation of an existing claim uses the current quoted GUID in `If-Match`. Successful responses replace the current claim/version. The UI handles 409, 412 and 428 by disabling writes and offering a reload; it never retries a decision or reply automatically.
- Approval requires a saved estimate, including an explicit zero; rejection does not. Both require a nonblank reason. AwaitingInformation exposes replies to customers and estimates to staff, but no decision controls. Final claims expose no review/edit actions.
- The actual backend upload limit is **5 MiB**, not the 10 MiB in the reference brief. Client checks enforce nonempty PDF/JPG/JPEG/PNG, matching MIME type, five files/request, 20 documents/claim and filename length. The server additionally checks signatures. Multipart requests use the browser-generated boundary.
- Angular 21's default XHR backend provides real upload progress events; the percentage remains indeterminate if the transport does not provide a total. Document downloads carry authorization and use object URLs that are revoked after download. See [Angular 21 HttpClient setup](https://v21.angular.dev/guide/http/setup).
- Submission and its document upload are separate backend operations. If the claim saves and documents fail, the submission form becomes a saved-claim recovery panel. Open that claim and retry files while it is still Submitted. An interrupted creation response is ambiguous: check My Claims before resubmitting, since submission idempotency is not provided by the backend.
- Incident dates are sent as midnight UTC with a `Z` suffix. Dates must be between 1900 and today. Nonblank incident/request/reply/decision text is limited to 4000 characters. Claimed amounts allow 0.01–1,000,000,000 MYR; estimates also allow zero; both permit at most two decimal places.
- Error handling covers unavailable service, invalid requests, 401 sign-in failure, 403 forbidden access, 404 missing/foreign resources, 409/412 conflicts and upload errors. Manager refresh errors retain the last successful report with an explicit stale-data message.

### Reporting limitations preserved from the backend

Customer KPIs are computed only from all pages of the authenticated customer's actual claim list. There is no customer aggregate endpoint, so this requires more requests as the claim count grows; an incomplete fetch produces an error rather than presenting partial counts.

Staff workload and completion times use the backend report unchanged. The completed KPI is a count, not a link to an invented completed-claims search. Only outstanding claims appear in the shared queue. A known finalized claim remains inspectable by ID.

Manager figures come from the reporting endpoint, including both Motor/Property groups, missing estimates and known-liability totals. Approved and Rejected are excluded by the backend. The manager dashboard refreshes every 15 seconds while the tab is visible, and refreshes stop when navigating away. Type and missing-estimate switches use the supported drill-down query parameters; there are no advanced filters. Totals and the table are separate backend reads, so a simultaneous decision may briefly straddle their snapshots until the next refresh.

## Build and tests

Production build, from the repository root:

Stop the backend before the normal `dotnet test` command on Windows, or use a separate checkout; a running backend EXE can lock its build output. The integration tests use separate temporary databases.

```powershell
npm.cmd --prefix frontend run build
dotnet test Chubb.sln --no-restore
```

Static output: `frontend/dist/chubb/browser`. Production hosting needs an SPA fallback to `index.html` and a same-origin `/api` reverse proxy to the existing backend. The Angular dev proxy is not bundled into the production output. This implementation does not publish the app or add production authentication.

Browser tests use Playwright and the locally installed Chrome browser (no extra browser download required). Start the backend in a separate terminal with a **dedicated fresh test database**, rather than your normal demo data:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:Kafka__Enabled = 'true'
$testDb = Join-Path (Get-Location) ('frontend-e2e-' + [guid]::NewGuid().ToString() + '.db')
$env:ConnectionStrings__Claims = "Data Source=$testDb;Pooling=False;Default Timeout=5"
dotnet run --project src/Chubb.Api --no-launch-profile --urls http://localhost:5080
```

Use the same Angular server (`npm.cmd --prefix frontend start`), then run in another root terminal:

```powershell
npm.cmd --prefix frontend run test:e2e
```

Do not run the normal backend and test backend on port 5080 at the same time. Tests submit and decide real claims in that backend database; they do not intercept endpoints or return mock responses. Stop the servers with Ctrl+C when done. Keep the isolated database for inspection or remove only that test database after stopping its backend. With another installed browser, set `$env:CHUBB_BROWSER_CHANNEL = 'msedge'`. With another frontend URL, set `$env:CHUBB_E2E_BASE_URL` before running tests.

The desktop suite runs at 1440×1000, covering both end-to-end decisions, documents/downloads, replies, zero estimates, required fields and invalid files, route guards, real backend role/ownership checks, missing resources, logout, stale-version reload, manager refresh, supported drill-down and partial upload recovery. Screenshots and traces are generated under `frontend/test-results`; the HTML report is under `frontend/playwright-report`. Mobile support and mobile tests are outside the requested scope.

See the repository [AI journal](../AI-JOURNAL.md) for actual executed results and unresolved limitations. The npm production dependency audit was clean; the Angular 21 CLI dependency tree reports moderate development-tool advisories, documented there. No forced major framework upgrade was applied.

Final executed verification: **9 desktop browser tests passed**, **20 backend integration tests passed**, and the **Angular production build passed**. The desktop browser suite exercised real API calls and SQLite records. See the root readiness report for current source/configuration changes and clean-copy results.
