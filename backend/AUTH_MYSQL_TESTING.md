# Real MySQL Auth integration tests

**E5 current:**103 real-MySQL PASS/0 FAIL/0 SKIP =54 E4 +14 Company reads +35 Employer/company/member writes. Opt in via root wrapper `scripts/verify_auth_mysql.py --include-profile --include-company`; RUN_COMPANY_MYSQL_TESTS is forwarded by name only for its child. Test DB stays recruitment_auth_test with the existing runner privileges; no new DDL/grants/DELETE. Company fixtures are synthetic, rollback-only; the separately approved2 Development catalog rows are never used as test fixtures. Employer8/Candidate7 browser checks also use temporary test API8001 and rollback after clean stop. [Current results](../docs/E5_EMPLOYER_MVP_DECISIONS.md). Earlier E4/P2 counts below are historical.

**E4 current:**54 real-MySQL cases PASS =32 Auth/schema +3 Register Candidate +19 Profile. Run `backend/.venv/Scripts/python.exe scripts/verify_auth_mysql.py --include-profile` from root using the already authorized runner/test DB. The wrapper opts in all three suites only in the child process; .env.auth-test stays opt-in0. All six business tables are empty after rollback and schema/history unchanged. Browser verification additionally uses a temporary HTTP API on127.0.0.1:8001 bound to the same test fixture (serialized requests because one fixture Connection is shared); it is stopped after testing and never uses recruitment_db. Production uses pooled Session/request. [E4 results/receipts](../docs/AUTH_E3C_PREFLIGHT_2026-11-02.md). The32-case counts below describe the earlier P2 suite only.

**P1/P2 completed:** recruitment_auth_test has revision20261102_01, six approved business tables and zero remaining business rows after rollback. **32 passed, 0 failed, 0 skipped** on MySQL8.4.13: the required31 cases plus one runtime default/optional NULL case. Runner has exactly SELECT/INSERT/UPDATE on the six tables and SELECT on alembic_version; no DELETE/DDL. [Actual results/receipt and Development plan](../docs/AUTH_E3C_PREFLIGHT_2026-11-02.md). Local unit run separately returned127 passed/33 skipped; those skips are not the real-MySQL P2 result.

The approved fixture gate checks exact hostmysql/port3306/database recruitment_auth_test/user auth_test_runner before connecting, then verifies live DATABASE(), server UUID and CURRENT_USER(). Development remains rejected; migration permission is separate and still test-only. `.env.auth-test` stays RUN_AUTH_MYSQL_TESTS=0; the authorized runner script enables it only for its child process and forwards AUTH_TEST_* by name. It does not print secrets, change dev, migrate, seed or delete data. P2 script: `backend/.venv/Scripts/python.exe scripts/execute_auth_test_p2.py --execute-approved-p2` from repository root. This reapplies only the approved six INSERT/UPDATE grants and requires empty business tables before rerun; it never repairs data by deletion.

G1–G8 and all54 decisions were approved and implemented; P1 and P2 subsequently received separate explicit approvals and were executed. None authorizes development migration or unresolved onboarding/lock/package business rules. No Models/revision/ERD/SQL changes were needed in P2. The failed checks build was a registry TLS timeout; tests used the installed checks image with current app/tests/alembic mounted read-only, without restarting services or fetching dependencies.

The normal suite runs unit/security tests. `RUN_MYSQL_TESTS=1` only enables read-only server readiness/version/charset checks. It does not enable account fixtures.

Current coverage: **32 opt-in cases = 19 Auth + 12 schema/transaction + 1 runtime default case**. All require an **existing, separately reviewed MySQL 8.4 schema** in a separate database whose name ends in `_test`. They never create tables, apply Alembic revisions, drop/reset databases or volumes, or use SQLite. They do insert synthetic fixtures into the explicitly selected test database, inside an InnoDB transaction rolled back after each case. Account IDs may have gaps after rollback. This is test data, not a default registration package or business seed. The fixture now refuses to connect while the six-table model metadata still contains unresolved schema decisions; opting in is not approval of those decisions.

Schema G1–G8, provisioning/applying the test database and running fixture DML need their respective approvals. See [54-column decision matrix, least privileges, preflight and recovery plan](../docs/AUTH_SCHEMA_DECISIONS_2026-11-02.md). None is approved by collecting/skipping these tests.

Required environment in the calling shell, forwarded by name into the checks container:

