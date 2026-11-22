# REST API reference

Base URL: `http://localhost:5080`. JSON uses camelCase property names and string enums. All dates/times returned are UTC; submit `incidentAt` with a `Z` suffix. Currency is MYR; amounts use decimal MYR, not sen. Auth tokens and startup instructions are in [README.md](README.md).

Use `Authorization: Bearer customer-alice`, `customer-bob`, `staff-demo`, or `manager-demo`. Roles are distinct; Manager does not inherit Staff write access. Existing-claim writes additionally require `If-Match: "<version-guid>"`. Read a fresh version before retrying after 412/409. There is no API login or payment endpoint; the Angular frontend is served separately at `http://localhost:4200` and uses these development tokens.

## Endpoints

| Method and route | Permission | Request / result |
| --- | --- | --- |
| `GET /health` | Public | Process liveness; does not probe Kafka |
| `POST /api/claims` | Customer | Submission JSON; 201 customer claim, Location, ETag |
| `GET /api/claims` | Customer | Paginated own customer claims |
| `GET /api/claims/{id}` | Owner / Staff / Manager | Customer DTO for owner; internal DTO otherwise; ETag |
| `POST /api/claims/{id}/documents` | Owner, Submitted | Multipart files; 200 updated customer claim, ETag |
| `GET /api/claims/{id}/documents/{documentId}` | Owner / Staff / Manager | Download as attachment |
| `POST /api/claims/{id}/review` | Staff, Submitted | No body; transitions to UnderReview |
| `PUT /api/claims/{id}/estimate` | Staff, UnderReview or AwaitingInformation | Estimate JSON; keeps status |
| `POST /api/claims/{id}/information-requests` | Staff, UnderReview | Question JSON; transitions to AwaitingInformation |
| `POST /api/claims/{id}/information-requests/{requestId}/reply` | Owner, AwaitingInformation | Multipart required `text`, optional files; transitions to UnderReview |
| `POST /api/claims/{id}/decision` | Staff, UnderReview | Decision JSON; Approved or Rejected with reason |
| `GET /api/staff/queue` | Staff | Paginated outstanding claims, internal DTOs, oldest first |
| `GET /api/staff/workload` | Staff | All-time workload, outcomes and completion times |
| `GET /api/manager/outstanding` | Manager | Overall and Motor/Property outstanding totals |
| `GET /api/manager/outstanding/claims` | Manager | Paginated internal DTOs behind outstanding totals |

Every mutation of an existing claim returns 200 and a fresh ETag. Staff command results use the internal wrapper below. Approved and Rejected claims remain accessible by ID and in customers' own lists, but never appear in the outstanding queue or manager totals/drill-down. There is no staff completed-claims search endpoint.

All list endpoints accept `page=1&pageSize=20`; page must be 1–100000 and pageSize 1–100. Results are `{ "total": 10, "page": 1, "pageSize": 20, "items": [] }`. Customer lists sort newest first; queue and manager drill-down sort oldest first. ID is a stable secondary sort. Manager drill-down also accepts `type=Motor` or `type=Property` and `withoutEstimate=true`. Omit type for both; withoutEstimate defaults to false. No other filtering is implemented.

## JSON command bodies

Submission (all fields required):

```json
{"type":"Motor","incidentAt":"2026-01-01T00:00:00Z","incidentDetails":"Collision damage","claimedAmount":2500.50}
```

`type` is Motor or Property. Incident time must be from 1900 through now, UTC. Details, questions, replies and decision reasons must contain 1–4000 trimmed characters. Claimed amount must be 0.01–1,000,000,000 with at most two decimal places. Estimates allow explicit zero; missing estimate fields are rejected.

```json
{"estimatedLiability":1800.25}
```

```json
{"question":"Please provide a repair quotation."}
```

```json
{"decision":"Approved","reason":"Covered damage supported by the evidence."}
```

Replace Approved with Rejected for a negative decision. Approval requires an existing estimate; rejection does not. Both are terminal.

## Response shapes

Customer detail, submission, upload and reply responses use this shape:

```json
{
  "id":"claim-guid", "type":"Motor", "incidentDetails":"Collision damage",
  "incidentAt":"2026-01-01T00:00:00Z", "claimedAmount":2500.50, "currency":"MYR",
  "status":"Submitted", "version":"version-guid", "submittedAt":"2026-11-22T10:00:00Z",
  "completedAt":null, "decisionReason":null,
  "documents":[{
    "id":"document-guid", "fileName":"evidence.pdf", "contentType":"application/pdf",
    "size":1024, "informationRequestId":null, "uploadedAt":"2026-11-22T10:00:00Z"
  }],
  "informationRequests":[{
    "id":"request-guid", "question":"Provide a quotation", "requestedAt":"2026-11-22T10:05:00Z",
    "reply":null, "repliedAt":null
  }],
  "history":[{"action":"ClaimSubmitted","status":"Submitted","occurredAt":"2026-11-22T10:00:00Z"}]
}
```

The fields above illustrate the schema; a newly Submitted claim has empty document and request arrays. Documents contain metadata only; bytes are available through the authorized download endpoint. Information replies are attached to their request and optional files reference that request ID. The history is append-only and ordered. The customer shape has **no estimated liability field**.

Staff and manager claim views wrap the same customer shape:

