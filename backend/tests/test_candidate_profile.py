import pytest
from pydantic import ValidationError

from app.candidates.schemas import ProfileUpdate


def test_profile_patch_distinguishes_omitted_from_cleared_fields():
    assert ProfileUpdate().model_dump(exclude_unset=True) == {}
    assert ProfileUpdate(address=None).model_dump(exclude_unset=True) == {"address": None}
    with pytest.raises(ValidationError):
        ProfileUpdate(full_name=None)
    with pytest.raises(ValidationError):
        ProfileUpdate(account_id="2")


def test_profile_json_bounds_and_finite_values():
    with pytest.raises(ValidationError):
        ProfileUpdate(education={"bad": float("nan")})
    with pytest.raises(ValidationError):
        ProfileUpdate(education="x" * 65536)
    assert ProfileUpdate(education=[{"school": "University"}]).education == [
        {"school": "University"}
    ]
