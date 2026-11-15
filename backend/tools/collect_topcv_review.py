"""Bounded public metadata review; no database client, credentials, images or CV collection."""

import argparse
import json
import re
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

ROOT = Path(__file__).resolve().parents[2]
AGENT = "RecruitmentThesisDataReview/1.0"
ORIGIN = "https://www.topcv.vn"
SOURCES = [
    "cong-ty-tnhh-lg-cns-viet-nam/139535",
    "ngan-hang-tmcp-phat-trien-tp-hcm-hdbank/198812",
    "cong-ty-tnhh-jollibee-viet-nam/31196",
    "cong-ty-co-phan-stringee/75841",
    "cong-ty-tnhh-mtv-fuji-lifecare/258742",
    "cong-ty-co-phan-phat-trien-giao-duc-quoc-te-gaia/66649",
    "cong-ty-co-phan-xuat-nhap-khau-thuong-mai-dai-linh/12040",
    "ngan-hang-tmcp-dong-nam-a-seabank/198978",
    "cong-ty-tnhh-gear-inc-vn/21764",
    "cong-ty-tai-chinh-tong-hop-trach-nhiem-huu-han-mot-thanh-vien-lotte-viet-nam/93041",
]


def safe_url(value):
    parts = urlsplit(value)
    if (
        parts.scheme != "https"
        or parts.hostname != "www.topcv.vn"
        or parts.port not in (None, 443)
        or parts.username
        or parts.password
    ):
        raise ValueError("Non-allowlisted source")
    path = parts.path
    allowed = (
        path == "/robots.txt"
        or re.fullmatch(r"/cong-ty/[a-z0-9-]+/[0-9]+\.html", path)
        or re.fullmatch(r"/cong-ty/[a-z0-9-]+-cid[0-9]+/tuyen-dung\.html", path)
        or re.fullmatch(r"/viec-lam/[a-z0-9-]+/[0-9]+\.html", path)
        or re.fullmatch(r"/brand/[a-z0-9-]+", path)
    )
    if not allowed:
        raise ValueError("Private or non-allowlisted path")
    query = ""
    if path.startswith("/brand/"):
        identifier = parse_qs(parts.query).get("id", [""])[0]
        if identifier and not identifier.isdecimal():
            raise ValueError("Invalid brand identifier")
        query = urlencode({"id": identifier}) if identifier else ""
    return urlunsplit(("https", "www.topcv.vn", path, query, ""))


class MetadataParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.buffer = []
        self.items = []

    def handle_starttag(self, tag, attrs):
        if tag == "script" and dict(attrs).get("type") == "application/ld+json":
            self.active = True
            self.buffer = []

    def handle_data(self, data):
        if self.active:
            self.buffer.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.active:
            self.active = False
            try:
                value = json.loads("".join(self.buffer))
                self.items.extend(value if isinstance(value, list) else [value])
            except ValueError:
                pass


def find_type(items, kind):
    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("@type") == kind:
            return item
        for key in ("@graph", "mainEntity", "about"):
            child = item.get(key)
            found = find_type(child if isinstance(child, list) else [child], kind)
            if found:
                return found
    return None


def numeric(value):
    try:
        number = Decimal(str(value))
        return format(number, "f") if number.is_finite() and number >= 0 else None
    except (InvalidOperation, TypeError):
        return None


def salary_metadata(source):
    source = source if isinstance(source, dict) else {}
    amount = source.get("value", {})
    amount = amount if isinstance(amount, dict) else {}
    result = {
        "currency": source.get("currency"),
        "period": amount.get("unitText"),
        "minimum": numeric(amount.get("minValue")),
        "maximum": numeric(amount.get("maxValue")),
        "single_amount": numeric(amount.get("value")),
        "display": amount.get("value") if isinstance(amount.get("value"), str) else None,
    }
    return result


def locations(source):
    result = []
    for place in source if isinstance(source, list) else [source]:
        if not isinstance(place, dict):
            continue
        address = place.get("address", {})
        if not isinstance(address, dict):
            continue
        result.append(
            {
                k: address.get(k)
                for k in ("streetAddress", "addressLocality", "addressRegion", "addressCountry")
            }
        )
    return result


