"""Outgoing email: SMTP when configured, otherwise .eml files in the outbox folder (dev)."""

import logging
import smtplib
import ssl
import time
import uuid
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from html import escape
from pathlib import Path

from app.config import get_settings

log = logging.getLogger("gg.email")


def _build(to: str, subject: str, text: str, html: str) -> EmailMessage:
    s = get_settings()
    msg = EmailMessage()
    msg["From"] = s.email_from
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=False)
    msg["Message-ID"] = make_msgid(domain=s.email_from.rsplit("@", 1)[-1].strip("> ") or "localhost")
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    return msg


def send(to: str, subject: str, text: str, html: str) -> None:
    """Send now. Called from background tasks so request timing doesn't depend on it."""
    s = get_settings()
    msg = _build(to, subject, text, html)
    if not s.smtp_host:
        out = Path(s.outbox_dir)
        out.mkdir(parents=True, exist_ok=True)
        path = out / f"{int(time.time())}-{uuid.uuid4().hex[:8]}.eml"
        path.write_bytes(bytes(msg))
        log.warning("SMTP not configured; wrote email to %s", path)
        return
    try:
        if s.smtp_security == "ssl":
            server: smtplib.SMTP = smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=15, context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15)
        with server:
            if s.smtp_security == "starttls":
                server.starttls(context=ssl.create_default_context())
            if s.smtp_user:
                server.login(s.smtp_user, s.smtp_password)
            server.send_message(msg)
    except Exception:
        # Never surface SMTP errors to the visitor; they can ask for the email again
        log.exception("failed to send email %r to %s", subject, to)


def link(path: str) -> str:
    return f"{get_settings().app_url.rstrip('/')}{path}"


def _layout(heading: str, body: str, button: str, url: str, footer: str) -> tuple[str, str]:
    name = get_settings().site_name
    text = f"{heading}\n\n{body}\n\n{button}: {url}\n\n{footer}\n\n— {name}"
    html = f"""<!doctype html><html><body style="margin:0;background:#0e0e10;font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#ededee">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#161618;border:1px solid #2a2a2e;border-radius:16px">
<tr><td style="padding:28px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#f07a2a">{escape(name)}</p>
<h1 style="margin:0 0 16px;font-size:20px;color:#ededee">{escape(heading)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#cacacd">{escape(body)}</p>
<a href="{escape(url)}" style="display:inline-block;background:#f07a2a;color:#1a0d03;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">{escape(button)}</a>
<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#8e8e94">{escape(footer)}<br>Or paste this link: <span style="word-break:break-all">{escape(url)}</span></p>
</td></tr></table></td></tr></table></body></html>"""
    return text, html


def verification_email(to: str, token: str) -> tuple[str, str, str]:
    url = link(f"/verify/{token}")
    text, html = _layout(
        "Confirm your email",
        "Thanks for signing up. Confirm this address so you can recover your account if you forget your password.",
        "Confirm email",
        url,
        f"The link works for {get_settings().verify_hours} hours. If you didn't sign up, ignore this email.",
    )
    return "Confirm your email", text, html


def reset_email(to: str, token: str) -> tuple[str, str, str]:
    url = link(f"/reset/{token}")
    text, html = _layout(
        "Reset your password",
        "Someone asked to reset the password for this account. If it was you, choose a new one below.",
        "Choose a new password",
        url,
        f"The link works once, for {get_settings().reset_hours} hours, and signs you out everywhere else. If you didn't ask, ignore this email.",
    )
    return "Reset your password", text, html


def invite_email(to: str, token: str, role: str, inviter: str) -> tuple[str, str, str]:
    url = link(f"/admin/invite/{token}")
    text, html = _layout(
        "You're invited to the team",
        f"{inviter or 'An owner'} invited you to help run {get_settings().site_name} as {role}.",
        "Accept the invite",
        url,
        f"The link works for {get_settings().invite_days} days.",
    )
    return f"Invitation to {get_settings().site_name}", text, html

