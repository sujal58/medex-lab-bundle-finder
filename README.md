# MedEx — Lab Test Bundle Finder

Full-stack take-home assessment, **Task 1**. This is the initial project scaffold, not a finished submission.

## Progress

- [x] Monorepo directory structure and original `lab-catalog.json` dataset
- [x] NestJS API scaffold and `GET /api/health` development endpoint
- [x] React + Vite frontend scaffold and API connectivity indicator
- [ ] Normalize the catalog and implement `GET /api/tests`, `GET /api/packages`
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

## Required API (not implemented yet)

- `GET /api/tests`
- `GET /api/packages`
- `POST /api/plan`

The implementation must reproduce the exact supplied expected outputs and use the specified tie-breaking order.

## Assumptions and limitations

This commit intentionally does **not** implement the optimizer, catalog endpoints, the final UI, or the required tests. It only establishes the runnable full-stack structure.

## AI-assistance disclosure

ChatGPT assisted with initial scaffolding, project structure, and setup documentation. Subsequent AI use will be documented here as work progresses. All implementation decisions, functionality, and test results will be reviewed and verified before submission.

## Development history

Each working, verified milestone should be committed individually as it occurs. Existing completed starter code is a reference, **not** a source of retrospectively fabricated commit history.
