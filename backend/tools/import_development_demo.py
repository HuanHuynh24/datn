"""Import user-approved source fixtures into guarded local MySQL, never print secrets."""

import argparse
import hashlib
import json
import os
import secrets
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from app.development_seed import build_plan  # noqa: E402 - standalone repository CLI.

FOLDER = ROOT / ".local-backups/demo-import"
PROGRAM = r"""
import hashlib,json,sys
from sqlalchemy import inspect,select
from app.core.config import Settings
from app.db.session import build_engine
from app.models import Base
from app.development_seed import build_plan,seed
p=json.load(sys.stdin)
try:
 s=Settings()
 assert (s.mysql_host,s.mysql_database,s.mysql_user)==('mysql','recruitment_db','recruitment_app')
 e=build_engine(s)
 with e.connect() as c:
  identity=c.exec_driver_sql('SELECT DATABASE(),@@server_uuid,CURRENT_USER()').one()
  assert tuple(identity)==(
   'recruitment_db','e71fb0d9-d68a-11f1-b475-0242ac120002','recruitment_app@%'
  )
  versions=c.exec_driver_sql('SELECT version_num FROM alembic_version').scalars().all()
  assert versions==['20261105_03']
  names=sorted(inspect(c).get_table_names())
  expected=set(Base.metadata.tables)-{'ungvienkynang','lantrichxuat','ketquamatching'}
  assert set(names)==expected|{'alembic_version'}
  tables={n:Base.metadata.tables[n] for n in names if n!='alembic_version'}
  def snapshot():
   result={}
   for n,t in tables.items():
    result[n]=[dict(r) for r in c.execute(select(t).order_by(*t.primary_key)).mappings()]
   return result
  def digest(value):
   value=json.dumps(value,default=str,sort_keys=True).encode()
   return hashlib.sha256(value).hexdigest()
  before=snapshot(); fingerprint=digest(before)
  result={
   'database':identity[0],'server_uuid':identity[1],'executor':identity[2],
   'revision':'20261105_03','tables':len(tables),
   'row_counts':{n:len(v) for n,v in before.items()},'fingerprint':fingerprint
  }
  if p['operation']=='apply':
   assert fingerprint==p['expected_fingerprint'],'Database changed after backup'
   assert c.exec_driver_sql('SELECT GET_LOCK(%s,10)',('development_demo_import_v1',)).scalar()==1
   try:
    plan=build_plan(p['manifest']);assert digest(plan)==p['plan_digest']
    result['seed']=seed(c,plan,p['credentials'])
    after=snapshot()
    for n,t in tables.items():
     pk=[col.name for col in t.primary_key]
     old={tuple(r[k] for k in pk):r for r in before[n]}
     current={tuple(r[k] for k in pk):r for r in after[n]}
     assert all(
      key in current and current[key]==row for key,row in old.items()
     ),'Existing record changed'
    result['existing_rows_unchanged']=True
    result['row_counts_after']={n:len(v) for n,v in after.items()}
    c.commit()
   except:
    c.rollback();raise
   finally:
    c.exec_driver_sql('SELECT RELEASE_LOCK(%s)',('development_demo_import_v1',))
 e.dispose();print(json.dumps({'status':'PASS',**result},default=str))
except Exception as error:
 print(json.dumps({'status':'STOPPED','error_type':type(error).__name__,'raw_error':'SUPPRESSED'}));sys.exit(2)
"""


def backend(payload):
    run = subprocess.run(
        ["docker", "compose", "exec", "-T", "backend", "python", "-c", PROGRAM],
        input=json.dumps(payload).encode(),
        capture_output=True,
        cwd=ROOT,
        timeout=180,
        check=False,
    )
    if run.returncode:
        raise RuntimeError("Target/import stopped; raw output suppressed")
    return json.loads(run.stdout)


