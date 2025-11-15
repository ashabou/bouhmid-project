"""
Email Service

Handles sending emails including weekly reports
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from ..config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """
    Service for sending emails via SMTP
    """

    def __init__(self):
        """Initialize email service"""
        self.logger = logger
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.FROM_EMAIL
        self.from_name = settings.FROM_NAME

    def send_email(
        self,
        to_emails: List[str],
        subject: str,
        html_body: str,
        text_body: Optional[str] = None
    ) -> bool:
        """
        Send an email

        Args:
            to_emails: List of recipient email addresses
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text email body (optional)

        Returns:
            True if sent successfully, False otherwise
        """
        try:
            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = ", ".join(to_emails)

            # Add text and HTML parts
            if text_body:
                part1 = MIMEText(text_body, "plain")
                msg.attach(part1)

            part2 = MIMEText(html_body, "html")
            msg.attach(part2)

            # Send email
            if settings.SMTP_USE_TLS:
                self._send_with_tls(msg, to_emails)
            else:
                self._send_without_tls(msg, to_emails)

            self.logger.info(f"Email sent successfully to {to_emails}")
            return True

        except Exception as e:
            self.logger.error(f"Error sending email: {str(e)}", exc_info=True)
            return False

    def _send_with_tls(self, msg: MIMEMultipart, to_emails: List[str]):
        """Send email with TLS"""
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            server.starttls()
            if self.smtp_user and self.smtp_password:
                server.login(self.smtp_user, self.smtp_password)
            server.sendmail(self.from_email, to_emails, msg.as_string())

    def _send_without_tls(self, msg: MIMEMultipart, to_emails: List[str]):
        """Send email without TLS (for local testing)"""
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            if self.smtp_user and self.smtp_password:
                server.login(self.smtp_user, self.smtp_password)
            server.sendmail(self.from_email, to_emails, msg.as_string())

    def send_weekly_report(
        self,
        to_emails: List[str],
        html_report: str
    ) -> bool:
        """
        Send weekly report email

        Args:
            to_emails: List of recipient emails
            html_report: HTML formatted report

        Returns:
            True if sent successfully
        """
        subject = f"📊 Weekly Prospector Report - {self._get_current_week_range()}"

        text_body = """
This is your weekly Prospector Agent report.

Please view this email in an HTML-capable email client to see the full report.

---
Prospector Agent
Automated Lead Generation System
"""

        return self.send_email(
            to_emails=to_emails,
            subject=subject,
            html_body=html_report,
            text_body=text_body
        )

    def _get_current_week_range(self) -> str:
        """Get current week date range as string"""
        from datetime import datetime, timedelta

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)

        return f"{start_date.strftime('%b %d')} - {end_date.strftime('%b %d, %Y')}"
