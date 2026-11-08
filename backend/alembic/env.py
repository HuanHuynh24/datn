"""Read current revision safely; guard all schema-changing paths before any DDL."""

from contextlib import nullcontext

from alembic.script import ScriptDirectory

from alembic import context
from app.core.config import Settings
from app.db.cv_migration_permissions import CV_TABLES, e7_migration, require_e7_settings
from app.db.jobs_migration_permissions import JOBS_TABLES, e6_migration, require_e6_settings
from app.db.migration_permissions import (
    DatabaseApplicationNotApproved,
    approved_development_migration,
    approved_test_migration,
    require_development_migration_settings,
    require_test_migration_settings,
)
from app.db.migration_review import AUTH_FOUNDATION_TABLES, foundation_tables
from app.db.session import build_engine
from app.models import Base
from app.models.base import require_reviewed_schema

config = context.config
options = context.get_x_argument(as_dictionary=True)
command = getattr(config.cmd_opts, "cmd", None)
command_name = command[0].__name__ if command else "programmatic"
# A user-supplied attribute cannot turn a schema-changing command into a
# read-only command. Only Alembic's actual CLI current operation is exempt.
read_only = command_name == "current"


def include_object(obj, name, type_, reflected, compare_to):
    # Future autogeneration for this initial scope must not propose the other
    # ten ERD tables or dropping unrelated existing tables.
    return type_ != "table" or name in set(AUTH_FOUNDATION_TABLES) | JOBS_TABLES | CV_TABLES


if not read_only:
    # This occurs before configure/run_migrations and before Alembic can create
    # even its version table. No flag can bypass missing column decisions.
    require_reviewed_schema(foundation_tables())
    head = ScriptDirectory.from_config(config).get_revision("head")
    require_reviewed_schema(head.module.review_tables())

if context.is_offline_mode():
    context.configure(
        dialect_name="mysql",
        target_metadata=Base.metadata,
        literal_binds=True,
        compare_type=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    settings = Settings(_env_file=options.get("env_file"))
    development = options.get("target") == "development"
    e6 = options.get("target") in {"jobs-test", "jobs-development"}
    e7 = options.get("target") in {"cv-test", "cv-development"}
    if not read_only:
        if e7:
            require_e7_settings(settings, options["target"])
        elif e6:
            require_e6_settings(settings, options["target"])
        elif development:
            require_development_migration_settings(settings)
        else:
            require_test_migration_settings(settings)
        if command_name != "upgrade" or context.get_revision_argument() != (
            "20261105_03" if e7 else "20261103_02" if e6 else "20261102_01"
        ):
            raise DatabaseApplicationNotApproved("P1 permits only upgrade to 20261102_01")
    engine = build_engine(settings)
    try:
        with engine.connect() as connection:
            migration_scope = (
                approved_development_migration if development else approved_test_migration
            )
            scope = (
                nullcontext()
                if read_only
                else e7_migration(connection, options["target"])
                if e7
                else e6_migration(connection, options["target"])
                if e6
                else migration_scope(connection)
            )
            with scope:
                context.configure(
                    connection=connection,
                    target_metadata=Base.metadata,
                    compare_type=True,
                    transactional_ddl=False,
                    include_object=include_object,
                )
                with context.begin_transaction():
                    context.run_migrations()
    finally:
        engine.dispose()
