"""Opt-in real MySQL tests against existing reviewed schema; DML rolls back, no DDL."""

import os
import secrets
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal

import jwt
import pytest
from fastapi.testclient import TestClient
from mysql_target import auth_test_settings
from sqlalchemy import MetaData, Table, func, inspect, select, text, update
from sqlalchemy.dialects import mysql
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.passwords import hash_password
from app.db.inspect_auth import inspect_auth_schema, type_matches
from app.db.migration_permissions import require_auth_fixture_dml_approval
from app.db.migration_review import AUTH_FOUNDATION_TABLES, foundation_tables
from app.db.session import build_engine, get_db
from app.main import create_app
from app.models.base import require_reviewed_schema

pytestmark = [
    pytest.mark.mysql,
    pytest.mark.skipif(
        os.getenv("RUN_AUTH_MYSQL_TESTS") != "1", reason="Explicit Auth MySQL target required"
    ),
]


@dataclass
class IdentityFixture:
    account_id: int
    email: str
    password: str = field(repr=False)


@dataclass
class AuthDatabaseFixture:
    connection: object = field(repr=False)
    tables: dict = field(repr=False)
    client: TestClient = field(repr=False)
    settings: object = field(repr=False)
    created_ids: list[int] = field(default_factory=list, repr=False)
    created_rows: dict[str, list[int]] = field(default_factory=dict, repr=False)

    def track(self, table_name, primary_key):
        self.created_rows.setdefault(table_name, []).append(primary_key)
        return primary_key

    def row_for(self, table_name, identity):
        account = self.tables["taikhoan"]
        if table_name == "taikhoan":
            return (
                self.connection.execute(
                    select(account).where(account.c.idtaikhoan == identity.account_id)
                )
                .mappings()
                .one()
            )
        table = self.tables[table_name]
        if table_name in {"hosoungvien", "thanhviendoanhnghiep"}:
            condition = table.c.idtaikhoan == identity.account_id
        else:
            member = self.row_for("thanhviendoanhnghiep", identity)
            if table_name == "doanhnghiep":
                condition = table.c.iddoanhnghiep == member["iddoanhnghiep"]
            else:
                company = self.row_for("doanhnghiep", identity)
                condition = table.c.idgoi == company["idgoi"]
        return self.connection.execute(select(table).where(condition)).mappings().one()

    def create_identity(
        self,
        role,
        status="ACTIVE",
        member_status="ACTIVE",
        approval="APPROVED",
        internal_role="RECRUITER",
    ):
        # Explicit test values are not database defaults or registration policy.
        token = secrets.token_hex(8)
        now = datetime.now(UTC).replace(tzinfo=None)
        password = secrets.token_urlsafe(24)
        email = f"auth-{token}@example.com"
        result = self.connection.execute(
            self.tables["taikhoan"]
            .insert()
            .values(
                vaitro=role,
                email=email,
                matkhaubam=hash_password(password),
                hovaten="Auth integration",
                trangthai=status,
                daxacthucemail=False,
                solandangsai=0,
                khoaden=None,
                nhanemail=False,
                thoigiantao=now,
            )
        )
        account_id = result.inserted_primary_key[0]
        self.created_ids.append(account_id)
        self.track("taikhoan", account_id)
        if role == "CANDIDATE":
            candidate_id = self.connection.execute(
                self.tables["hosoungvien"]
                .insert()
                .values(
                    idtaikhoan=account_id,
                    sodienthoai="0900000000",
                    diachi="Test address",
                    gioithieu="Integration fixture",
                    anhdaidien="/test/avatar.png",
                    congkhaihoso=False,
                    thoigiancapnhat=now,
                    hocvan=[],
                    kinhnghiem=[],
                    vitrimongmuon="Test position",
                    idtinhthanh=None,
                    luongmongmuontoithieu=Decimal("1.00"),
                    luongmongmuontoida=Decimal("2.00"),
                    hinhthuclamviecmongmuon="Test fixture",
                )
            ).inserted_primary_key[0]
            self.track("hosoungvien", candidate_id)
        elif role == "COMPANY_MEMBER":
            package = self.connection.execute(
                self.tables["goidoanhnghiep"]
                .insert()
                .values(
                    magoi="TEST_" + token,
                    tengoi="Integration test",
                    sotaikhoantoida=2,
                    giathang=Decimal("1.00"),
                    mota="Explicit rollback-only test fixture",
                )
            ).inserted_primary_key[0]
            self.track("goidoanhnghiep", package)
            company = self.connection.execute(
                self.tables["doanhnghiep"]
                .insert()
                .values(
                    idgoi=package,
                    tencongty="Auth integration " + token,
                    masothue=str(int(token, 16))[-10:],
                    linhvuc="Test",
                    quymo="Test",
                    diachi="Test address",
                    website="https://example.com",
                    logo="/test/logo.png",
                    gioithieu="Integration fixture",
                    trangthaiduyet=approval,
                    thoigiantao=now,
                    duongdanprofile="/test/profile",
                    ngaybatdaugoi=now.date(),
                    ngayhethan=now.date(),
                )
            ).inserted_primary_key[0]
            self.track("doanhnghiep", company)
            self.connection.execute(
                self.tables["thanhviendoanhnghiep"]
                .insert()
                .values(
                    idtaikhoan=account_id,
                    iddoanhnghiep=company,
                    chucvunoibo=internal_role,
                    trangthai=member_status,
                    thoigianthem=now,
                )
            )
            self.track("thanhviendoanhnghiep", account_id)
        return IdentityFixture(account_id, email, password)

    def login(self, identity):
        return self.client.post(
            "/api/v1/auth/login",
            json={
                "email": identity.email,
                "password": identity.password,
            },
        )