```json
{"claim":{"id":"claim-guid","version":"version-guid","status":"UnderReview"},"customerId":"alice","estimatedLiability":1800.25}
```

`claim` contains the full customer DTO, abbreviated here. Use `claim.version` for internal mutation requests. A null estimated liability means no estimate; zero is a saved estimate.

Workload returns `scope`, `generatedAt`, `outstanding`, `byStatus` (every status with count), `outcomes` (`approved`, `rejected`), `completedCount`, `averageCompletionHours` and `medianCompletionHours`. Times include the entire period from submission through decision, including customer response time. Both metrics are null with no completed claims.

Manager totals return `currency`, `generatedAt`, `count`, `claimedAmount`, `estimatedLiability`, `withoutEstimateCount`, and `byType`. Each Motor/Property item has `type`, `count`, `claimedAmount`, `estimatedLiability` and `withoutEstimateCount`. Known estimates alone contribute to liability sums. Both terminal states are excluded. Use drill-down with `type` and/or `withoutEstimate` to inspect underlying claims.

## Manual requests with curl

For a complete API workflow from **Windows CMD** at the repository root, with the application running:

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\demo.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test-kafka.ps1
```

Both scripts create labelled/demo claim records. Use a separate test database when retaining personal data. The Kafka test requires the broker and the backend publisher to be enabled.

The following syntax is for Bash; on Windows use `scripts/demo.ps1` or the HTTP request file. Replace CLAIM, VERSION, REQUEST and DOCUMENT with real IDs. Always use the **latest** version, not one reused across commands.

```bash
curl -i http://localhost:5080/api/claims \
  -H 'Authorization: Bearer customer-alice' -H 'Content-Type: application/json' \
  -d '{"type":"Property","incidentAt":"2026-01-01T00:00:00Z","incidentDetails":"Storm damage to roof","claimedAmount":12500.00}'

curl -i http://localhost:5080/api/claims/CLAIM/documents \
  -H 'Authorization: Bearer customer-alice' -H 'If-Match: "VERSION"' \
  -F 'files=@/path/to/evidence.pdf;type=application/pdf'

curl -i -X POST http://localhost:5080/api/claims/CLAIM/review \
  -H 'Authorization: Bearer staff-demo' -H 'If-Match: "VERSION"'

curl -i -X PUT http://localhost:5080/api/claims/CLAIM/estimate \
  -H 'Authorization: Bearer staff-demo' -H 'If-Match: "VERSION"' \
  -H 'Content-Type: application/json' -d '{"estimatedLiability":9000.00}'

curl -i http://localhost:5080/api/claims/CLAIM/information-requests \
  -H 'Authorization: Bearer staff-demo' -H 'If-Match: "VERSION"' \
  -H 'Content-Type: application/json' -d '{"question":"Provide a repair quotation"}'

curl -i http://localhost:5080/api/claims/CLAIM/information-requests/REQUEST/reply \
  -H 'Authorization: Bearer customer-alice' -H 'If-Match: "VERSION"' \
  -F 'text=Here is the quotation.' -F 'files=@/path/to/quote.pdf;type=application/pdf'

curl -i http://localhost:5080/api/claims/CLAIM/decision \
  -H 'Authorization: Bearer staff-demo' -H 'If-Match: "VERSION"' \
  -H 'Content-Type: application/json' -d '{"decision":"Approved","reason":"Covered storm damage"}'

curl http://localhost:5080/api/claims/CLAIM -H 'Authorization: Bearer customer-alice'
curl -OJ http://localhost:5080/api/claims/CLAIM/documents/DOCUMENT -H 'Authorization: Bearer customer-alice'
curl http://localhost:5080/api/staff/workload -H 'Authorization: Bearer staff-demo'
curl http://localhost:5080/api/manager/outstanding -H 'Authorization: Bearer manager-demo'
curl 'http://localhost:5080/api/manager/outstanding/claims?type=Property&withoutEstimate=true' -H 'Authorization: Bearer manager-demo'
```

Multipart uses any file field names (convention: `files`), at most five files/request, 5 MiB/file and 20 files/claim. Allowlisted PDF, PNG, JPG/JPEG must match their MIME type and signature. Request limit is 27 MiB including multipart overhead. Replies require a nonblank `text` field even when files are supplied. Do not manually set Content-Type when curl uses `-F`: curl generates the boundary.

## Errors

Business errors use RFC Problem Details JSON with `status` and `detail`; framework validation may include `errors` by field.

| Status | Meaning |
| --- | --- |
| 400 | Invalid amount, date, enum, required field, text or upload |
| 401 | No valid demo token, or demo authentication disabled |
| 403 | Authenticated role lacks endpoint permission |
| 404 | Missing claim/request/document or another customer's claim |
| 409 | Invalid workflow transition, approval without estimate, or SQLite contention |
| 412 | Stale version / concurrent update; reload claim |
| 413 | Request exceeds HTTP body limit |
| 415 | Unsupported request content type |
| 428 | Existing-claim write lacks If-Match |

For a version failure example, start review with the submission version twice. The first request succeeds and rotates the version; the second returns 412. For ownership, retrieve Alice's claim with `customer-bob`; it returns 404. Kafka unavailability never changes a successfully committed REST response into a delivery error.