def organization_websites(source):
    source = source if isinstance(source, list) else [source]
    result = []
    for value in source:
        if not isinstance(value, str):
            continue
        parts = urlsplit(value)
        host = parts.hostname or ""
        if (
            parts.scheme not in ("http", "https")
            or not host
            or parts.username
            or parts.password
            or any(v in host for v in ("google.", "facebook.", "linkedin.", "topcv."))
        ):
            continue
        result.append(urlunsplit((parts.scheme, parts.netloc, parts.path, "", "")))
    return list(dict.fromkeys(result))


def job_metadata(source, url, company_key, retrieved_at):
    requirement = source.get("experienceRequirements", {})
    requirement = requirement if isinstance(requirement, dict) else {}
    months = numeric(requirement.get("monthsOfExperience"))
    deadline = source.get("validThrough")
    state = "UNKNOWN"
    if isinstance(deadline, str):
        try:
            parsed = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
            if parsed.tzinfo:
                state = "EXPIRED" if parsed < retrieved_at else "NOT_PAST_AS_OBSERVED"
        except ValueError:
            pass
    organization = source.get("hiringOrganization", {})
    organization = organization if isinstance(organization, dict) else {}
    return {
        "source_key": "topcv:job:" + urlsplit(url).path.rsplit("/", 1)[-1][:-5],
        "company_source_key": company_key,
        "source_url": url,
        "retrieved_at_utc": retrieved_at.isoformat(),
        "title": source.get("title"),
        "company_name_as_published": organization.get("name"),
        "posted_on_raw": source.get("datePosted"),
        "deadline_raw": deadline,
        "deadline_state": state,
        "employment_type_raw": source.get("employmentType"),
        "experience_months": months,
        "experience_years": format(Decimal(months) / 12, "f") if months else None,
        "salary": salary_metadata(source.get("baseSalary")),
        "locations": locations(source.get("jobLocation")),
        "industry_raw": source.get("industry"),
        "occupational_category_raw": source.get("occupationalCategory"),
        "description": None,
        "requirements": None,
        "logo": None,
        "reuse_permission": "NOT_CONFIRMED",
        "import_ready": False,
        "review_required": [
            "reuse_permission",
            "content_authorization",
            "company_identity",
            "industry_mapping",
            "province_mapping",
            "posting_member",
            "moderation",
            "current_vacancy_confirmation",
        ],
    }


