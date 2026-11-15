import json
import urllib.error
from datetime import UTC, datetime
from urllib.robotparser import RobotFileParser

import pytest

from tools.collect_topcv_review import (
    Collector,
    MetadataParser,
    find_type,
    job_metadata,
    organization_websites,
    safe_url,
    salary_metadata,
)


@pytest.mark.parametrize(
    "url",
    [
        "http://www.topcv.vn/cong-ty/example/1.html",
        "https://example.com/viec-lam/example/1.html",
        "https://www.topcv.vn:8443/viec-lam/example/1.html",
        "https://user:password@www.topcv.vn/viec-lam/example/1.html",
        "https://www.topcv.vn/xem-cv/private",
        "https://www.topcv.vn/cv-ung-vien/1",
        "https://www.topcv.vn/private/1",
    ],
)
def test_source_review_rejects_nonpublic_or_external_targets(url):
    with pytest.raises(ValueError):
        safe_url(url)


def test_source_review_strips_tracking_without_changing_identity():
    assert safe_url("https://www.topcv.vn/viec-lam/example/12.html?token=tracking#x") == (
        "https://www.topcv.vn/viec-lam/example/12.html"
    )
    assert safe_url("https://www.topcv.vn/brand/example?id=12&utm_source=x") == (
        "https://www.topcv.vn/brand/example?id=12"
    )


def test_source_review_parser_accepts_graph_and_ignores_malformed_payload():
    parser = MetadataParser()
    parser.feed('<script type="application/ld+json">broken</script>')
    data = {
        "@graph": [
            {
                "@type": "ProfilePage",
                "mainEntity": {"@type": "Organization", "name": "Example company"},
            }
        ]
    }
    parser.feed('<script type="application/ld+json">' + json.dumps(data) + "</script>")
    assert find_type(parser.items, "Organization")["name"] == "Example company"


def test_source_review_does_not_copy_contacts_description_or_invent_missing_fields():
    record = job_metadata(
        {
            "title": "Engineer",
            "description": "Long description not licensed for republication",
            "telephone": "private contact",
            "email": "private@example.com",
            "hiringOrganization": {"name": "Company", "telephone": "another contact"},
            "validThrough": "2026-11-14T23:59:59+07:00",
        },
        "https://www.topcv.vn/viec-lam/engineer/1.html",
        "topcv:company:2",
        datetime(2026, 11, 15, tzinfo=UTC),
    )
    assert record["deadline_state"] == "EXPIRED"
    assert record["description"] is None and record["requirements"] is None
    assert record["experience_years"] is None and record["import_ready"] is False
    assert record["salary"]["minimum"] is None
    assert "private" not in json.dumps(record)
    assert "Long description" not in json.dumps(record)


def test_source_review_preserves_salary_units_and_unknown_negotiated_amount():
    source = {"currency": "VND", "value": {"unitText": "MONTH", "value": "Thoả thuận"}}
    value = salary_metadata(source)
    assert value["minimum"] is None and value["maximum"] is None
    assert value["single_amount"] is None
    assert value["display"] == "Thoả thuận"
    source = {"currency": "USD", "value": {"unitText": "YEAR", "minValue": "1000"}}
    value = salary_metadata(source)
    assert value["currency"] == "USD" and value["period"] == "YEAR"
    assert value["minimum"] == "1000"


def test_source_review_obeys_robots_before_network_access(monkeypatch):
    collector = Collector()
    collector.robots = RobotFileParser()
    collector.robots.parse(["User-agent: *", "Disallow: /viec-lam/"])

    def no_network(*args, **kwargs):
        pytest.fail("Robots-disallowed URL reached network")

    monkeypatch.setattr(collector.opener, "open", no_network)
    with pytest.raises(ValueError, match="Robots blocked"):
        collector.fetch("https://www.topcv.vn/viec-lam/example/12.html")


def test_source_review_keeps_checkpoint_and_never_retries_after_rate_limit(tmp_path, monkeypatch):
    target = tmp_path / "review.json"
    collector = Collector(target)
    calls = []

    def limited():
        calls.append("request")
        collector.result["companies"].append({"source_key": "topcv:company:1"})
        collector.save_checkpoint()
        raise urllib.error.HTTPError(
            "https://www.topcv.vn/viec-lam/example/1.html",
            429,
            "Rate limited",
            {"Retry-After": "600"},
            None,
        )

    monkeypatch.setattr(collector, "collect", limited)
    result = collector.run()
    stored = json.loads(target.read_text(encoding="utf-8"))
    assert calls == ["request"]
    assert result["status"] == stored["status"] == "STOPPED"
    assert stored["http_status"] == 429 and stored["retry_after_seconds"] == 600
    assert stored["companies"] == [{"source_key": "topcv:company:1"}]
    assert stored["automatic_retry"] is False


def test_source_review_websites_exclude_contacts_tracking_and_unsafe_links():
    assert organization_websites(None) == []
    assert organization_websites(
        [
            "javascript:alert(1)",
            "https://user:password@example.com/",
            "https://www.google.com/maps/",
            "https://example.com/careers?session=tracking#x",
        ]
    ) == ["https://example.com/careers"]


def test_source_review_existing_checkpoint_blocks_repeat_collection(tmp_path, monkeypatch):
    import tools.collect_topcv_review as cli

    target = tmp_path / "docs/reports/topcv_staging_2026-11-15.json"
    target.parent.mkdir(parents=True)
    target.write_text('{"status":"STOPPED","http_status":429}', encoding="utf-8")
    monkeypatch.setattr(cli, "ROOT", tmp_path)
    monkeypatch.setattr("sys.argv", ["collect", "--collect-public-review"])

    def no_network(*args, **kwargs):
        pytest.fail("Existing stopped batch was collected again")

    monkeypatch.setattr(cli.Collector, "run", no_network)
    with pytest.raises(SystemExit, match="Existing checkpoint retained"):
        cli.main()
