from unittest.mock import Mock

import pytest
from sqlalchemy.dialects import mysql
from sqlalchemy.exc import MultipleResultsFound

from app.auth.repository import SqlAlchemyAccountReader


def account_row():
    return dict(
        account_id=1,
        email="user@example.com",
        password_hash="opaque-test-hash",
        role="ADMIN",
        status="test-policy-value",
        email_verified=False,
        locked_until=None,
        candidate_id=None,
        member_company_id=10,
        member_status="test-policy-value",
        member_title="test-policy-value",
        company_id=10,
    )


def session_with_row(row):
    session = Mock()
    session.execute.return_value.mappings.return_value.one_or_none.return_value = row
    return session


def test_read_projection_uses_bound_parameters_and_no_writes():
    session = session_with_row(account_row())
    attack = "' OR 1=1 --"
    result = SqlAlchemyAccountReader(session).by_email(attack)
    statement = session.execute.call_args.args[0]
    compiled = statement.compile(dialect=mysql.dialect())
    assert attack not in str(compiled)
    assert attack in compiled.params.values()
    assert str(compiled).startswith("SELECT")
    assert "LEFT OUTER JOIN hosoungvien" in str(compiled)
    assert "LEFT OUTER JOIN thanhviendoanhnghiep" in str(compiled)
    assert "LEFT OUTER JOIN doanhnghiep" in str(compiled)
    assert result.account_id == "1" and result.company_id == "10"
    assert result.password_hash not in repr(result)
    session.commit.assert_not_called()
    session.flush.assert_not_called()
    session.add.assert_not_called()


def test_account_id_validation_and_missing_account():
    session = session_with_row(None)
    reader = SqlAlchemyAccountReader(session)
    assert reader.by_id("1") is None
    params = session.execute.call_args.args[0].compile(dialect=mysql.dialect()).params
    assert list(params.values()) == [1]
    session.reset_mock()
    for value in ("0", "01", "1 OR 1=1", "9223372036854775808"):
        with pytest.raises(ValueError):
            reader.by_id(value)
    session.execute.assert_not_called()


def test_duplicate_join_rows_do_not_silently_choose_an_account():
    session = session_with_row(None)
    session.execute.return_value.mappings.return_value.one_or_none.side_effect = (
        MultipleResultsFound()
    )
    with pytest.raises(MultipleResultsFound):
        SqlAlchemyAccountReader(session).by_id("1")


def test_invalid_database_id_is_not_converted_into_a_principal():
    row = account_row() | {"candidate_id": -1}
    with pytest.raises(ValueError):
        SqlAlchemyAccountReader(session_with_row(row)).by_id("1")
