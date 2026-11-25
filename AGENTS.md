# AGENTS.md — EggTrack AI

Instructions for AI coding agents working in this repository. Read this file before
making changes. If an instruction here conflicts with a direct user request, ask for
clarification instead of guessing.

## 1. Project overview

EggTrack AI is a poultry egg production, ordering, delivery, inventory, and forecasting
system. It is a Django REST API (`eggtrack_backend/`) consumed by a React single-page
application (`frontend-react/`), backed by MariaDB/MySQL, and packaged with Docker Compose.

Core capabilities:

- Daily egg production records (per batch) with good/broken/dirty counts.
- Buyers with structured Philippine addresses and GPS geocoding.
- Orders with egg size/type, tray or per-piece quantity, payment tracking, and
  auto-generated order numbers.
- Deliveries with staff assignment, photo proof, base64 signature, failure reasons,
  and buyer ratings.
- Inventory ledger (`Inventory` + `StockLog`) updated automatically by production,
  order approval, cancellation, and delivery.
- In-app notifications and console email notifications.
- AI helpers: linear-regression production forecast, z-score anomaly detection, and
  order-vs-forecast overcommitment checks.
- CSV exports for orders, buyers, production, deliveries, inventory, stock logs, alerts.

## 2. Repository map

Root:

- `docker-compose.yml` — three services: `db` (MariaDB 10.11), `backend` (Django/Gunicorn,
  host port 8000), `frontend` (Nginx serving the built SPA, host port 80), on the
  `eggtrack-net` bridge network. Volumes: `db_data`, `static_data`.
- `.env` — environment values consumed by Docker Compose and Django. Never print,
  copy, commit, or expose its values.
- `venv/` — local Python 3.12 virtual environment. Not application code; do not edit.
- `test_auth.py`, `test_login.py`, `verify_auth.py` — ad-hoc `urllib` scripts that hit
  `http://127.0.0.1:8000/api/auth/login/`. They are manual probes, not a test suite.
- `nginx/default.conf` — standalone reverse-proxy config, **not** referenced by
  `docker-compose.yml` (the frontend image uses `frontend-react/nginx.conf`).

Backend — `eggtrack_backend/`:

- `manage.py`, `requirements.txt`, `Dockerfile` (python:3.12-slim, Gunicorn, 4 workers,
  120s timeout, runs `collectstatic` at build).
- `eggtrack_backend/settings.py`, `urls.py`, `asgi.py`, `wsgi.py` — Django project package.
- `core/` — the only Django app:
  - `models.py` — all domain models and `generate_order_number()`.
  - `serializers.py` — DRF serializers, including JWT login serializer.
  - `views.py` — ViewSets, `@action` endpoints, auth, AI, inventory, notification,
    registration, pricing, and buyer-validation endpoints.
  - `urls.py` — routes; registers ViewSets on a DRF `DefaultRouter`.
  - `admin.py` — Django admin registrations and colored status/preview helpers.
  - `apps.py`, `tests.py` (empty stub), `__init__.py`.
  - `export_views.py` — CSV export endpoints.
  - `ai_engine.py` — forecasting/anomaly/overcommitment logic.
  - `inventory_service.py` — inventory mutation helpers and `get_current_stock()`.
  - `notifications_service.py` — in-app notification and email helpers.
  - `geocode.py` — Nominatim/geopy geocoding.
  - `pricing.py` — egg price reference table and tray pricing.
  - `views_frontend.py` — legacy HTML page renderers; **not** wired into `core/urls.py`.
  - `migrations/0001_initial.py` … `0013_order_egg_size_order_egg_type_order_is_tray.py`.
- `delivery_proofs/` — runtime uploaded images that exist in the working tree. Do not
  delete, overwrite, or commit new files here.

Frontend — `frontend-react/`:

- `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`,
  `tsconfig.app.json`, `tsconfig.node.json`, `.oxlintrc.json`, `index.html`,
  `Dockerfile` (node:20-alpine build → nginx:alpine), `nginx.conf`, `.env`,
  `README.md` (default Vite template text).