def digest(value):
    return hashlib.sha256(json.dumps(value, default=str, sort_keys=True).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply-approved", action="store_true")
    args = parser.parse_args()
    manifest = json.loads((FOLDER / "source-manifest.json").read_text(encoding="utf-8"))
    for name, expected in manifest["source_sha256"].items():
        actual = hashlib.sha256((ROOT / "frontend/src/marketplace" / name).read_bytes()).hexdigest()
        assert actual == expected, "Source changed; re-export and review"
    plan = build_plan(manifest)
    (FOLDER / "import-plan.json").write_text(
        json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    before = backend({"operation": "preflight"})
    summary = {
        "status": "PREFLIGHT_PASS_NO_WRITES",
        "plan": {
            key: len(plan[key])
            for key in [
                "companies",
                "jobs",
                "candidates",
                "industries",
                "skills",
                "provinces",
            ]
        },
        "target": before,
        "salary_policy": "USD kept in description; VND salary columns NULL, no invented conversion",
        "location_policy": (
            "First province mentioned; Remote uses company province. Full source location retained."
        ),
        "excluded": manifest["excluded"],
    }
    if not args.apply_approved:
        print(json.dumps(summary, ensure_ascii=True, indent=2))
        return
    assert (
        subprocess.run(
            [
                "git",
                "-c",
                f"safe.directory={ROOT.as_posix()}",
                "check-ignore",
                str(FOLDER / "credentials.json"),
            ],
            cwd=ROOT,
            capture_output=True,
            check=False,
        ).returncode
        == 0
    )
    # Full dump stays on disk; credentials enter MySQL only through its environment.
    backup = FOLDER / ("before-import-" + secrets.token_hex(6) + ".sql")
    fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as output:
        run = subprocess.run(
            [
                "docker",
                "compose",
                "exec",
                "-T",
                "mysql",
                "sh",
                "-c",
                'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump --user="$MYSQL_USER" '
                "--single-transaction --no-tablespaces --skip-lock-tables "
                "--set-gtid-purged=OFF --skip-add-drop-table recruitment_db",
            ],
            cwd=ROOT,
            stdout=output,
            stderr=subprocess.PIPE,
            timeout=120,
            check=False,
        )
    assert run.returncode == 0 and b"Dump completed" in backup.read_bytes(), (
        "Backup failed; do not seed"
    )
    assert backend({"operation": "preflight"})["fingerprint"] == before["fingerprint"], (
        "Database changed during backup"
    )
    path = FOLDER / "credentials.json"
    if path.exists():
        credentials = json.loads(path.read_text(encoding="utf-8"))
    else:
        credentials = {}
    for role, items in [("COMPANY_MEMBER", plan["companies"]), ("CANDIDATE", plan["candidates"])]:
        for item in items:
            credentials.setdefault(
                item["key"],
                {
                    "email": f"dev-{item['key']}@example.com",
                    "password": secrets.token_urlsafe(36),
                    "name": item["name"],
                    "role": role,
                },
            )
    # Write credentials before commit so an interrupted process never loses access.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as file:
        json.dump(credentials, file)
    result = backend(
        {
            "operation": "apply",
            "manifest": manifest,
            "plan_digest": digest(plan),
            "credentials": {key: value["password"] for key, value in credentials.items()},
            "expected_fingerprint": before["fingerprint"],
        }
    )
    result["backup"] = str(backup.relative_to(ROOT))
    result["backup_sha256"] = hashlib.sha256(backup.read_bytes()).hexdigest()
    result["plan_counts"] = summary["plan"]
    result["credentials_file"] = str(path.relative_to(ROOT))
    (FOLDER / "receipt.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    public_result = {key: value for key, value in result.items() if key != "seed"}
    public_result["inserted"] = result["seed"]["inserted"]
    print(json.dumps(public_result, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 - never print driver/credential details.
        print(
            json.dumps(
                {
                    "status": "STOPPED",
                    "error_type": type(error).__name__,
                    "raw_error": "SUPPRESSED",
                }
            )
        )
        raise SystemExit(2) from None
