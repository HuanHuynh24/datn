import json
from pathlib import Path
from unittest.mock import Mock

import pytest
from mysql_target import auth_test_settings
from sqlalchemy import BigInteger, Boolean, String
from sqlalchemy.dialects.mysql import ENUM, TINYINT

from app.db.inspect_auth import inspect_auth_schema, load_contract, type_matches


def target_values():
    return dict(
        AUTH_TEST_DATABASE="recruitment_auth_test",
        AUTH_TEST_DATABASE_CONFIRM="recruitment_auth_test",
        AUTH_TEST_MYSQL_HOST="mysql",
        AUTH_TEST_MYSQL_PORT="3306",
        AUTH_TEST_MYSQL_USER="auth_test_user",
        AUTH_TEST_MYSQL_PASSWORD="test-only-password-long",
    )


def test_explicit_test_target_and_no_fallback():
    assert auth_test_settings(target_values()).mysql_database == "recruitment_auth_test"
    with pytest.raises(ValueError):
        auth_test_settings({"MYSQL_DATABASE": "production"})


@pytest.mark.parametrize(
    "change",
    [
        {"AUTH_TEST_DATABASE": "recruitment_db"},
        {"AUTH_TEST_DATABASE_CONFIRM": "other_test"},
        {"AUTH_TEST_MYSQL_USER": "root"},
        {"AUTH_TEST_DATABASE": "bad;name_test", "AUTH_TEST_DATABASE_CONFIRM": "bad;name_test"},
    ],
)
def test_unsafe_test_target_rejected(change):
    with pytest.raises(ValueError):
        auth_test_settings(target_values() | change)


def test_type_comparison_accepts_mysql_boolean_but_rejects_enum_unsigned_or_length_changes():
    assert type_matches("boolean", TINYINT(display_width=1))
    assert type_matches("boolean", Boolean())
    assert type_matches("bigint", BigInteger())
    assert type_matches("varchar(30)", String(30))
    assert type_matches("varchar(255)", String(255, collation="utf8mb4_0900_as_ci"))
    assert type_matches('VARCHAR(255) COLLATE "utf8mb4_0900_as_ci"', "varchar(255)")
    assert type_matches("INTEGER", "int")
    assert type_matches("BOOL", TINYINT(display_width=1))
    assert type_matches(
        "varchar(255)",
        "VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci",
    )
    assert not type_matches("varchar(30)", ENUM("ACTIVE", "DISABLED"))
    assert not type_matches("varchar(30)", String(40))
    assert not type_matches("bigint", "BIGINT UNSIGNED")


def test_missing_tables_reported_without_schema_creation(monkeypatch):
    connection, inspector = Mock(), Mock()
    connection.scalar.side_effect = ["recruitment_auth_test", "8.4.8", "utf8mb4"]
    inspector.get_table_names.return_value = []
    monkeypatch.setattr("app.db.inspect_auth.inspect", lambda connection: inspector)
    report = inspect_auth_schema(connection)
    assert len(report["issues"]) == 5
    assert all(not item["exists"] for item in report["tables"].values())
    assert all(str(call.args[0]).startswith("SELECT") for call in connection.scalar.call_args_list)


def test_schema_differences_and_unknown_nullable_are_not_approved(monkeypatch):
    contract = {
        "source_sha256": "test-contract",
        "tables": {
            "taikhoan": [
                dict(
                    name="idtaikhoan", type="bigint", nullable=False, primary_key=True, unique=False
                ),
                dict(
                    name="email",
                    type="varchar(255)",
                    nullable=False,
                    primary_key=False,
                    unique=True,
                ),
                dict(
                    name="nhanemail", type="boolean", nullable=None, primary_key=False, unique=False
                ),
                dict(
                    name="matkhaubam",
                    type="varchar(255)",
                    nullable=False,
                    primary_key=False,
                    unique=False,
                ),
            ]
        },
    }
    columns = [
        dict(
            name="idtaikhoan", type=BigInteger(), nullable=False, autoincrement=True, default=None
        ),
        dict(name="email", type=String(255), nullable=False, default=None),
        dict(name="nhanemail", type=TINYINT(display_width=1), nullable=False, default="0"),
        dict(name="matkhaubam", type=String(255), nullable=False, default="private-default"),
    ]
    connection, inspector = Mock(), Mock()
    connection.scalar.side_effect = lambda statement: {
        "SELECT DATABASE()": "auth_test",
        "SELECT VERSION()": "8.4.8",
        "SELECT @@character_set_database": "utf8mb4",
    }[str(statement)]
    inspector.get_table_names.return_value = ["taikhoan"]
    inspector.get_columns.return_value = columns
    inspector.get_pk_constraint.return_value = {"constrained_columns": ["idtaikhoan"]}
    inspector.get_foreign_keys.return_value = []
    inspector.get_unique_constraints.return_value = [{"column_names": ["email"]}]
    inspector.get_indexes.return_value = []
    inspector.get_table_options.return_value = {"mysql_engine": "InnoDB"}
    monkeypatch.setattr("app.db.inspect_auth.load_contract", lambda: contract)
    monkeypatch.setattr("app.db.inspect_auth.inspect", lambda connection: inspector)
    report = inspect_auth_schema(connection)
    assert not report["issues"]
    actual_columns = report["tables"]["taikhoan"]["columns"]
    assert actual_columns[2]["nullable_decision"] == "UNRESOLVED"
    assert actual_columns[2]["default_approval"] == "NOT_INFERRED_FROM_EXISTING_DB"
    assert "private-default" not in json.dumps(report)
    columns[1]["nullable"] = True
    inspector.get_pk_constraint.return_value = {"constrained_columns": ["nhanemail"]}
    inspector.get_unique_constraints.return_value = []
    report = inspect_auth_schema(connection)
    assert any("primary key mismatch" in issue for issue in report["issues"])
    assert any("nullable mismatch" in issue for issue in report["issues"])
    assert any("unique constraint missing" in issue for issue in report["issues"])


def test_derived_contract_matches_original_when_source_available():
    root = Path(__file__).resolve().parents[2]
    sources = list((root / "docs/erd").glob("*.mdj"))
    if not sources:
        pytest.skip("Original ERD is outside the backend Docker build context")
    import hashlib

    source = sources[0]
    contract = load_contract()
    assert hashlib.sha256(source.read_bytes()).hexdigest() == contract["source_sha256"]
    design = json.loads(source.read_text(encoding="utf-8"))
    entities = {
        e["name"]: e
        for e in design["ownedElements"][0]["ownedElements"]
        if e.get("_type") == "ERDEntity"
    }
    assert sum(len(cols) for cols in contract["tables"].values()) == 52
    assert sum(c["nullable"] is None for cols in contract["tables"].values() for c in cols) == 27
    for name, columns in contract["tables"].items():
        assert [c["name"] for c in columns] == [c["name"] for c in entities[name]["columns"]]
        assert all(
            c["nullable"] == raw.get("nullable")
            for c, raw in zip(columns, entities[name]["columns"], strict=True)
        )