- `src/main.tsx` — React root; imports Leaflet CSS and `index.css`.
- `src/App.tsx` — `BrowserRouter`, providers, and all routes.
- `src/index.css` — Tailwind 4 import, class-based dark-mode variant and overrides.
- `src/api/api.ts` — axios client, JWT interceptor, typed-ish API helpers, export URLs.
- `src/components/` — `ExportButton`, `Layout`, `Navbar`, `NotificationBell`,
  `Pagination`, `ProtectedRoute`, `SearchBar`.
- `src/context/` — `AuthContext` (JWT + user), `ThemeContext` (dark mode).
- `src/layouts/` — `AdminLayout`, `UserLayout`.
- `src/pages/` — 21 page components; admin pages live in `src/pages/admin/`.
- `src/data/philippines.ts` — province/municipality/barangay reference data.
- `src/types/leaflet-routing-machine.d.ts` — ambient types.

## 3. Architecture

### Request flow

- `frontend-react/nginx.conf` serves the built SPA and proxies `/api/` to `backend:8000`,
  with SPA fallback (`try_files … /index.html`).
- Django mounts `/admin/` (Django admin) and `/api/` (`core.urls`).
- `core/urls.py` registers ViewSets on a `DefaultRouter`: `buyers`, `production`,
  `orders`, `deliveries`, `alerts`, `forecasts`, `users`, `ratings`.
- Custom path routes are declared **before** the router include; keep that order.

### Authentication and roles

- JWT via `djangorestframework-simplejwt`: 8-hour access token, 7-day refresh,
  refresh rotation enabled.
- Login is `POST /api/auth/login/` (`CustomTokenObtainPairView`), returning
  `{ access, refresh, user }`.
- Current user is `GET /api/auth/me/` (`IsAuthenticated`).
- Roles live in `UserProfile.role`: `ADMIN`, `WORKER`, `BUYER`, `DELIVERY`.
- Frontend stores `access_token` / `refresh_token` in `localStorage`, attaches the
  bearer token in the axios interceptor, and redirects to `/login` on HTTP 401.
- Route guarding is client-side in `ProtectedRoute` via `allowedRoles`; this is not a
  server-side authorization mechanism.

### Domain models (`core/models.py`)

`Buyer`, `Production`, `Order`, `Delivery`, `Alert`, `AIForecast`, `UserProfile`,
`Inventory`, `StockLog`, `Notification`, `DeliveryRating`.

Notable behavior:

- `Order.save()` recomputes `total_amount = quantity * price_per_egg` and assigns an
  `order_number` (`EGG-YYYY-XXXX`) on first save.
- `Order.balance`, `Production.production_rate`, `Inventory.total_eggs`,
  `AIForecast.accuracy` are read-only properties.
- `Delivery.mark_as_delivered()` sets `DELIVERED`, stamps `delivered_at`, and marks the
  order `COMPLETED`; `mark_as_failed(reason)` records the failure.
- `Production` allows multiple batches per date; there is no unique-date constraint.

### Services and cross-cutting logic

- `inventory_service` is called from production/order/delivery views to keep the ledger
  and `StockLog` consistent. Preserve these call sites when changing those flows.
- `notifications_service` exposes event handlers (`on_order_placed`,
  `on_order_approved`, `on_order_rejected`, `on_order_delivered`, `on_low_stock`).
- `ai_engine` exposes `predict_tomorrow_production`, `detect_anomaly`,
  `check_order_overcommitment`, `generate_daily_forecast`, `run_all_ai_tasks`.
- `geocode` is invoked during buyer creation/update and buyer self-registration; it uses
  the public Nominatim service and deliberately sleeps between attempts.

## 4. Tech stack (verified from manifests)

Backend (`requirements.txt`, `Dockerfile`):

- Python 3.12 (`python:3.12-slim` image; local venv is 3.12.10).
- Django 6.1.1, djangorestframework 3.18.0, djangorestframework-simplejwt 5.5.1,
  django-cors-headers 4.9.0, PyMySQL, Gunicorn 23.0.0, python-dotenv.
- numpy 2.5.3, pandas 3.0.6, scikit-learn 1.9.1, scipy, joblib, geopy 2.5.0,
  geographiclib, reportlab, tablib.

Frontend (`package.json`):

