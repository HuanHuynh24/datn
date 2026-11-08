"""Approved E6 five-table extension; Auth remains unchanged."""

import json
import re
from pathlib import Path

import sqlalchemy as sa
from alembic.operations.ops import CreateTableOp

from alembic import op
from app.db.jobs_migration_permissions import require_e6_scope
from app.models.base import require_reviewed_schema

revision = "20261103_02"
down_revision = "20261102_01"
branch_labels = depends_on = None
_snapshot = sa.MetaData(
    naming_convention={"pk": "pk_%(table_name)s", "uq": "uq_%(table_name)s_%(column_0_name)s"}
)
for name, pk in [
    ("taikhoan", "idtaikhoan"),
    ("doanhnghiep", "iddoanhnghiep"),
    ("thanhviendoanhnghiep", "idtaikhoan"),
    ("tinhthanh", "idtinhthanh"),
]:
    sa.Table(name, _snapshot, sa.Column(pk, sa.BigInteger(), primary_key=True))
_spec = json.loads(Path(__file__).with_name("e6_jobs_snapshot.json").read_text())
_names = {t["name"] for t in _spec}
for spec in _spec:
    columns = []
    for col in spec["columns"]:
        match = re.fullmatch(r"([A-Z]+)(?:\(([^)]+)\))?", col["type"])
        types = {
            "BIGINT": sa.BigInteger,
            "INTEGER": sa.Integer,
            "BOOL": sa.Boolean,
            "BOOLEAN": sa.Boolean,
            "VARCHAR": sa.String,
            "TEXT": sa.Text,
            "DATE": sa.Date,
            "DATETIME": sa.DateTime,
            "DECIMAL": sa.DECIMAL,
            "JSON": sa.JSON,
        }
        args = [int(v.strip()) for v in match[2].split(",")] if match[2] else []
        foreign = [
            sa.ForeignKey(
                f["target"], name=f["name"], ondelete=f["ondelete"], onupdate=f["onupdate"]
            )
            for f in col["foreign_keys"]
        ]
        columns.append(
            sa.Column(
                col["name"],
                types[match[1]](*args),
                *foreign,
                nullable=col["nullable"],
                primary_key=col["primary_key"],
                unique=col["unique"],
                autoincrement=col["autoincrement"],
                info=col["info"],
            )
        )
    sa.Table(
        spec["name"],
        _snapshot,
        *columns,
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )


def review_tables():
    return [t for t in _snapshot.sorted_tables if t.name in _names]


def upgrade():
    require_reviewed_schema(review_tables())
    if not op.get_context().as_sql:
        require_e6_scope()
    for table in review_tables():
        op.invoke(CreateTableOp.from_table(table))


def downgrade():
    raise RuntimeError("No automatic DROP; preserve existing data and review recovery")