@pytest.fixture
def mysql_auth():
    settings = auth_test_settings()
    # Schema approval and opt-in flags do not authorize database application or
    # fixture DML. Schema and the independent fixture approval gate must pass.
    require_reviewed_schema(foundation_tables())
    require_auth_fixture_dml_approval(settings)
    engine = build_engine(settings)
    try:
        with engine.connect() as connection:
            require_auth_fixture_dml_approval(settings, connection)
            assert connection.scalar(text("SELECT DATABASE()")) == settings.mysql_database
            assert (
                connection.scalar(text("SELECT SUBSTRING_INDEX(CURRENT_USER(), '@', 1)")) != "root"
            )
            report = inspect_auth_schema(connection)
            assert not report["issues"], report["issues"]
            existing = set(inspect(connection).get_table_names())
            assert existing == set(AUTH_FOUNDATION_TABLES) | {"alembic_version"}, (
                "Dedicated test schema must contain only the six reviewed Auth tables and history"
            )
            revisions = set(
                connection.execute(text("SELECT version_num FROM alembic_version")).scalars()
            )
            assert revisions == {"20261102_01"}, (
                "Unexpected or unapplied Auth test migration history"
            )
            metadata = MetaData()
            tables = {
                name: Table(name, metadata, autoload_with=connection)
                for name in AUTH_FOUNDATION_TABLES
            }
            for model in foundation_tables():
                actual = tables[model.name]
                assert list(actual.c.keys()) == list(model.c.keys())
                assert (
                    inspect(connection).get_table_options(model.name).get("mysql_engine")
                    == "InnoDB"
                )
                assert (
                    inspect(connection).get_table_options(model.name).get("mysql_collate")
                    == "utf8mb4_unicode_ci"
                )
                expected_fks = {
                    (fk.parent.name, fk.target_fullname, fk.ondelete, fk.onupdate)
                    for fk in model.foreign_keys
                }
                actual_fks = {
                    (
                        fk.parent.name,
                        fk.target_fullname,
                        "RESTRICT" if fk.ondelete in {None, "NO ACTION"} else fk.ondelete,
                        "RESTRICT" if fk.onupdate in {None, "NO ACTION"} else fk.onupdate,
                    )
                    for fk in actual.foreign_keys
                }
                assert actual_fks == expected_fks
                for col in model.c:
                    assert actual.c[col.name].nullable == col.nullable
                    assert type_matches(
                        str(col.type.compile(dialect=mysql.dialect())), actual.c[col.name].type
                    )
                    expected_default = (
                        str(col.server_default.arg).strip("()'\" ")
                        if col.server_default is not None
                        else None
                    )
                    actual_default = (
                        str(actual.c[col.name].server_default.arg).strip("()'\" ")
                        if actual.c[col.name].server_default is not None
                        else None
                    )
                    assert actual_default == expected_default
                    if model.name == "taikhoan" and col.name == "email":
                        assert actual.c.email.type.collation == "utf8mb4_0900_as_ci"
            assert connection.scalar(text("SELECT @@foreign_key_checks")) == 1
            assert connection.scalar(text("SELECT @@unique_checks")) == 1
            assert "STRICT_TRANS_TABLES" in connection.scalar(text("SELECT @@session.sql_mode"))
            # Finish reflection's read-only autobegin before fixture transaction.
            connection.rollback()
            transaction = connection.begin()
            app = create_app(settings)

            def scoped_session():
                # Requests cannot commit the outer fixture transaction.
                with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
                    yield session

            app.dependency_overrides[get_db] = scoped_session
            state = None
            try:
                with TestClient(app) as client:
                    state = AuthDatabaseFixture(connection, tables, client, settings)
                    yield state
            finally:
                # No DROP/DELETE/TRUNCATE. All fixture rows disappear with rollback.
                transaction.rollback()
                if state is not None:
                    for name, keys in state.created_rows.items():
                        table = tables[name]
                        pk = next(iter(table.primary_key.columns))
                        remaining = connection.scalar(
                            select(func.count()).select_from(table).where(pk.in_(keys))
                        )
                        assert remaining == 0, f"Fixture rollback did not remove {name} rows"
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    "role,approval,internal",
    [
        ("ADMIN", None, None),
        ("CANDIDATE", None, None),
        *[
            ("COMPANY_MEMBER", approval, internal)
            for approval in ["PENDING", "APPROVED", "REJECTED"]
            for internal in ["OWNER", "RECRUITER"]
        ],
    ],
)
def test_mysql_login_and_me(mysql_auth, role, approval, internal):
    identity = mysql_auth.create_identity(role, approval=approval, internal_role=internal)
    response = mysql_auth.login(identity)
    assert response.status_code == 200
    assert response.json()["expires_in"] == 1800
    assert response.headers["cache-control"] == "no-store"
    token = response.json()["access_token"]
    me = mysql_auth.client.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + token})
    assert me.status_code == 200
    assert me.json()["account_id"] == str(identity.account_id)
    assert me.json()["role"] == role
    assert me.json()["company_approval_status"] == approval
    assert me.json()["internal_role"] == internal
    assert "password" not in me.text and "hash" not in me.text
    assert identity.password not in me.text


