# Backend foundation (00B)

**E5 complete:** public real package catalog, atomic Employer registration (COMPANY_MEMBER/ACTIVE +PENDING company +OWNER/ACTIVE), own company GET/PATCH and OWNER-only RECRUITER create/list/status APIs. FREE1/PRO5 monthly0 are the two explicitly approved Development catalog rows; OWNER counts toward quota.103 MySQL tests, Employer8/Candidate7 browser checks pass; no schema changes/payment/NLP. [E5 API/files/verification](../docs/E5_EMPLOYER_MVP_DECISIONS.md). Jobs content DTO/unit tests started; additional job schema/status decisions remain unapproved, see E6 review.

Full rollback-isolated verification from root: `backend/.venv/Scripts/python.exe scripts/verify_auth_mysql.py --include-profile --include-company`. `scripts/seed_company_packages.py` prints catalog review by default; `--apply-approved` is authorized only for the fixed E5 FREE/PRO rows, skips matching existing rows and stops on quota/price differences without overwriting. Does not seed accounts/companies/members/Admin. Employer Frontend is wired to real APIs, and unimplemented recruitment actions no longer report demo success.

**E4 complete:** recruitment_db now has the six approved Auth tables and alembic_version20261102_01, zero seeded business rows. Candidate Register/Login/Me and GET/PATCH /api/v1/candidates/me/profile are live; Frontend Candidate Auth/Profile uses real API calls and memory-only tokens.54 MySQL tests and7 browser checks pass with fixtures isolated to recruitment_auth_test; local146 passed/55 skipped, Ruff/compileall/TypeScript/ESLint pass. The one-time Development DDL gate is closed after the successful apply. [Current results, receipts and remaining Employer decisions](../docs/AUTH_E3C_PREFLIGHT_2026-11-02.md). Older pending E4/schema/test statements below are history.

Run the authorized rollback-only Auth/Register/Profile verification from root with `backend/.venv/Scripts/python.exe scripts/verify_auth_mysql.py --include-profile`. It inherits ignored test credentials by variable name, never uses development as fixtures, and does not create/drop/migrate tables. `execute_auth_development.py` refuses to rerun when its execution receipt exists. Runtime Compose mounts app source read-only; backend restart/recreate loads code, never auto-migrates. Frontend public origin example is in frontend/.env.example; do not put credentials there.

Current E4: P1/P2 are complete on recruitment_auth_test (32 real-MySQL cases passed). Register Candidate source now adds POST /api/v1/auth/register/candidate with atomic account/profile creation; it is unit-tested, not yet deployed or verified against MySQL. Development recruitment_db is still empty. The dedicated Alembic `-x target=development` path remains blocked by `DEVELOPMENT_DDL_APPROVED=False` pending explicit user confirmation; startup never migrates. [Current target, checkpoint, proposed apply command and recovery](../docs/AUTH_E3C_PREFLIGHT_2026-11-02.md). Historical closed test gates/unresolved Auth schema statements below are superseded.

Approved E3b update: the six-table Auth Models and frozen `20261102_01` revision now implement all 54 confirmed nullable/default decisions, email/table collations and five RESTRICT FKs. Online application/provision/fixture DML remain explicitly blocked until E3c approval. Export final SQL **without database access** from backend:

```powershell
.venv/Scripts/python.exe -m app.db.export_auth_migration --output ../docs/reports/auth_20261102_01_mysql.sql
```

The exporter uses Alembic `sql=True` offline rendering, without engine/settings/connection; it only writes a local SQL file. [E3b handoff](../docs/AUTH_E3B_COMPLETION_2026-11-02.md) contains confirmed decisions, SQL/checksums, unit results, recovery checkpoints and E3c prerequisites. Do not run online upgrade, stamp, create_all or fixture DML based on schema approval. Earlier statements below about unresolved Auth null/defaults are historical.

