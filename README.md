# MedEx — Lab Test Bundle Finder

Full-stack take-home assessment, **Task 1**. Work in progress: the catalog API, exact optimizer, planning API and lab-test selection frontend are implemented; live plan display is the next milestone.

## Progress

- [x] Monorepo directory structure and original `lab-catalog.json` dataset
- [x] NestJS API scaffold and `GET /api/health` development endpoint
- [x] React + Vite frontend scaffold (replaced the initial API connectivity placeholder in Commit 5)
- [x] Normalize the catalog and implement `GET /api/tests`, `GET /api/packages`
- [x] Implement exact minimum-cost planner as a pure TypeScript function
- [x] Add all three official fixture tests and algorithm edge-case tests
- [x] Expose and validate `POST /api/plan` through NestJS
- [x] Build accessible test search, selected-test chips, removal, empty/loading/catalog error states and retry
- [ ] Connect live optimization requests, explain plans, and handle stale responses and planning errors
- [ ] Verify performance, accessibility, responsive layout and README

## Project layout

- `backend/` — NestJS + TypeScript API (port 3001)
- `frontend/` — React + Vite + TypeScript UI (port 5173)
- `data/lab-catalog.json` — supplied MedEx catalog, kept unchanged

## Run locally

Requirements: Node.js 22+ and npm.

```bash
# Terminal 1
cd backend
npm install
npm run dev
```

```bash
# Terminal 2
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api/*` requests to `http://localhost:3001`; the test-selection UI currently calls `GET /api/tests`. The planner summary is intentionally a placeholder until the next milestone. The original `GET /api/health` endpoint remains for development diagnostics only.

## API

- `GET /api/tests` — active tests, including those only available in a package (`price: null`)
- `GET /api/packages` — active packages, with duplicate/unknown test IDs cleaned up
- `POST /api/plan` — accepts `{ "testIds": ["T02", "T03"] }` and returns the cheapest plan (HTTP `200`)

The implementation must reproduce the exact supplied expected outputs and use the specified tie-breaking order.

## Assumptions and limitations

Current stage implements catalog loading, both catalog endpoints, the pure optimizer, `POST /api/plan`, and a responsive search/selection interface. The **plan display is not connected yet**: the right panel does not display calculated prices, package recommendations or savings. These will be added as the next milestone.

Catalog handling assumptions:
- Ignore repeated test references inside a package, preserving the first occurrence and original order.
- Ignore nonexistent test references in packages (`P12` lists `T99`).
- Remove inactive test references from packages because customers cannot select those tests.
- Hide inactive tests (`T19`) and packages (`P10`) from their respective listing endpoints.
- A package with no valid tests after cleanup is omitted from the available-package listing.
- Keep the supplied JSON dataset unchanged. Reject malformed records and duplicate entity IDs early.

These decisions will be kept consistent with the planner and reviewed against MedEx's expected outputs.

## Planner algorithm (Commit 3)

`backend/src/planner/plan.ts` implements an **exact**, not greedy, minimum-cost plan for the small supplied catalog:

1. Deduplicate requested test IDs, preserving their first-occurrence order. Reject unknown/inactive selections.
2. Take only active packages covering at least one requested test. A test with `price: null` must be obtainable from a package.
3. Give each requested test a bit in a bitmask. Enumerate every combination of the relevant packages (at most 12 for this catalog), and compute the tests covered by each combination.
4. Purchase every still-uncovered test individually, if possible. Collect distinct bonus tests supplied by the chosen packages.
5. Choose a plan by **(a)** lowest cost, **(b)** fewest purchased items, **(c)** fewest distinct extra tests, and **(d)** alphabetical comparison of sorted item IDs.
6. Return sorted items, each item's `covers` in the original selection order, total, extra tests, individual purchase total (or `null`) and savings (or `null`).

All values in this dataset are whole Thai baht, so integer sums are exact.

