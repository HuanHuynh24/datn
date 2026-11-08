import pytest
from pydantic import ValidationError

from app.jobs.schemas import JobContentInput


def test_job_content_keeps_decimal_precision_and_server_owned_identity():
    request = JobContentInput(
        title="  Backend developer  ",
        industry_id="1",
        province_id="2",
        minimum_salary="100.10",
        maximum_salary="200.20",
    )
    assert request.title == "Backend developer"
    assert str(request.minimum_salary) == "100.10"
    for key in ("company_id", "poster_id", "reviewer_id", "status"):
        with pytest.raises(ValidationError):
            JobContentInput(title="Job", industry_id="1", province_id="2", **{key: "1"})


def test_job_content_rejects_invalid_salary_and_duplicate_skills():
    base = {"title": "Job", "industry_id": "1", "province_id": "2"}
    with pytest.raises(ValidationError):
        JobContentInput(**base, minimum_salary="200", maximum_salary="100")
    with pytest.raises(ValidationError):
        JobContentInput(**base, years_experience="1000.1")
    skill = {"skill_id": "1", "required": True, "priority": 0}
    with pytest.raises(ValidationError):
        JobContentInput(**base, skills=[skill, skill])