@pytest.mark.parametrize("role", ["CANDIDATE", "COMPANY_MEMBER", "ADMIN"])
def test_mysql_disabled_account(mysql_auth, role):
    identity = mysql_auth.create_identity(role, status="DISABLED")
    response = mysql_auth.login(identity)
    assert response.status_code == 401 and "access_token" not in response.text


@pytest.mark.parametrize("internal", ["OWNER", "RECRUITER"])
def test_mysql_inactive_member(mysql_auth, internal):
    identity = mysql_auth.create_identity(
        "COMPANY_MEMBER", member_status="INACTIVE", internal_role=internal
    )
    assert mysql_auth.login(identity).status_code == 401


@pytest.mark.parametrize("role", ["CANDIDATE", "COMPANY_MEMBER", "ADMIN"])
def test_mysql_token_rejection(mysql_auth, role):
    identity = mysql_auth.create_identity(role)
    token = mysql_auth.login(identity).json()["access_token"]
    claims = jwt.decode(token, options={"verify_signature": False})
    wrong_key = jwt.encode(claims, secrets.token_urlsafe(48), algorithm="HS256")
    claims["iat"] -= 3600
    claims["nbf"] -= 3600
    claims["exp"] -= 3600
    expired = jwt.encode(
        claims, mysql_auth.settings.jwt_secret.get_secret_value(), algorithm="HS256"
    )
    for invalid in [wrong_key, expired]:
        response = mysql_auth.client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer " + invalid}
        )
        assert response.status_code == 401
        assert response.headers["www-authenticate"] == "Bearer"
        assert invalid not in response.text


@pytest.mark.parametrize("role", ["CANDIDATE", "COMPANY_MEMBER", "ADMIN"])
def test_mysql_current_status_reread(mysql_auth, role):
    identity = mysql_auth.create_identity(role)
    token = mysql_auth.login(identity).json()["access_token"]
    table = mysql_auth.tables["taikhoan"]
    mysql_auth.connection.execute(
        update(table).where(table.c.idtaikhoan == identity.account_id).values(trangthai="DISABLED")
    )
    response = mysql_auth.client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer " + token}
    )
    assert response.status_code == 401


@pytest.mark.parametrize(
    "table_name,column_name,role",
    [
        ("hosoungvien", "idtaikhoan", "CANDIDATE"),
        ("hosoungvien", "idtinhthanh", "CANDIDATE"),
        ("doanhnghiep", "idgoi", "COMPANY_MEMBER"),
        ("thanhviendoanhnghiep", "idtaikhoan", "COMPANY_MEMBER"),
        ("thanhviendoanhnghiep", "iddoanhnghiep", "COMPANY_MEMBER"),
    ],
)
def test_mysql_rejects_orphan_foreign_keys(mysql_auth, table_name, column_name, role):
    identity = mysql_auth.create_identity(role)
    table = mysql_auth.tables[table_name]
    row = mysql_auth.row_for(table_name, identity)
    pk = next(iter(table.primary_key.columns))
    fk = next(iter(table.c[column_name].foreign_keys))
    missing_id = (1 << 62) + secrets.randbits(60)
    assert (
        mysql_auth.connection.scalar(
            select(func.count()).select_from(fk.column.table).where(fk.column == missing_id)
        )
        == 0
    )
    with pytest.raises(IntegrityError) as failure, mysql_auth.connection.begin_nested():
        mysql_auth.connection.execute(
            update(table).where(pk == row[pk.name]).values({column_name: missing_id})
        )
    assert failure.value.orig.args[0] == 1452