**Performance/scalability:** Exhaustively enumerating subsets costs roughly `O(2^P × P × T)` in this implementation, where `P` is the number of relevant packages and `T` the selected-test count. For the supplied 13-package catalog, one package is inactive, so at most `2^12 = 4,096` subsets are examined. The slowest planner check against the full catalog took less than 300 ms in the development environment, but the actual deployment environment must also be measured. With 40 relevant packages, `2^40` combinations would be infeasible; this would require redesigning the search (for example, branch-and-bound or coverage-mask dynamic programming with tie-break-aware state). This implementation explicitly rejects inputs with more than 20 relevant packages or 30 selected tests rather than silently returning a slow or incorrect answer.

## Planning API (Commit 4)

The planner endpoint uses a small NestJS controller/service/module layer over the pure `calculatePlan()` function.

```http
POST /api/plan
Content-Type: application/json

{ "testIds": ["T02", "T03", "T04", "T06"] }
```

A successful response (`200`) contains `items`, `total`, `extraTests`, `individualTotal`, and `savings`, exactly as in the supplied examples. `items` are sorted by ID; each item's `covers` lists requested tests in original selection order.

Error responses use the assignment's schema `{ "error": "<CODE>", "testIds": [...] }`:

- `400 EMPTY_SELECTION`: missing or empty `testIds`.
- `400 INVALID_TESTS`: unknown or inactive test IDs, reported once each in selection order.
- `422 NOT_AVAILABLE`: a valid selected test cannot be obtained individually or through an active package.
- **Assumption for malformed requests:** non-array `testIds` or arrays containing non-strings return `400 INVALID_TESTS` with `testIds: []`, since non-string values cannot be identified as test IDs. Extra request properties are ignored.

The API returns HTTP `200` for successful POST requests instead of NestJS's default `201`. Unexpected server failures are not disguised as validation errors.

To verify manually while the backend runs:

```bash
curl -i -X POST http://localhost:3001/api/plan \
  -H "Content-Type: application/json" \
  -d '{"testIds":["T02","T03","T04","T06"]}'
```

Automated HTTP integration tests start the actual NestJS application on an ephemeral localhost port and compare every official example with the exact JSON response. They also check both catalog endpoints and validation behavior.

## Backend checks (this stage)

```bash
cd backend
npm install
npm test
npm run dev
```

Expected: **35 checks** — nine catalog normalization checks, 16 planner checks, and ten API integration checks (including three official examples through HTTP). The complete NestJS integration suite must be verified locally. You can also visit:

- `http://localhost:3001/api/tests` (19 active tests)
- `http://localhost:3001/api/packages` (12 active packages)
- `POST http://localhost:3001/api/plan` (send JSON as shown above)

## Frontend selection interface (Commit 5)

`frontend/src/App.tsx` fetches the selectable catalog from `GET /api/tests`, with distinct loading, success, empty-results and connection-error states. The app provides:

- Case-insensitive, whitespace-tolerant search by **name or code**.
- Selectable test rows with `aria-pressed`, keyboard-accessible controls and a visible selection count.
- Selected-test chips with individually labeled remove actions and a `Clear all tests` option.
- Explicit `Package only` text for tests with a `null` individual price (not a zero-price claim).
- A mobile layout with breakpoints, including a 375 px target. Visual verification at that width still needs to be completed locally.
- Retry for catalog fetch errors, with an `AbortController` to clean up abandoned requests.

Search and toggle logic lives in the pure `frontend/src/selection.ts` helper and has nine automated tests. The UI deliberately does **not** call `POST /api/plan` yet; that integration (including preventing stale responses from overwriting new ones) will be implemented in the next commit.

```bash
cd frontend
npm install
npm test       # 9 frontend selection tests; Node.js 22+ needed
npm run build  # TypeScript check and Vite production build
npm run dev
```

The unit tests and isolated helper TypeScript check passed in the development environment. Complete frontend build/browser checks must be performed locally because npm dependencies were unavailable in that environment.

## AI-assistance disclosure

ChatGPT assisted with initial scaffolding, project structure, catalog loading/normalization, the initial planner implementation, NestJS API integration, validation and test cases, responsive React catalog selection UI, frontend selection tests, and README updates. Subsequent AI use will be documented here as work progresses. The applicant will review, test and explain the submitted code.

## Development history

Each working, verified milestone should be committed individually as it occurs. Existing completed starter code is a reference, **not** a source of retrospectively fabricated commit history.
