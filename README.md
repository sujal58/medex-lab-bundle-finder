# MedEx — Lab Test Bundle Finder

A full-stack implementation of **Task 1: Lab Test Bundle Finder** for the MedEx Full-Stack Developer Internship assessment.

Customers select lab tests, and the application finds the **lowest-cost combination of available packages and individual tests** that covers every selection. It also explains what each purchase covers, which additional tests are included, and how much the customer saves when an individual-price comparison is possible.

## Tech stack

| Component | Technology |
| --- | --- |
| Backend | Node.js 22+, TypeScript, NestJS |
| Frontend | React, TypeScript, Vite, CSS |
| Data | Supplied `data/lab-catalog.json`, loaded into memory |
| Tests | Node.js built-in test runner; HTTP integration, algorithm, catalog, and frontend helper tests |

No database is needed for this read-only catalog and calculation exercise.

## Project structure

```text
backend/
  src/
    catalog/      # Catalog validation, normalization and listing endpoints
    planner/      # Exact optimizer and POST /api/plan
  test/           # Catalog, planner and HTTP integration tests
frontend/
  src/
    App.tsx       # Search, selection and recommendation UI
    selection.ts  # Test filtering and selection helpers
    planner.ts    # API contract, errors and stale-request handling
  test/           # Selection and planner helper tests
data/
  lab-catalog.json  # Original supplied dataset (unchanged)
README.md
```

## Getting started

**Requirements:** Node.js 22 or later and npm.

Start the backend:

```bash
cd backend
npm ci
npm run dev
```

In another terminal, start the frontend:

```bash
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173**. The NestJS API runs at **http://localhost:3001**. Vite proxies `/api` requests to the backend, so both servers must be running in development.

### Build and test

From the project root, run separately:

```bash
cd backend
npm test
npm run build
```

```bash
cd frontend
npm test
npm run build
```

The backend tests cover the provided examples, catalog normalization, optimization edge cases, HTTP response bodies and error statuses. Frontend tests cover search/selection logic, response validation, and stale/failed requests. The application was also manually exercised locally, including mobile-width layout, rapid selection changes, and network-error/retry states. These are local checks, not an automated browser E2E suite.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/tests` | Return active, selectable tests (including package-only tests with `price: null`) |
| `GET` | `/api/packages` | Return active, normalized packages |
| `POST` | `/api/plan` | Find the cheapest valid purchase plan |
| `GET` | `/api/health` | Additional development diagnostic endpoint |

Example:

```http
POST /api/plan
Content-Type: application/json

{"testIds":["T02","T03","T04","T06"]}
```

A successful `200` response contains exactly these fields:

- `items`: purchased packages and/or individual tests, sorted by ID; each item's `covers` array follows selected-test order
- `total`: the total purchase price in whole Thai baht
- `extraTests`: additional included tests not selected by the customer, sorted by ID
- `individualTotal`: cost of buying all selected tests individually, or `null` if impossible
- `savings`: `individualTotal - total`, or `null` when there is no individual comparison

Errors follow the assessment format, `{ "error": "<CODE>", "testIds": [...] }`:

| HTTP status | Code | Meaning |
| --- | --- | --- |
| `400` | `EMPTY_SELECTION` | No tests selected |
| `400` | `INVALID_TESTS` | Unknown or inactive test IDs |
| `422` | `NOT_AVAILABLE` | Selected tests cannot all be obtained |

For malformed types, non-array or non-string `testIds` are treated as `INVALID_TESTS` with an empty ID list. Missing `testIds` produces `EMPTY_SELECTION`. Unexpected server errors remain server errors.

## Optimization approach

The core implementation is `backend/src/planner/plan.ts`, exposed as a pure `calculatePlan()` function. The optimizer uses **exact subset enumeration**, not a greedy discount heuristic:

1. Remove duplicate selected IDs while preserving selection order. Reject unknown or inactive tests.
2. Consider active packages covering at least one requested test.
3. Represent requested tests as bits in a bitmask. Enumerate all combinations of relevant packages.
4. For each combination, add individually purchasable selected tests not already covered. Reject combinations that leave a package-only test uncovered.
5. Collect distinct extra tests included in the chosen packages.
6. Choose the best valid candidate by MedEx's required ranking: **lowest total**, then **fewest purchased items**, then **fewest extra tests**, then the **alphabetically earliest sorted list of item IDs**.
7. Return purchases sorted by ID with each item's selected-test coverage in the original selection order.

An additional covered test is not purchased individually: it would increase the item count and cannot improve a nonnegative-price solution. All catalog prices are integer Thai baht, so calculations use exact integer addition rather than floating-point currency arithmetic.

### Performance and Scalability

The bundle optimizer uses exact subset enumeration with bitmasks to find the minimum-cost combination of lab packages and individual tests.