```dotenv
RUN_AUTH_MYSQL_TESTS=1
AUTH_TEST_DATABASE=recruitment_auth_test
AUTH_TEST_DATABASE_CONFIRM=recruitment_auth_test
AUTH_TEST_MYSQL_HOST=mysql
AUTH_TEST_MYSQL_PORT=3306
AUTH_TEST_MYSQL_USER=auth_test_runner
AUTH_TEST_MYSQL_PASSWORD=<independent test database password, at least 16 characters>
```

Use a dedicated non-root test runner with SELECT/INSERT/UPDATE only on the six test business tables and SELECT on alembic_version. No DELETE is needed for rollback, and no DDL/global/other-database/admin/grant privileges should be granted. Provisioner and migrator are separate accounts/processes; verify actual grants and active roles before opting in. Non-root and a `_test` suffix alone do not prove least privileges or a non-production host. No fallback to `MYSQL_DATABASE`, app credentials, root user, or automatic test DB provisioning is allowed. `CONFIRM` must equal the database name; names without `_test` are rejected before connecting. Store actual values in an ignored local file, for example `.env.auth-test` at repository root; never print resolved secrets or commit them.

After the test DB schema has been separately reviewed/applied and these variables exported in the calling shell, run from repository root:

```powershell
docker compose --profile tools run --rm -e RUN_AUTH_MYSQL_TESTS -e AUTH_TEST_DATABASE -e AUTH_TEST_DATABASE_CONFIRM -e AUTH_TEST_MYSQL_HOST -e AUTH_TEST_MYSQL_PORT -e AUTH_TEST_MYSQL_USER -e AUTH_TEST_MYSQL_PASSWORD checks python -m pytest -q tests/test_auth_mysql_integration.py
```

The installed Compose v2.31 supports these `-e NAME` options; values are inherited from the calling process, not exposed as command arguments. An optional `.env.auth-test` file is a place to keep local values, not something Compose automatically loads for this command: export it through your environment manager first. Do not put password values directly on the command line or print them.

Preflight first checks that the six-table model decisions are reviewed before opening a connection. It then checks actual `DATABASE()`, `CURRENT_USER()`, MySQL version, charset, InnoDB engine, strict mode, foreign_key_checks/unique_checks, ERD Auth columns/PK/FK/uniques/types and the reviewed nullable/default values. The dedicated database must contain exactly the six Auth foundation tables plus alembic_version, whose only revision must be `20261102_01`. There is no auto-stamp or auto-upgrade. The initial, pre-apply inventory must instead be empty, checked separately during provisioning review. Operator preflight must additionally compare actual grants, collation and FK actions to the final approved SQL; those properties are not inferred from an applied revision number.

Tables are reflected from the existing schema, including tinhthanh; no create_all is called. Session per HTTP request uses a SAVEPOINT inside the outer fixture transaction, preventing request commits from committing fixtures. Teardown rolls back and verifies all tracked fixture IDs across the six tables no longer exist; it does not delete rows to cover up a rollback failure.

Coverage: Candidate/Admin; Company Member OWNER/RECRUITER for PENDING/APPROVED/REJECTED; DISABLED accounts; INACTIVE members; expired/wrong-signature JWT; current identity `/me`; account disabled after token issuance; sensitive data absent from identity responses. Existing unit tests separately cover the approved-company guard.

The 12 schema/transaction cases cover all five orphan FKs (MySQL 1452), the four single-column UNIQUE constraints and the member shared PK (1062), five independent AUTO_INCREMENT keys versus the non-incrementing member account key, and a multi-record savepoint failure rolling back account/profile/company/package/member inserts. IDs need not be consecutive. No new business constraint or unapproved initial state is established by the explicit synthetic fixture values.

If schema approval, tables, history or confirmed constraints are absent, the opted-in suite **fails preflight**; it does not silently create schema or report success. Without `RUN_AUTH_MYSQL_TESTS=1`, the 32 cases are skipped and must not be described as MySQL Auth/schema PASS. The existing read-only inspector is not by itself a certification that all null/default decisions were approved.

Read-only schema report from the running backend:

```powershell
docker compose exec -T backend python -m app.db.inspect_auth
```

Exit 0 means no inspected mismatch, 1 means missing/mismatched schema/version/charset, 2 means configuration/connection unavailable. This is structural inspection, not approval of defaults or complete business/security validation. The CLI never prints credentials or data rows. Review `docs/reports/auth_schema_2026-11-02.json` and the latest infrastructure report before migrations.
