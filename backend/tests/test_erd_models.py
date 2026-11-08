import hashlib
import json
from pathlib import Path

import pytest
from sqlalchemy import UniqueConstraint, inspect
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import configure_mappers
from sqlalchemy.schema import CreateTable

from app.db.inspect_auth import type_matches
from app.db.migration_review import foundation_tables, render_sql_review, review_report
from app.models import (
    Base,
    DoanhNghiep,
    TaiKhoan,
    ThanhVienDoanhNghiep,
)
from app.models.base import UnresolvedSchemaError, require_reviewed_schema


def source_contract():
    return json.loads((Path(__file__).parent / "fixtures/erd_r2_contract.json").read_text())


def auth_approval():
    auth = json.loads(
        (Path(__file__).parent / "fixtures/auth_schema_approved_2026-11-02.json").read_text()
    )["columns"]
    jobs = json.loads(
        (Path(__file__).parent / "fixtures/jobs_schema_approved_2026-11-03.json").read_text()
    )["columns"]
    cv = json.loads(
        (Path(__file__).parent / "fixtures/cv_schema_approved_2026-11-05.json").read_text()
    )["columns"]
    return auth | jobs | cv


def test_all_models_match_every_erd_column_flag_fk_and_relationship():
    contract = source_contract()
    entities = contract["entities"]
    tables = Base.metadata.tables
    approved = auth_approval()
    assert set(tables) == {e["name"] for e in entities}
    assert len(tables) == 16 and sum(len(t.c) for t in tables.values()) == 136
    assert sum(len(t.foreign_keys) for t in tables.values()) == 23
    source_columns = {c["_id"]: f"{e['name']}.{c['name']}" for e in entities for c in e["columns"]}
    expected_fk_names = {r["foreignKeyName"] for r in contract["relationships"]}
    actual_fk_names = {fk.constraint.name for t in tables.values() for fk in t.foreign_keys}
    assert actual_fk_names == expected_fk_names
    for entity in entities:
        table = tables[entity["name"]]
        assert list(table.c.keys()) == [c["name"] for c in entity["columns"]]
        for raw in entity["columns"]:
            col = table.c[raw["name"]]
            expected_type = raw["type"] + (f"({raw['length']})" if raw.get("length") else "")
            assert type_matches(expected_type, col.type), (table.name, col.name)
            decision = approved.get(f"{table.name}.{col.name}")
            expected_nullable = decision["nullable"] if decision else raw.get("nullable")
            assert col.nullable is expected_nullable, (table.name, col.name)
            if decision and raw.get("nullable") is not None:
                assert decision["nullable"] is raw["nullable"]
            assert col.primary_key == bool(raw.get("primaryKey"))
            assert col.unique == bool(raw.get("unique"))
            assert col.default is None
            if decision:
                actual_default = (
                    str(col.server_default.arg) if col.server_default is not None else "NO DEFAULT"
                )
                assert actual_default == decision["server_default"]
                assert col.info["decision_id"] == decision["id"]
                assert col.info["nullable_review"] == "CONFIRMED"
            else:
                assert col.server_default is None
                assert col.info["default_review"] == "UNSPECIFIED"
            if raw.get("foreignKey"):
                assert {fk.target_fullname for fk in col.foreign_keys} == {
                    source_columns[raw["referenceTo"]["$ref"]]
                }
            else:
                assert not col.foreign_keys
    configure_mappers()
    assert len(list(Base.registry.mappers)) == 16
    assert sum(len(m.relationships) for m in Base.registry.mappers) == 46
    assert inspect(TaiKhoan).relationships.hoso_ungvien.uselist is False
    assert inspect(TaiKhoan).relationships.thanh_vien_theo_vai_tro.uselist is False
    for mapper in Base.registry.mappers:
        for relation in mapper.relationships:
            assert relation.back_populates
            assert not relation.cascade.delete and not relation.cascade.delete_orphan


def test_source_artifact_matches_original_if_original_is_present():
    sources = list((Path(__file__).resolve().parents[2] / "docs/erd").glob("*.mdj"))
    if not sources:
        pytest.skip("Original .mdj is not in Docker build context; derived contract still tested")
    raw = sources[0].read_bytes()
    contract = source_contract()
    assert hashlib.sha256(raw).hexdigest() == contract["source_sha256"]
    source = json.loads(raw)
    entities = [
        e for e in source["ownedElements"][0]["ownedElements"] if e.get("_type") == "ERDEntity"
    ]
    assert contract["entities"] == [
        {"_id": e["_id"], "name": e["name"], "columns": e["columns"]} for e in entities
    ]


