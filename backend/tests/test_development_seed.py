from decimal import Decimal

import pytest

from app.development_seed import build_plan, primary_province, stable_key, vnd_salary


def sample_manifest():
    company = {"name": "Development Seed Example", "location": "Hà Nội"}
    return {
        "version": 1,
        "target_database": "recruitment_db",
        "source_sha256": {},
        "fixtures": {
            "companies": [company],
            "jobs": [
                {
                    "id": "j1",
                    "company": company,
                    "title": "Seed Engineer",
                    "location": "Remote",
                    "currency": "USD",
                    "salaryMin": 1000,
                    "salaryMax": 2000,
                    "skills": ["Python"],
                    "category": "Engineering",
                }
            ],
            "candidates": [
                {
                    "id": "c1",
                    "name": "Seed Candidate",
                    "location": "Hà Nội",
                    "about": "Synthetic candidate",
                    "education": "Example university",
                    "experience": 2,
                    "role": "Engineer",
                    "skills": ["Python"],
                }
            ],
            "categories": [{"name": "Engineering"}],
        },
        "reference": {"companies": [], "jobs": [], "categories": []},
    }


def test_plan_preserves_provenance_and_never_invents_salary():
    plan = build_plan(sample_manifest())
    assert len(plan["companies"]) == len(plan["jobs"]) == len(plan["candidates"]) == 1
    job = plan["jobs"][0]
    assert job["minimum_salary"] is None and job["maximum_salary"] is None
    assert "USD" in job["description"] and "chưa xác minh" in job["description"]
    assert job["province"] == "Hà Nội" and job["work_type"] == "Remote"
    assert "match" not in job and "applicants" not in job


def test_primary_province_uses_first_mention_and_preserves_alias():
    assert primary_province("Lạng Sơn Phú Thọ Thái Nguyên") == "Lạng Sơn"
    assert primary_province("Hồ Chí Minh Đồng Nai") == "Thành phố Hồ Chí Minh"
    with pytest.raises(ValueError):
        primary_province("Unknown location")


@pytest.mark.parametrize(
    "salary,expected",
    [
        ("14 triệu - 20 triệu", (Decimal(14000000), Decimal(20000000))),
        ("Thương lượng", (None, None)),
        ("1000 - 2000 USD", (None, None)),
        ("Lên tới 20 triệu", (None, None)),
    ],
)
def test_salary_mapping_is_explicit(salary, expected):
    assert vnd_salary({"salary": salary}) == expected


def test_stable_key_ignores_case_and_whitespace():
    assert stable_key("Example   Company") == stable_key("example company")


def test_manifest_target_cannot_be_production():
    manifest = sample_manifest()
    manifest["target_database"] = "production"
    with pytest.raises(ValueError):
        build_plan(manifest)