Latest Models update (2026-11-02): `app/models` now maps all 16 ERD R2 tables, 136 columns and 23 foreign keys. Alembic draft `20261102_01` snapshots only the six-table Auth foundation including `tinhthanh`. It is **not approved/applied** and blocks on unresolved null/default decisions before connecting for migrations. See [Models and migration review](../docs/MODELS_ALEMBIC_REVIEW_2026-11-02.md). The development database remains empty. Historical statements below about absent Models/revisions are superseded by this update.

Safe review commands from `backend/` (no database mutations):

```powershell
.venv/Scripts/python.exe -m alembic history
.venv/Scripts/python.exe -m alembic heads
.venv/Scripts/python.exe -m app.db.migration_review
```

Read the actual development revision from the repository root using the separately built checks image:

```powershell
docker compose --profile tools run --rm --no-deps checks python -m alembic current --verbose
```

Only the checks image packages Alembic configuration/revisions; the runtime image does not migrate at boot. The SQL review artifact contains unresolved placeholders and cannot be applied. Do not run upgrade/stamp/DDL until the final Auth schema/SQL and the specific test/development application have been separately approved.

Current infrastructure status (2026-11-02): MySQL 8.4.13 and FastAPI Docker containers are healthy, SQLAlchemy/readiness and HTTP Swagger checks pass. The development database has no business tables; Auth successful-login MySQL tests remain blocked by unreviewed schema. See [infrastructure report](../docs/AUTH_MYSQL_INFRASTRUCTURE_2026-11-02.md), [migration review](../docs/AUTH_SCHEMA_MIGRATION_REVIEW.md), and [isolated integration test guide](AUTH_MYSQL_TESTING.md). Do not run migrations or create tables from test fixtures.

2026-11-02 update: real `POST /api/v1/auth/login` and `GET /api/v1/auth/me` are mounted against existing ERD tables. Approved role/status policy and per-request SQLAlchemy Session wiring are implemented. Company PENDING/REJECTED can authenticate; recruitment guards require APPROVED. No registration, migration or business tables are created. Recorded non-NULL lock data returns 503 until a lock policy is approved. See [current implementation report](../docs/AUTH_LOGIN_IMPLEMENTATION_2026-11-02.md); older foundation notes below describe earlier stages.

2026-11-02 update: real `POST /api/v1/auth/login` and `GET /api/v1/auth/me` are mounted against existing ERD tables. Approved role/status policy and per-request SQLAlchemy Session wiring are implemented. Company PENDING/REJECTED can authenticate; recruitment guards require APPROVED. No registration, migration or business tables are created. Recorded non-NULL lock data returns 503 until a lock policy is approved. See [current implementation report](../docs/AUTH_LOGIN_IMPLEMENTATION_2026-11-02.md); older foundation notes below describe earlier stages.

Python 3.12, FastAPI/Pydantic v2, SQLAlchemy 2 + PyMySQL, MySQL 8.4, Alembic installed for the later reviewed migration phase. Production routes are health/documentation only; Auth building blocks are implemented below. No account models, migrations, schema creation, account endpoints or CRUD yet.

Auth foundation update: app/auth now implements HS256 JWT creation/verification (1800 seconds), request/response schemas, Bearer/current-principal dependencies, Admin and ownership guards, and OpenAPI components. Account login/registration endpoints and production database wiring are not configured yet. The dependency fails closed with 503 without an account resolver; tests use explicit doubles only. See docs/AUTH_FOUNDATION_IMPLEMENTATION.md for scope and test results.

The account module also has a read-only SQLAlchemy Core projection, CredentialService, and AccountPrincipalResolver bridge. They require a caller-owned Session and explicitly approved access policy; production request wiring is still pending. Query expressions do not define ORM schema or create tables. Never share a session-bound reader across requests or install a test policy as a production fallback. Latest local suite: 68 passed, 1 MySQL integration skipped; repository checks compile MySQL SQL using test doubles.

