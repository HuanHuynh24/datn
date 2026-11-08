"""Migration scope and deterministic review rendering, with no database access."""

import argparse
import json
from pathlib import Path

from sqlalchemy.dialects import mysql
from sqlalchemy.schema import AddConstraint

from app.models import Base
from app.models.base import unresolved_decisions

AUTH_FOUNDATION_TABLES = (
    "taikhoan",
    "goidoanhnghiep",
    "tinhthanh",
    "doanhnghiep",
    "hosoungvien",
    "thanhviendoanhnghiep",
)


def foundation_tables():
    return [table for table in Base.metadata.sorted_tables if table.name in AUTH_FOUNDATION_TABLES]


def review_report():
    all_tables = list(Base.metadata.sorted_tables)
    auth_pending = unresolved_decisions(foundation_tables())
    return {
        "status": "AUTH_SCHEMA_CONFIRMED_NOT_APPLIED"
        if not any(auth_pending.values())
        else "BLOCKED_UNRESOLVED_SCHEMA",
        "source_sha256": Base.metadata.info["erd_source_sha256"],
        "table_count": len(all_tables),
        "column_count": sum(len(table.c) for table in all_tables),
        "foreign_key_count": sum(len(table.foreign_keys) for table in all_tables),
        "all_pending": unresolved_decisions(all_tables),
        "auth_creation_order": [table.name for table in foundation_tables()],
        "auth_pending": auth_pending,
        "tables": {
            table.name: {
                "columns": [
                    {
                        "name": c.name,
                        "type": str(c.type.compile(dialect=mysql.dialect())),
                        "primary_key": c.primary_key,
                        "unique": bool(c.unique),
                        "nullable": c.nullable,
                        "nullable_review": c.info["nullable_review"],
                        "default_review": c.info["default_review"],
                        "server_default": str(c.server_default.arg)
                        if c.server_default is not None
                        else None,
                        "decision_id": c.info.get("decision_id"),
                        "collation": getattr(c.type, "collation", None),
                        "autoincrement": c.autoincrement,
                    }
                    for c in table.c
                ],
                "foreign_keys": sorted(
                    [
                        {
                            "column": fk.parent.name,
                            "target": fk.target_fullname,
                            "name": fk.constraint.name,
                            "ondelete": fk.ondelete,
                            "onupdate": fk.onupdate,
                        }
                        for fk in table.foreign_keys
                    ],
                    key=lambda fk: fk["column"],
                ),
                "constraints": sorted(
                    [
                        {
                            "kind": type(constraint).__name__,
                            "name": constraint.name,
                            "columns": list(constraint.columns.keys()),
                        }
                        for constraint in table.constraints
                    ],
                    key=lambda constraint: (constraint["kind"], str(constraint["name"])),
                ),
                "options": dict(table.dialect_kwargs),
            }
            for table in all_tables
        },
    }


def render_sql_review() -> str:
    lines = [
        "-- REVIEW ONLY: NOT EXECUTABLE. No schema or database operation was performed.",
        "-- Unresolved placeholders must never be replaced without explicit decisions.",
        "-- Complete 16-table design; the first revision selects the Auth foundation subset.",
    ]
    dialect = mysql.dialect()
    for table in Base.metadata.sorted_tables:
        lines += [
            "",
            f"-- {'AUTH FOUNDATION' if table.name in AUTH_FOUNDATION_TABLES else 'LATER MODULE'}",
            f"CREATE TABLE `{table.name}` (",
        ]
        entries = []
        for c in table.c:
            data_type = str(c.type.compile(dialect=dialect))
            null = (
                "<NULLABILITY_UNRESOLVED>"
                if c.nullable is None
                else "NULL"
                if c.nullable
                else "NOT NULL"
            )
            auto = " AUTO_INCREMENT" if c.primary_key and c.autoincrement is True else ""
            default = (
                " <DEFAULT_DECISION_UNRESOLVED>"
                if c.info["default_review"] == "UNSPECIFIED"
                else f" DEFAULT {c.server_default.arg}"
                if c.server_default is not None
                else ""
            )
            entries.append(f"  `{c.name}` {data_type} {null}{auto}{default}")
        for constraint in sorted(table.constraints, key=lambda c: (type(c).__name__, str(c.name))):
            # ADD CONSTRAINT rendering preserves MySQL names, PK/FK/unique columns.
            # No SQL execution: these are review strings only.
            sql = str(AddConstraint(constraint, isolate_from_table=False).compile(dialect=dialect))
            prefix = f"ALTER TABLE {table.name} ADD "
            entries.append("  " + (sql[len(prefix) :] if sql.startswith(prefix) else sql))
        collate = table.dialect_kwargs.get("mysql_collate")
        options = ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        if collate:
            options += f" COLLATE {collate}"
        lines += [",\n".join(entries), options + ";"]
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json-output", type=Path)
    parser.add_argument("--sql-review-output", type=Path)
    args = parser.parse_args()
    report = review_report()
    if args.json_output:
        args.json_output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if args.sql_review_output:
        args.sql_review_output.write_text(render_sql_review(), encoding="utf-8")
    print(
        json.dumps(
            {
                "tables": report["table_count"],
                "columns": report["column_count"],
                "foreign_keys": report["foreign_key_count"],
                "auth_nullable_blockers": len(report["auth_pending"]["nullable"]),
                "auth_default_blockers": len(report["auth_pending"]["defaults"]),
                "status": report["status"],
            }
        )
    )


if __name__ == "__main__":
    main()