- React 19, React DOM 19, TypeScript ~6.0.2, Vite 8, `@vitejs/plugin-react`.
- Tailwind CSS 4 via `@tailwindcss/vite`; class-based dark mode.
- React Router 7, axios, `jwt-decode`, `react-hot-toast`.
- Leaflet 1.9, react-leaflet 5, react-leaflet-cluster, leaflet-routing-machine.
- recharts 3, jsPDF + jspdf-autotable, react-signature-canvas, `@headlessui/react`.
- `vite-plugin-pwa` (autoUpdate; manifest in `vite.config.ts`).
- Linting: `oxlint` with plugins `react`, `typescript`, `oxc`.

Data store: MariaDB 10.11 (Compose service `db`), accessed through `django.db.backends.mysql`
with `pymysql.install_as_MySQLdb()`.

## 5. Verified commands

These are the only tooling entry points that exist in the repository. Do not invent new
scripts, task runners, or CI commands.

### Docker (run from repository root)

```
docker compose config
docker compose up --build
```

`docker compose config` validates/renders the Compose file; `up --build` builds and runs
`db`, `backend`, and `frontend`. The SPA is on `http://localhost/`, the API on port 8000.

### Backend (run from `eggtrack_backend/`)

`python` is **not** on PATH in this environment. Use the virtualenv interpreter.

```
..\venv\Scripts\python.exe manage.py check
..\venv\Scripts\python.exe manage.py test
..\venv\Scripts\python.exe manage.py makemigrations
..\venv\Scripts\python.exe manage.py migrate
..\venv\Scripts\python.exe manage.py runserver
..\venv\Scripts\python.exe manage.py collectstatic --noinput
```

- `migrate`, `runserver`, and most data-touching commands require a reachable MySQL/MariaDB
  instance (the Compose `db` service, or an equivalent configured database).
- `check` performs Django system checks.
- `test` runs Django's built-in test runner against `core/tests.py` (currently empty).
- `STATIC_ROOT` is the container path `/app/static`, so `collectstatic` is intended for the
  Docker image, not local Windows runs.
- There is no `pytest.ini`, `tox.ini`, `pyproject.toml`, `.flake8`, or Python formatter
  config. Do not assume pytest or black/ruff exist.

### Frontend (run from `frontend-react/`)

```
npm run dev
npm run build
npm run lint
npm run preview
```

- `build` = `tsc -b && vite build`; it both type-checks and bundles.
- `lint` = `oxlint` using `.oxlintrc.json`.
- `dev` starts Vite on the host. Note the dev proxy target is the Docker hostname
  `backend:8000`, so the proxy only resolves inside the Compose network.
- There is no frontend test runner, no `*.test.*` / `*.spec.*` files, and no CI workflow.

## 6. Backend conventions

- All API code lives in the single `core` app. Add models, serializers, views, URLs, and
  admin registrations there; do not introduce a second app without approval.
- Prefer `viewsets.ModelViewSet` with `@action(detail=..., methods=[...])` for custom
  operations, matching the existing style.
- Keep custom `path(...)` entries above `path('', include(router.urls))` in `core/urls.py`;
  otherwise the router can shadow them.
- Serializers are centralized in `core/serializers.py`. Use computed read-only fields
  (e.g. `buyer_name`, `full_address`) the same way existing serializers do.
- Serializer `fields = '__all__'` is used widely. When adding fields, preserve existing
  response keys; clients depend on them.
- Business logic that mutates inventory/notifications is extracted into service modules.
  Call those helpers rather than duplicating ledger math inside views.
- `settings.py` is a single environment-driven module: `os.getenv` plus `load_dotenv()`.
  Do not hardcode credentials or environment values.
- `REST_FRAMEWORK` defaults to `JWTAuthentication` + `IsAuthenticated`, but most ViewSets
  explicitly override to `AllowAny`, and many function views use `AllowAny`. Keep current
  permission behavior unless the task is specifically about permissions.
- Django admin registrations include display helpers built with `format_html`; follow that
  pattern when extending admin.
- Django templates/HTML rendering is legacy (`views_frontend.py` is unrouted). Do not build
  new server-rendered pages; the product UI is the React app.
- Keep imports and structure consistent with neighboring code. Some comments are written
  in Taglish (e.g. `# ✅ Gigamit ang API_URL`); do not translate or reformat them.

## 7. Frontend conventions

- Routing is centralized in `src/App.tsx` using `BrowserRouter` + nested layout routes.
  Role restrictions use `ProtectedRoute allowedRoles={[...]}`. Add new admin screens under
  `/admin/...` and register them in `App.tsx`.