Run `python scripts/init_local_env.py` at repository root to add an independent JWT_SECRET if an existing .env lacks it; existing DB passwords and existing JWT key are preserved. Backend receives this key via Compose. Logout removes the memory token on the client, without server token revocation; no refresh tokens are implemented. Frontend integration remains pending.

From repository root:

```powershell
python scripts/init_local_env.py
docker compose config --quiet
docker compose up --build -d backend
docker compose ps
```

The generator preserves an existing `.env`, uses independent random passwords, and prints no secret values. `.env` is ignored by Git. Do not publish rendered `docker compose config` output because it contains resolved secrets. Backend receives only application credentials; root DB credentials go only to MySQL. Do not change DB credentials in `.env` for an existing volume without a separate credential rotation plan.

API: `http://localhost:8000/docs`, `/openapi.json`, `/redoc`, `/health/live`, `/health/ready`. API binds only to `127.0.0.1`; MySQL has no published host port. Health readiness executes `SELECT 1`, without creating schema. MySQL initializes the development database/account on first use of a **new** volume; no ERD tables are created. Named volumes persist MySQL data and private CV files. CV endpoints are not implemented.

Default `CORS_ORIGINS=http://localhost:3000` is the Next.js dev default; adjust to the actual frontend origin. At this phase only GET is allowed and credentialed CORS is disabled. Authentication/security schemes will be added with real authentication in module 01. Set `SWAGGER_ENABLED=false` to disable all three documentation URLs.

Verification in Docker (runtime is non-root; checks image includes dev tools):

```powershell
docker compose --profile tools run --build --rm checks python -m ruff check app tests
docker compose --profile tools run --rm checks python -m ruff format --check app tests
docker compose --profile tools run --rm checks python -m pytest -q
docker compose exec backend python -c "from pathlib import Path; import tempfile; f=tempfile.TemporaryFile(dir='/data/cv'); f.close(); print('CV volume writable')"
```

The opt-in MySQL test is read-only (`SELECT 1`, version and charset); it is not a CRUD/FK/concurrency test. The checks service sets `RUN_MYSQL_TESTS=1`; ordinary local pytest skips that test. If the Docker daemon fails, do not label environment setup DONE from local unit tests.

Local verification without Docker/MySQL, from `backend/`:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install --require-hashes -r requirements-dev.txt
.venv/Scripts/python.exe -m ruff check app tests ../scripts/init_local_env.py ../scripts/verify_backend_http.py
.venv/Scripts/python.exe -m ruff format --check app tests ../scripts/init_local_env.py ../scripts/verify_backend_http.py
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe ../scripts/verify_backend_http.py
# Once Docker is healthy, verify its real API + successful DB readiness:
.venv/Scripts/python.exe ../scripts/verify_backend_http.py --base-url http://localhost:8000
```

The isolated HTTP smoke script starts a temporary Uvicorn process on loopback, checks real HTTP health/docs/schema and a sanitized 503 against a reserved non-listening DB port, then stops that process. It never uses a real DB or the local `.env`. To run the actual app manually, supply application settings via environment and use `python -m uvicorn app.main:create_app --factory`; Docker hostname `mysql` is only valid in its network. No import-time database connection is required.

Dependencies: `.in` files declare direct ranges; generated `.txt` files pin transitive versions and hashes with universal platform markers. Runtime image installs only `requirements.txt`; dev tools live in the separate `checks` target. Regenerate both locks from `backend/`:

```powershell
.venv/Scripts/python.exe -m uv pip compile requirements.in --universal --python-version 3.12 --generate-hashes -o requirements.txt
.venv/Scripts/python.exe -m uv pip compile requirements-dev.in --universal --python-version 3.12 --generate-hashes -c requirements.txt -o requirements-dev.txt
```

Never use `create_all()`, auto-run migrations on boot, or remove volumes to fix errors. Review the existing schema and migration plan before adding ERD tables. See `docs/MYSQL_IMPLEMENTATION_RULES.md` and the audit decisions before business modules.
