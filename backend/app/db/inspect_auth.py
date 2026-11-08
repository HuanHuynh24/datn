"""Read-only MySQL/ERD reconciliation. Never creates schema or applies migrations."""

import argparse
import json
import re
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.dialects import mysql
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings
from app.db.session import build_engine


def load_contract() -> dict:
    return json.loads(
        Path(__file__).with_name("erd_auth_contract.json").read_text(encoding="utf-8")
    )


def type_matches(expected: str, actual) -> bool:
    value = (actual if isinstance(actual, str) else actual.compile(dialect=mysql.dialect())).lower()
    # Collation is reviewed separately; it does not change VARCHAR length/type.
    attributes = r'\s+(?:character\s+set|collate)\s+["`]?[a-z0-9_]+["`]?'
    value = re.sub(attributes, "", value).replace(" ", "")
    expected = re.sub(attributes, "", expected.lower()).replace(" ", "")
    if "unsigned" in value or value.startswith("enum"):
        return False
    if expected in {"boolean", "bool"}:
        return value in {"boolean", "bool", "tinyint(1)"}
    if expected == "bigint":
        return value == "bigint" or value.startswith("bigint(")
    if expected in {"int", "integer"}:
        return value in {"integer", "int"} or value.startswith(("integer(", "int("))
    return value == expected


def inspect_auth_schema(connection) -> dict:
    contract = load_contract()
    inspector = inspect(connection)
    existing = set(inspector.get_table_names())
    report = {
        "database": connection.scalar(text("SELECT DATABASE()")),
        "server_version": connection.scalar(text("SELECT VERSION()")),
        "database_charset": connection.scalar(text("SELECT @@character_set_database")),
        "source_sha256": contract["source_sha256"],
        "issues": [],
        "tables": {},
    }
    if not report["server_version"].startswith("8.4."):
        report["issues"].append("Server is not MySQL 8.4")
    if report["database_charset"] != "utf8mb4":
        report["issues"].append("Database charset is not utf8mb4")
    for name, expected in contract["tables"].items():
        if name not in existing:
            report["tables"][name] = {"exists": False}
            report["issues"].append(f"Missing table: {name}")
            continue
        columns = inspector.get_columns(name)
        actual = {column["name"]: column for column in columns}
        primary = inspector.get_pk_constraint(name).get("constrained_columns", [])
        foreign = inspector.get_foreign_keys(name)
        unique = inspector.get_unique_constraints(name)
        indexes = inspector.get_indexes(name)
        unique_columns = {tuple(item.get("column_names") or []) for item in unique} | {
            tuple(item.get("column_names") or []) for item in indexes if item.get("unique")
        }
        table_report = {
            "exists": True,
            "primary_key": primary,
            "foreign_keys": foreign,
            "unique_constraints": unique,
            "indexes": indexes,
            "columns": [],
            "engine": inspector.get_table_options(name).get("mysql_engine"),
        }
        report["tables"][name] = table_report
        if table_report["engine"] != "InnoDB":
            report["issues"].append(f"{name}: InnoDB required for rollback tests")
        if set(primary) != {c["name"] for c in expected if c["primary_key"]}:
            report["issues"].append(f"{name}: primary key mismatch")
        expected_names = {c["name"] for c in expected}
        if set(actual) - expected_names:
            report["issues"].append(f"{name}: unexpected columns require review")
        for column in expected:
            key = column["name"]
            if key not in actual:
                report["issues"].append(f"{name}.{key}: missing column")
                continue
            found = actual[key]
            table_report["columns"].append(
                {
                    "name": key,
                    "type": str(found["type"]),
                    "nullable_actual": found["nullable"],
                    "nullable_erd": column["nullable"],
                    "nullable_decision": "UNRESOLVED"
                    if column["nullable"] is None
                    else "ERD_DEFINED",
                    "default_actual": (
                        "[REDACTED_PRESENT]"
                        if key == "matkhaubam" and found.get("default") is not None
                        else found.get("default")
                    ),
                    "default_approval": "NOT_INFERRED_FROM_EXISTING_DB",
                    "autoincrement_actual": found.get("autoincrement"),
                }
            )
            if not type_matches(column["type"], found["type"]):
                report["issues"].append(f"{name}.{key}: type mismatch")
            if column["nullable"] is not None and found["nullable"] != column["nullable"]:
                report["issues"].append(f"{name}.{key}: declared ERD nullable mismatch")
            if column["unique"] and (key,) not in unique_columns and [key] != primary:
                report["issues"].append(f"{name}.{key}: unique constraint missing")
            if "references" in column:
                target, target_column = column["references"]
                if target not in existing:
                    report["issues"].append(f"{name}.{key}: referenced table missing")
                if not any(
                    fk.get("constrained_columns") == [key]
                    and fk.get("referred_table") == target
                    and fk.get("referred_columns") == [target_column]
                    for fk in foreign
                ):
                    report["issues"].append(f"{name}.{key}: foreign key mismatch")
            if column["primary_key"]:
                independent = "references" not in column
                if bool(found.get("autoincrement")) != independent:
                    report["issues"].append(f"{name}.{key}: ID generation needs review")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", help="Explicit development environment file, never printed")
    args = parser.parse_args()
    try:
        engine = build_engine(Settings(_env_file=args.env_file))
    except ValueError:
        print(json.dumps({"status": "BLOCKED", "detail": "Database configuration unavailable"}))
        raise SystemExit(2) from None
    try:
        with engine.connect() as connection:
            report = inspect_auth_schema(connection)
        print(json.dumps(report, indent=2, default=str))
        raise SystemExit(1 if report["issues"] else 0)
    except SQLAlchemyError:
        print(json.dumps({"status": "BLOCKED", "detail": "Database inspection unavailable"}))
        raise SystemExit(2) from None
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