def test_auto_increment_and_documented_composite_uniqueness():
    independent = [
        c for t in Base.metadata.tables.values() for c in t.primary_key if not c.foreign_keys
    ]
    assert len(independent) == 13 and all(c.autoincrement is True for c in independent)
    assert ThanhVienDoanhNghiep.__table__.c.idtaikhoan.autoincrement is False
    for name in ("ungvienkynang", "kynangtin"):
        assert len(Base.metadata.tables[name].primary_key) == 2
        assert all(c.autoincrement is False for c in Base.metadata.tables[name].primary_key)
    application = Base.metadata.tables["donungtuyen"]
    assert any(
        isinstance(c, UniqueConstraint) and list(c.columns.keys()) == ["idungvien", "idtin"]
        for c in application.constraints
    )


def test_approved_codes_validate_in_python_without_database_enums():
    assert TaiKhoan(vaitro="CANDIDATE", trangthai="ACTIVE").vaitro == "CANDIDATE"
    assert ThanhVienDoanhNghiep(chucvunoibo="OWNER", trangthai="ACTIVE").chucvunoibo == "OWNER"
    assert DoanhNghiep(trangthaiduyet="PENDING").trangthaiduyet == "PENDING"
    for factory, kwargs in [
        (TaiKhoan, {"vaitro": "ROOT"}),
        (TaiKhoan, {"trangthai": "LOCKED"}),
        (ThanhVienDoanhNghiep, {"chucvunoibo": "ADMIN"}),
        (DoanhNghiep, {"trangthaiduyet": "ACTIVE"}),
    ]:
        with pytest.raises(ValueError):
            factory(**kwargs)
    assert str(TaiKhoan.__table__.c.vaitro.type) == "VARCHAR(30)"


def test_only_the_six_approved_tables_compile_and_other_ten_remain_blocked():
    report = review_report()
    assert len(report["all_pending"]["nullable"]) == 17
    assert len(report["all_pending"]["defaults"]) == 29
    assert report["auth_pending"] == {"nullable": [], "defaults": []}
    assert not any(
        key.startswith(("lantrichxuat.", "ketquamatching."))
        for key in report["auth_pending"]["nullable"]
    )
    for table in Base.metadata.tables.values():
        if all(c.info.get("default_review") != "UNSPECIFIED" for c in table.c):
            sql = str(CreateTable(table).compile(dialect=mysql.dialect()))
            assert "UNRESOLVED" not in sql
        else:
            with pytest.raises(UnresolvedSchemaError):
                str(CreateTable(table).compile(dialect=mysql.dialect()))
    require_reviewed_schema(foundation_tables())


def test_sql_review_is_marked_non_executable_and_does_not_mutate_constraints():
    before = {id(c): c._create_rule for t in Base.metadata.tables.values() for c in t.constraints}
    review = render_sql_review()
    assert review.startswith("-- REVIEW ONLY: NOT EXECUTABLE")
    assert review.count("<NULLABILITY_UNRESOLVED>") == 17
    assert review.count("<DEFAULT_DECISION_UNRESOLVED>") == 29
    assert review.count("CREATE TABLE") == 16
    assert {
        id(c): c._create_rule for t in Base.metadata.tables.values() for c in t.constraints
    } == before


def test_all_54_approved_decisions_collations_and_foreign_key_actions():
    approved = auth_approval()
    assert len(approved) == 107
    assert len({c["id"] for c in approved.values()}) == 107
    assert sum(c["server_default"] == "0" for c in approved.values()) == 4
    for table in foundation_tables():
        assert table.dialect_kwargs["mysql_collate"] == "utf8mb4_unicode_ci"
        for fk in table.foreign_keys:
            assert fk.ondelete == fk.onupdate == "RESTRICT"
    assert TaiKhoan.__table__.c.email.type.collation == "utf8mb4_0900_as_ci"
    for table, name, nullable in [
        ("taikhoan", "nhanemail", False),
        ("hosoungvien", "thoigiancapnhat", False),
        ("hosoungvien", "hinhthuclamviecmongmuon", True),
        ("doanhnghiep", "diachi", True),
        ("doanhnghiep", "ngaybatdaugoi", True),
    ]:
        assert Base.metadata.tables[table].c[name].nullable is nullable
