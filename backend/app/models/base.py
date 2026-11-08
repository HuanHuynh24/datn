"""ERD metadata with explicit unresolved decisions; no implicit migration defaults."""

from sqlalchemy import Column, MetaData, event
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.schema import CreateTable


class Base(DeclarativeBase):
    metadata = MetaData(
        info={
            "erd_source_sha256": "f007c0c680fef98a7933a2001bd9963c8ba783a1d0b4c79123f02dbc20d2e8d2"
        },
        naming_convention={
            "pk": "pk_%(table_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
        },
    )


class UnresolvedSchemaError(RuntimeError):
    pass


def erd_column(
    name,
    data_type,
    *constraints,
    nullable,
    primary_key=False,
    unique=False,
    decision_id=None,
    server_default=None,
):
    info = {
        "erd_r2": True,
        "nullable_review": "ERD_DEFINED" if nullable is not None else "UNRESOLVED",
        "default_review": "UNSPECIFIED",
    }
    if decision_id is not None:
        info.update(
            nullable_review="CONFIRMED",
            default_review="CONFIRMED_ZERO"
            if server_default is not None
            else "CONFIRMED_NO_DEFAULT",
            approval_reference=(
                "CV_APPLICATION_E7_2026-11-05"
                if decision_id.startswith("E7_")
                else "JOBS_E6_2026-11-03"
                if decision_id.startswith("E6_")
                else "AUTH_E3B_G1_G8_2026-11-02"
            ),
            decision_id=decision_id,
        )
    return Column(
        name,
        data_type,
        *constraints,
        nullable=nullable,
        primary_key=primary_key,
        unique=unique,
        autoincrement=primary_key and not constraints,
        server_default=server_default,
        info=info,
    )


def unresolved_decisions(tables):
    return {
        "nullable": [
            f"{t.name}.{c.name}"
            for t in tables
            for c in t.c
            if c.info.get("erd_r2")
            and (c.nullable is None or c.info.get("nullable_review") == "UNRESOLVED")
        ],
        "defaults": [
            f"{t.name}.{c.name}"
            for t in tables
            for c in t.c
            if c.info.get("erd_r2") and c.info.get("default_review") == "UNSPECIFIED"
        ],
    }


def require_reviewed_schema(tables):
    pending = unresolved_decisions(list(tables))
    if pending["nullable"] or pending["defaults"]:
        raise UnresolvedSchemaError(
            f"Migration blocked: {len(pending['nullable'])} nullable and "
            f"{len(pending['defaults'])} default decisions unresolved. "
            "Review the per-column report; no NULL/default was chosen automatically."
        )


@compiles(CreateTable, "mysql")
def compile_reviewed_mysql_table(element, compiler, **kwargs):
    require_reviewed_schema([element.element])
    return compiler.visit_create_table(element, **kwargs)


@event.listens_for(Base.metadata, "before_create")
def block_unreviewed_metadata(target, connection, **kwargs):
    require_reviewed_schema(kwargs.get("tables") or list(target.tables.values()))
