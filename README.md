# MedEx — Lab Test Bundle Finder

Full-stack take-home assessment, **Task 1**. Work in progress: catalog endpoints and normalization are implemented; planning and the final UI are still pending.

## Progress

- [x] Monorepo directory structure and original `lab-catalog.json` dataset
- [x] NestJS API scaffold and `GET /api/health` development endpoint
- [x] React + Vite frontend scaffold and API connectivity indicator
- [x] Normalize the catalog and implement `GET /api/tests`, `GET /api/packages`
- [ ] Implement and test exact minimum-cost planner (`POST /api/plan`)
- [ ] Add official fixture tests and edge cases
- [ ] Build test search, selection, plan explanation, and error states
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

Open `http://localhost:5173`. The UI requests `/api/health` using Vite's development proxy.
This health endpoint is **scaffold-only** and is not part of the required assessment API.

## API

- `GET /api/tests` — active tests, including those only available in a package (`price: null`)
- `GET /api/packages` — active packages, with duplicate/unknown test IDs cleaned up
- `POST /api/plan` — not implemented yet (next milestone)

The implementation must reproduce the exact supplied expected outputs and use the specified tie-breaking order.

## Assumptions and limitations

Current stage implements catalog loading and both catalog endpoints. The optimizer and final UI are not implemented yet.

Catalog handling assumptions:
- Ignore repeated test references inside a package, preserving the first occurrence and original order.
- Ignore nonexistent test references in packages (`P12` lists `T99`).
- Remove inactive test references from packages because customers cannot select those tests.
- Hide inactive tests (`T19`) and packages (`P10`) from their respective listing endpoints.
- A package with no valid tests after cleanup is omitted from the available-package listing.
- Keep the supplied JSON dataset unchanged. Reject malformed records and duplicate entity IDs early.

These decisions will be kept consistent with the planner and reviewed against MedEx's expected outputs.

## Backend checks (this stage)

```bash
cd backend
npm install
npm test
npm run dev
```

Expected: nine catalog normalization checks pass. You can also visit:

- `http://localhost:3001/api/tests` (19 active tests)
- `http://localhost:3001/api/packages` (12 active packages)

## AI-assistance disclosure

ChatGPT assisted with initial scaffolding, project structure, catalog loading/normalization code, and test suggestions. Subsequent AI use will be documented here as work progresses. The applicant will review, test and explain the submitted code.

## Development history

Each working, verified milestone should be committed individually as it occurs. Existing completed starter code is a reference, **not** a source of retrospectively fabricated commit history.
