"""Run one real test email from the Backend container to the configured owner address."""

import os
import subprocess
from pathlib import Path

from dotenv import dotenv_values


def main():
    root = Path(__file__).resolve().parents[2]
    values = dotenv_values(root / ".env")
    if not values.get("SMTP_TEST_EMAIL"):
        print("SMTP test BLOCKED: configure SMTP_TEST_EMAIL locally; no email sent.")
        return 1
    environment = dict(os.environ)
    environment["SMTP_TEST_EMAIL"] = values["SMTP_TEST_EMAIL"]
    return subprocess.run(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "-e",
            "SMTP_TEST_EMAIL",
            "backend",
            "python",
            "-m",
            "app.core.smtp_check",
        ],
        cwd=root,
        env=environment,
        check=False,
    ).returncode


if __name__ == "__main__":
    raise SystemExit(main())
