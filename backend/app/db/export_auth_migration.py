"""Render the approved frozen revision to SQL offline; never connect to a database."""

import argparse
import io
import re
from pathlib import Path

from alembic.command import upgrade
from alembic.config import Config

from app.db.migration_review import AUTH_FOUNDATION_TABLES

REVISION = "20261102_01"


def render_auth_migration_sql(config_path: Path | None = None) -> str:
    path = config_path or Path(__file__).resolve().parents[2] / "alembic.ini"
    buffer = io.StringIO()
    config = Config(str(path), output_buffer=buffer)
    # sql=True runs Alembic's offline renderer, not an online upgrade. env.py
    # supplies only the MySQL dialect; no Settings, Engine or connection is used.
    upgrade(config, REVISION, sql=True)
    sql = buffer.getvalue()
    created = re.findall(r"CREATE TABLE\s+`?(\w+)`?", sql, flags=re.I)
    if len(created) != 7 or set(created) != set(AUTH_FOUNDATION_TABLES) | {"alembic_version"}:
        raise RuntimeError("Offline migration SQL escaped the six-table Auth scope")
    if "UNRESOLVED" in sql or re.search(
        r"\b(DROP|ALTER|TRUNCATE|GRANT|CREATE DATABASE)\b", sql, re.I
    ):
        raise RuntimeError("Offline SQL contains unresolved or out-of-scope operations")
    return (
        "-- Approved Auth E3b schema. SQL REVIEW ONLY: NOT APPLIED.\n"
        "-- Online application, test provisioning and fixture DML need separate E3c approval.\n"
        + sql
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    sql = render_auth_migration_sql()
    args.output.write_text(sql, encoding="utf-8", newline="\n")
    print(f"Offline SQL rendered for {REVISION}; 6 business tables + history; no database access.")


if __name__ == "__main__":
    main()