- Pages are default-exported function components in `src/pages/`; shared UI goes in
  `src/components/`; layout shells in `src/layouts/`.
- The axios instance in `src/api/api.ts` is the preferred API client (base URL
  `import.meta.env.VITE_API_BASE_URL || '/api'`, bearer token interceptor, 401 redirect).
  Some existing pages also call `axios` directly with hardcoded `:8000` URLs; do not
  propagate that pattern to new code.
- Authentication state comes from `AuthContext` (`user`, `login`, `logout`, `loading`);
  use `useAuth()` rather than reading tokens ad hoc in components.
- Styling is Tailwind utility classes. Dark mode is class-based (`.dark`) with overrides in
  `src/index.css`; use existing color/spacing/rounded conventions.
- User feedback uses `react-hot-toast`; confirmations use `confirm()` in some admin pages.
- Reference data (Philippine addresses) lives in `src/data/philippines.ts`.
- TypeScript config: `verbatimModuleSyntax` is on (use `import type` for type-only imports);
  `noUnusedLocals`/`noUnusedParameters` are off for app code but on for `vite.config.ts`.
- PWA behavior and manifest are configured in `vite.config.ts`. Avoid changing manifest or
  service-worker settings unless the task requires it.

## 8. Environment and configuration

Environment files present: root `.env` (Compose + Django) and `frontend-react/.env`
(frontend build-time vars).

Variable names in use (values must never be copied into code, docs, logs, commits, or
agent output):