class Collector:
    def __init__(self, checkpoint=None):
        self.robots = None
        self.last_request = 0
        self.requests = 0
        self.checkpoint = checkpoint
        self.result = {
            "review_date": "2026-11-15",
            "database_modified": False,
            "reuse_permission": "NOT_CONFIRMED",
            "companies": [],
            "jobs": [],
            "errors": [],
            "schema": "external-metadata-review-v1",
            "status": "COLLECTING",
        }
        collector = self

        class GuardedRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                newurl = safe_url(newurl)
                if collector.robots and not collector.robots.can_fetch(AGENT, newurl):
                    raise ValueError("Robots blocked redirect")
                return super().redirect_request(req, fp, code, msg, headers, newurl)

        self.opener = urllib.request.build_opener(GuardedRedirect())

    def save_checkpoint(self):
        self.result["request_count"] = self.requests
        if self.checkpoint is not None:
            self.checkpoint.parent.mkdir(parents=True, exist_ok=True)
            temporary = self.checkpoint.with_suffix(".json.tmp")
            temporary.write_text(
                json.dumps(self.result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
            temporary.replace(self.checkpoint)

    def run(self):
        try:
            result = self.collect()
            result["status"] = "STAGED_FOR_REVIEW"
        except (urllib.error.HTTPError, urllib.error.URLError, ValueError, TimeoutError) as error:
            code = error.code if isinstance(error, urllib.error.HTTPError) else None
            retry = error.headers.get("Retry-After", "") if getattr(error, "headers", None) else ""
            self.result.update(
                status="STOPPED",
                http_status=code,
                error_type=type(error).__name__,
                retry_after_seconds=int(retry) if retry.isdecimal() else None,
                automatic_retry=False,
            )
        self.save_checkpoint()
        return self.result

    def fetch(self, url):
        url = safe_url(url)
        if self.robots and not self.robots.can_fetch(AGENT, url):
            raise ValueError("Robots blocked source")
        if self.requests >= 65:
            raise ValueError("Request budget exhausted")
        time.sleep(max(0, 5.0 - (time.monotonic() - self.last_request)))
        self.last_request = time.monotonic()
        self.requests += 1
        request = urllib.request.Request(url, headers={"User-Agent": AGENT})
        with self.opener.open(request, timeout=20) as response:
            content = response.read(3_000_001)
            if len(content) > 3_000_000:
                raise ValueError("Source exceeds review size limit")
            if response.headers.get_content_type() not in ("text/html", "text/plain"):
                raise ValueError("Non-document response")
        return content.decode("utf-8", errors="replace")

    def metadata(self, url):
        parser = MetadataParser()
        parser.feed(self.fetch(url))
        return parser.items

    def collect(self):
        robot_text = self.fetch(ORIGIN + "/robots.txt")
        self.robots = RobotFileParser()
        self.robots.parse(robot_text.splitlines())
        result = self.result
        queues = []
        for source in SOURCES:
            slug, identifier = source.rsplit("/", 1)
            key = "topcv:company:" + identifier
            profile_url = ORIGIN + "/cong-ty/" + source + ".html"
            listing_url = ORIGIN + f"/cong-ty/{slug}-cid{identifier}/tuyen-dung.html"
            organization = find_type(self.metadata(profile_url), "Organization")
            if not organization:
                result["errors"].append({"source_url": profile_url, "issue": "NO_ORGANIZATION"})
                continue
            company = {
                "source_key": key,
                "source_url": profile_url,
                "retrieved_at_utc": datetime.now(UTC).isoformat(),
                "name": organization.get("legalName") or organization.get("name"),
                "websites_as_published": organization_websites(organization.get("sameAs")),
                "address_as_published": locations({"address": organization.get("address")}),
                "size_as_published": organization.get("numberOfEmployees"),
                "tax_code": organization.get("taxID"),
                "industry_raw": organization.get("keywords"),
                "description": None,
                "logo": None,
                "owner_account_id": None,
                "package_id": None,
                "import_ready": False,
                "review_required": [
                    "reuse_permission",
                    "tax_code_verification",
                    "company_identity",
                    "operator_account",
                    "package_assignment",
                ],
            }
            result["companies"].append(company)
            self.save_checkpoint()
            item_list = find_type(self.metadata(listing_url), "ItemList") or {}
            urls = []
            for item in item_list.get("itemListElement", []):
                item = item.get("item", {}) if isinstance(item, dict) else {}
                url = item.get("url", "")
                if isinstance(url, str) and "/viec-lam/" in url:
                    urls.append(safe_url(url))
            queues.append((key, urls[:16]))
            print(f"Company sources reviewed: {len(result['companies'])}/10", flush=True)
        seen = set()
        while any(queue for _, queue in queues) and len(result["jobs"]) < 30:
            for key, queue in queues:
                if not queue or len(result["jobs"]) >= 30:
                    continue
                url = queue.pop(0)
                if url in seen:
                    continue
                seen.add(url)
                source = find_type(self.metadata(url), "JobPosting")
                if not source:
                    result["errors"].append({"source_url": url, "issue": "NO_JOB_POSTING"})
                    continue
                result["jobs"].append(job_metadata(source, url, key, datetime.now(UTC)))
                self.save_checkpoint()
                print(f"Job metadata reviewed: {len(result['jobs'])}/30", flush=True)
        result["request_count"] = self.requests
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--collect-public-review", action="store_true", required=True)
    parser.parse_args()
    target = ROOT / "docs/reports/topcv_staging_2026-11-15.json"
    if target.exists():
        raise SystemExit("Existing checkpoint retained; collection is not repeated automatically")
    result = Collector(target).run()
    print(
        json.dumps(
            {
                "status": result["status"],
                "http_status": result.get("http_status"),
                "companies": len(result["companies"]),
                "jobs": len(result["jobs"]),
                "database_modified": False,
            }
        )
    )
    if result["status"] == "STOPPED":
        raise SystemExit(2)


if __name__ == "__main__":
    main()