**Time complexity:** Approximately `O(2^P × P × T)`, where `P` is the number of relevant packages and `T` is the number of selected tests.

The supplied catalog contains 13 packages, of which 12 are active. Consequently, the algorithm evaluates at most 4,096 package combinations, making exhaustive optimization practical for the given dataset.

#### HTTP Performance Benchmark

Performance was measured against the locally running production-built NestJS backend using Node.js `fetch` and `performance.now()`.

Each scenario was executed with 10 warm-up requests followed by 100 measured HTTP requests.

| Test scenario | Average | P95 | Maximum |
|---|---:|---:|---:|
| Single test | 2.23 ms | 3.10 ms | 4.89 ms |
| Four selected tests | 2.17 ms | 3.07 ms | 4.48 ms |
| Package-only test | 2.24 ms | 3.50 ms | 4.94 ms |
| All 19 selectable tests | 7.38 ms | 10.71 ms | 19.70 ms |

All measured requests completed below the required 300 ms response-time threshold. The highest recorded latency was **19.70 ms**.

These results reflect local sequential HTTP testing and may vary with hardware, server load, network conditions, and other test selections.

#### Scalability with 40 Packages

With 40 relevant packages, exhaustive subset enumeration would require evaluating up to approximately 1.1 trillion combinations (`2^40`). This would be computationally impractical.

For a larger catalog, the optimization strategy would need to change. Possible approaches include:

- Dynamic programming over selected-test coverage states.
- Branch-and-bound search to eliminate combinations that cannot improve the current best solution.
- Additional preprocessing to remove dominated package options while preserving the required tie-breaking behavior.

The current implementation intentionally targets the supplied dataset and limits exhaustive enumeration to 20 relevant packages.

## Catalog assumptions and data cleanup

The supplied `data/lab-catalog.json` is kept unchanged. Normalization is applied in memory:

- Remove duplicate test references inside a package, preserving first occurrence.
- Ignore nonexistent package test references (for example `P12` references `T99`).
- Exclude inactive test references from package coverage.
- Exclude inactive tests (`T19`) from selection and inactive packages (`P10`) from sale.
- Omit packages with no valid test references after cleanup.
- Keep valid `price: null` tests selectable; these must be purchased through a package.
- Reject malformed catalog entities and duplicate entity IDs instead of silently guessing.

## Frontend behavior

The React interface supports searchable test selection by name or code, removable selected-test chips, package-only labels, and live recommendations. The recommendation panel shows each purchased item, its price, the selected tests it covers, any bonus tests, the lowest total, and positive savings where comparable. If individual purchase is impossible, the UI explains that savings cannot be calculated.

Loading, empty, API error, and retry states are handled explicitly. On each new selection, the UI cancels the prior request and uses a request-generation check so an older response cannot overwrite a newer one, even if cancellation is ignored by the network transport. The prior quote is hidden immediately when the selection changes. Layout and main interactions were manually checked at a mobile width of 375 px.

## Test cases

The automated tests cover **all three supplied expected-output examples**, with additional tests for catalog irregularities, selection deduplication, unavailable tests, ranking/tie-break rules, API validation, and frontend request ordering.

Sample cases from the provided data:

| Selected test IDs | Expected plan | Total | Savings |
| --- | --- | ---: | ---: |
| `T02, T03, T04, T06` | `P02` | ฿1,500 | ฿320 |
| `T01, T02, T03, T04, T05, T06, T07` | `P02` + individual `T01`, `T05`, `T07` | ฿2,850 | ฿320 |
| `T15` | `P08` (also includes `T14`) | ฿900 | Not comparable |

Run `npm test` in both `backend/` and `frontend/` to reproduce the automated checks.

## Limitations and next improvements

- The exact optimizer is sized for the provided catalog, not an unrestricted 40-package marketplace.
- A dedicated end-to-end HTTP performance benchmark is still needed to demonstrate the 300 ms target consistently.
- Automated browser E2E testing (for example, Playwright) would further strengthen interaction and accessibility coverage.
- A production catalog would benefit from persistent storage, catalog update workflows, and operational monitoring.

## AI assistance disclosure

ChatGPT was used throughout development to assist with project scaffolding, implementation of the optimization algorithm, API and frontend components, test generation, debugging, and documentation.
The implementation was developed incrementally with Git commits and pull requests. I reviewed and tested the application locally, verified the supplied assessment examples, resolved integration issues, and validated the frontend and backend builds.

I understand the implementation decisions and i,m prepared to explain the solution, discuss trade-offs, and modify the code during the technical interview.

## Development history

The Git commit history and feature pull requests show the progression from the initial scaffold through catalog normalization, bundle optimization, API integration, test selection, live recommendations, and fixes. Each milestone was committed as actual project work rather than recreating artificial history.