- Root: `DB_ROOT_PASSWORD`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`,
  `SECRET_KEY`, `NETWORK`.
- Frontend: `VITE_API_BASE_URL`.

Docker Compose passes `SECRET_KEY`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and
`DB_PORT` to the backend, and supplies the `DB_*` values plus `DB_ROOT_PASSWORD` to MariaDB.
`DB_HOST` defaults to the Compose service name `db`.

Do not create, modify, print, or overwrite `.env` files or secrets unless the user
explicitly requests it. Never embed real credentials in source, tests, or documentation.

## 9. Safe modification rules

1. Inspect before editing: read the relevant model, serializer, view, URL, service, and
   frontend page/component before changing behavior. Do not assume something is missing.
2. Keep the diff minimal. Change only what the task requires.
3. Preserve public API contracts: URL paths, HTTP methods, request/response field names,
   status codes, and serializer output keys.
4. Preserve existing business rules, especially order totals/order numbers, inventory
   ledger transitions, notification triggers, role checks, and delivery state changes.
5. Do not perform unrelated refactors, renames, reformatting, file moves, or cleanup.
6. Do not add dependencies, frameworks, or tooling unless the task genuinely requires it
   and the user approves.
7. Do not edit `venv/`, `node_modules/`, `delivery_proofs/`, `__pycache__/`, build output,
   or already-applied migrations.
8. Do not add comments unless requested; match the surrounding code's existing comment
   style.
9. If a change would exceed the requested scope, stop and ask for approval before
   proceeding. State which extra files/areas would be affected and why.
10. This working copy is not a git repository. Do not assume git history, branches, or
    git-based tooling; do not run destructive VCS commands.

## 10. Security rules

- Never weaken authentication or authorization. Most ViewSets currently use
  `permissions.AllowAny`; do not broaden access further, and do not silently change
  existing permissions as a side effect of an unrelated task.
- Preserve `IsAuthenticated` on endpoints that already require it (`/api/auth/me/`, and the
  notification endpoints).
- Never introduce hardcoded secrets, tokens, passwords, or API keys. Never log request
  credentials or `.env` values.
- Validate and sanitize new inputs (registration, staff creation, order/payment updates,
  delivery proof/signature uploads, CSV exports) consistently with existing validation.
- Do not weaken existing CORS, CSRF, `ALLOWED_HOSTS`, or upload handling. Changes to
  `DEBUG`, `ALLOWED_HOSTS`, `CORS_*`, or `CSRF_TRUSTED_ORIGINS` require explicit approval.
- Treat buyer PII (name, email, phone, address, GPS coordinates) and payment data as
  sensitive. Do not add logging or exports that expose more than the existing endpoints.
- Avoid destructive database or file operations. If unavoidable, clearly describe the
  impact and ask for approval first.

## 11. Database and migrations

- Engine: MySQL via PyMySQL, configured from `DB_*` environment variables.
- Migrations live in `core/migrations/`; latest is `0013_order_egg_size_order_egg_type_order_is_tray.py`.
- Never edit an already-applied migration. Add a new migration for every model change and
  review it before applying.
- Do not run destructive migrations, drop tables/columns, or delete data without explicit
  approval and a stated rollback/safeguard plan.
- Keep `models.py`, serializers, admin, and migrations consistent when changing schema.

## 12. Testing and verification

There is no established automated test coverage:

- `core/tests.py` is an empty stub; the Django test runner will discover nothing today.
- There is no frontend test framework or test script.

Expected verification for any change:

1. `..\venv\Scripts\python.exe manage.py check` — validates Django configuration/imports.
2. `..\venv\Scripts\python.exe manage.py test` — runs the Django test suite. When you add or
   change backend behavior, add `django.test.TestCase` coverage in `core/tests.py` (or
   `core/tests/`) and make it pass.
3. `npm run lint` — runs oxlint; resolve new lint errors.
4. `npm run build` — type-checks (`tsc -b`) and bundles the SPA; must succeed.
5. `docker compose config` — validates the Compose file after any Compose/env change.
6. Manual smoke test with `docker compose up --build`, and for backend flows that touch the
   database, verify the affected endpoints (`/api/...`) and the corresponding UI screens.
7. For migration changes, run `makemigrations` then `migrate` against a disposable/dev
   database and confirm the migration is additive and reversible where practical.

Before finishing, re-check:

- No secrets or `.env` values added to code, docs, or output.
- Changes are limited to the requested scope.
- API contracts and role checks are unchanged unless intended.
- Relevant commands above pass or failures are explained.

## 13. Known caveats (verified; do not "fix" opportunistically)

- `core/views.py` imports `.ai_service` inside `ProductionViewSet.perform_create` and
  `AIForecastViewSet.generate`, but no `ai_service.py` exists; those calls are wrapped in
  try/except and merely print errors. The real implementation is `core/ai_engine.py`.
- `core/serializers.py` defines `DeliverySerializer` twice; the second definition (with
  `order_number`, `order_address`, `buyer_lat`, etc.) wins.
- `settings.py` defines no `MEDIA_ROOT` / `MEDIA_URL`, even though `Delivery` has
  `ImageField`s. Upload behavior depends on Django defaults.
- `TEMPLATES['DIRS']` points at `BASE_DIR.parent / 'frontend'`, which does not exist (the
  SPA lives in `frontend-react/`).
- `core/views_frontend.py` HTML view functions are not routed anywhere.
- Several frontend files hardcode `http://${window.location.hostname}:8000/api`
  (`AuthContext.tsx`, `AdminOrders.tsx`, `EXPORT_URLS` in `api.ts`), while the shared axios
  client uses `/api`.
- `vite.config.ts` dev proxy targets `http://backend:8000`, a Docker-only hostname.
- The repo `venv` contains packages not pinned in `requirements.txt` (for example
  `django-crontab`, `django-import-export`). `requirements.txt` is the container source of
  truth; do not rely on unpinned local packages.
- `.env` contains a `NETWORK` key that `docker-compose.yml` does not reference (Compose
  defines its own `eggtrack-net` bridge).

These are recorded for accuracy. Fixing any of them is out of scope unless explicitly
requested.

## 14. Approval gates

Stop and request explicit approval before doing any of the following:

- Changing the database schema in a non-additive or destructive way, or applying
  migrations to non-development data.
- Changing authentication, authorization, permissions, CORS/CSRF, `DEBUG`, or
  `ALLOWED_HOSTS`.
- Adding or removing dependencies, changing versions, or modifying Dockerfiles,
  `docker-compose.yml`, or Nginx configs.
- Changing public API contracts (paths, methods, payload/response fields, status codes).
- Refactoring across modules, renaming/moving files, or modifying files outside the
  requested task's scope.
- Modifying `.env` files, secrets, `venv/`, `node_modules/`, or `delivery_proofs/`.
- Deleting files or data.

If requirements are ambiguous or essential information is missing, ask for clarification
rather than assuming.
