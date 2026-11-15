"""Authenticated TLS SMTP; never write credentials or action links to logs/files."""

import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import Settings


class MailUnavailable(Exception):
    pass


class SMTPMailer:
    def __init__(self, settings: Settings):
        self.settings = settings

    def ensure_configured(self):
        s = self.settings
        if not (s.smtp_host and s.smtp_username and s.smtp_password and s.smtp_from_email):
            raise MailUnavailable()

    def deliver(self, message: EmailMessage | None):
        self.ensure_configured()
        s = self.settings
        try:
            context = ssl.create_default_context()
            client = (
                smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=10, context=context)
                if s.smtp_security == "ssl"
                else smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10)
            )
            with client:
                client.ehlo()
                if s.smtp_security == "starttls":
                    client.starttls(context=context)
                    client.ehlo()
                client.login(s.smtp_username, s.smtp_password.get_secret_value())
                if message is None:
                    code, _ = client.noop()
                    if code != 250:
                        raise MailUnavailable()
                elif client.send_message(message):
                    raise MailUnavailable()
        except (OSError, smtplib.SMTPException, ValueError):
            raise MailUnavailable() from None
