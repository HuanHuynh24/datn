"""Explicit SMTP smoke test; never includes a token, credential or account data."""

import json
import os
from email.message import EmailMessage

from pydantic import EmailStr, TypeAdapter, ValidationError

from app.core.config import Settings
from app.core.mail import MailUnavailable, SMTPMailer


def main():
    try:
        recipient = TypeAdapter(EmailStr).validate_python(os.environ.get("SMTP_TEST_EMAIL", ""))
        settings = Settings()
        mailer = SMTPMailer(settings)
        mailer.ensure_configured()
        message = EmailMessage()
        message["From"] = str(settings.smtp_from_email)
        message["To"] = str(recipient)
        message["Subject"] = "Talentiq — Kiểm tra SMTP"
        message.set_content(
            "Đây là email kiểm tra SMTP của Talentiq. Không cần thao tác. "
            "Email này không chứa mật khẩu hoặc liên kết tài khoản."
        )
        mailer.deliver(message)
    except (MailUnavailable, ValidationError):
        print(
            json.dumps(
                {
                    "status": "BLOCKED",
                    "reason": "SMTP configuration, test recipient or delivery unavailable",
                }
            )
        )
        return 1
    print(
        json.dumps(
            {
                "status": "PASS",
                "result": "SMTP accepted test mail; recipient must confirm inbox receipt",
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