@pytest.mark.parametrize(
    "table_name,column_name,role",
    [
        ("taikhoan", "email", "CANDIDATE"),
        ("hosoungvien", "idtaikhoan", "CANDIDATE"),
        ("doanhnghiep", "masothue", "COMPANY_MEMBER"),
        ("goidoanhnghiep", "magoi", "COMPANY_MEMBER"),
        ("thanhviendoanhnghiep", "idtaikhoan", "COMPANY_MEMBER"),
    ],
)
def test_mysql_rejects_duplicate_unique_and_member_pk(mysql_auth, table_name, column_name, role):
    first = mysql_auth.create_identity(role)
    second = mysql_auth.create_identity(role)
    first_row = mysql_auth.row_for(table_name, first)
    second_row = mysql_auth.row_for(table_name, second)
    table = mysql_auth.tables[table_name]
    pk = next(iter(table.primary_key.columns))
    with pytest.raises(IntegrityError) as failure, mysql_auth.connection.begin_nested():
        mysql_auth.connection.execute(
            update(table)
            .where(pk == second_row[pk.name])
            .values({column_name: first_row[column_name]})
        )
    assert failure.value.orig.args[0] == 1062


def test_mysql_auto_increment_and_member_shared_id(mysql_auth):
    candidate = mysql_auth.create_identity("CANDIDATE")
    member = mysql_auth.create_identity("COMPANY_MEMBER")
    province = mysql_auth.tables["tinhthanh"]
    province_id = mysql_auth.connection.execute(
        province.insert().values(tentinhthanh="Test province " + secrets.token_hex(4))
    ).inserted_primary_key[0]
    mysql_auth.track("tinhthanh", province_id)
    for name in AUTH_FOUNDATION_TABLES:
        table = mysql_auth.tables[name]
        pk = next(iter(table.primary_key.columns))
        assert bool(pk.autoincrement) == (name != "thanhviendoanhnghiep")
        if name == "tinhthanh":
            key = province_id
        else:
            identity = candidate if name == "hosoungvien" else member
            key = mysql_auth.row_for(name, identity)[pk.name]
        assert isinstance(key, int) and key > 0
    assert mysql_auth.row_for("thanhviendoanhnghiep", member)["idtaikhoan"] == member.account_id
    assert candidate.account_id != member.account_id
    # Gaps after rollback/concurrent inserts are valid; never assert sequential IDs.


def test_mysql_multirecord_transaction_rolls_back_on_failure(mysql_auth):
    before = {
        name: mysql_auth.connection.scalar(select(func.count()).select_from(table))
        for name, table in mysql_auth.tables.items()
    }
    with pytest.raises(RuntimeError, match="simulated last step failure"):
        with mysql_auth.connection.begin_nested():
            mysql_auth.create_identity("CANDIDATE")
            mysql_auth.create_identity("COMPANY_MEMBER")
            raise RuntimeError("simulated last step failure")
    for name, table in mysql_auth.tables.items():
        assert mysql_auth.connection.scalar(select(func.count()).select_from(table)) == before[name]


def test_mysql_runtime_defaults_and_optional_nulls(mysql_auth):
    # Deliberately omit all four defaulted fields; do not set fixture defaults.
    now = datetime.now(UTC).replace(tzinfo=None)
    account = mysql_auth.tables["taikhoan"]
    account_id = mysql_auth.connection.execute(
        account.insert().values(
            vaitro="CANDIDATE",
            email=f"defaults-{secrets.token_hex(8)}@example.com",
            matkhaubam=hash_password(secrets.token_urlsafe(24)),
            hovaten="Runtime defaults test",
            trangthai="ACTIVE",
            thoigiantao=now,
        )
    ).inserted_primary_key[0]
    mysql_auth.track("taikhoan", account_id)
    profile = mysql_auth.tables["hosoungvien"]
    profile_id = mysql_auth.connection.execute(
        profile.insert().values(idtaikhoan=account_id, thoigiancapnhat=now)
    ).inserted_primary_key[0]
    mysql_auth.track("hosoungvien", profile_id)
    row = (
        mysql_auth.connection.execute(select(account).where(account.c.idtaikhoan == account_id))
        .mappings()
        .one()
    )
    assert row["daxacthucemail"] == row["solandangsai"] == row["nhanemail"] == 0
    assert row["khoaden"] is None
    details = (
        mysql_auth.connection.execute(select(profile).where(profile.c.idungvien == profile_id))
        .mappings()
        .one()
    )
    assert details["congkhaihoso"] == 0
    for field_name in ("sodienthoai", "hocvan", "kinhnghiem", "hinhthuclamviecmongmuon"):
        assert details[field_name] is None
