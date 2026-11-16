import asyncio
import json
import logging
import smtplib
from collections import defaultdict
from email.mime.text import MIMEText

import requests
from fastapi import WebSocket

from ..config import get_settings

log = logging.getLogger("recipepick.notifier")
settings = get_settings()


class ConnectionManager:
    """사용자별 WebSocket 연결을 관리하고 실시간 이벤트를 푸시한다."""

    def __init__(self) -> None:
        self.connections: dict[int, set[WebSocket]] = defaultdict(set)
        self.admins: set[int] = set()
        self.loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, user_id: int, ws: WebSocket, is_admin: bool) -> None:
        await ws.accept()
        self.connections[user_id].add(ws)
        if is_admin:
            self.admins.add(user_id)

    def disconnect(self, user_id: int, ws: WebSocket) -> None:
        self.connections[user_id].discard(ws)
        if not self.connections[user_id]:
            self.connections.pop(user_id, None)
            self.admins.discard(user_id)

    def set_admin(self, user_id: int, is_admin: bool) -> None:
        if is_admin and user_id in self.connections:
            self.admins.add(user_id)
        else:
            self.admins.discard(user_id)

    @property
    def online_count(self) -> int:
        return len(self.connections)

    async def send_user(self, user_id: int, message: dict) -> None:
        for ws in list(self.connections.get(user_id, ())):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(user_id, ws)

    async def send_admins(self, message: dict) -> None:
        for uid in list(self.admins):
            await self.send_user(uid, message)

    async def broadcast(self, message: dict) -> None:
        for uid in list(self.connections):
            await self.send_user(uid, message)

    def emit(self, coro) -> None:
        """동기 컨텍스트(스레드)에서 이벤트 루프로 메시지를 안전하게 전달한다."""
        if not self.loop:
            coro.close()
            return
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is self.loop:
            self.loop.create_task(coro)
        else:
            asyncio.run_coroutine_threadsafe(coro, self.loop)


manager = ConnectionManager()


def send_webhooks(title: str, message: str) -> list[str]:
    """텔레그램/디스코드/이메일 웹훅으로 알림을 전송하고 성공한 채널 목록을 반환한다."""
    sent: list[str] = []
    text = f"[RecipePick] {title}\n{message}"
    if settings.telegram_bot_token and settings.telegram_chat_id:
        try:
            requests.post(
                f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
                json={"chat_id": settings.telegram_chat_id, "text": text},
                timeout=10,
            ).raise_for_status()
            sent.append("telegram")
        except requests.RequestException as e:
            log.warning("telegram webhook failed: %s", e)
    if settings.discord_webhook_url:
        try:
            requests.post(settings.discord_webhook_url, json={"content": text}, timeout=10).raise_for_status()
            sent.append("discord")
        except requests.RequestException as e:
            log.warning("discord webhook failed: %s", e)
    if settings.smtp_host and settings.alert_email_to:
        try:
            msg = MIMEText(message, _charset="utf-8")
            msg["Subject"] = f"[RecipePick] {title}"
            msg["From"] = settings.smtp_user or "noreply@recipepick"
            msg["To"] = settings.alert_email_to
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                smtp.starttls()
                if settings.smtp_user:
                    smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(msg)
            sent.append("email")
        except (smtplib.SMTPException, OSError) as e:
            log.warning("email webhook failed: %s", e)
    return sent


def notification_to_dict(n) -> dict:
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "message": n.message,
        "payload": json.loads(n.payload or "{}"),
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat(),
    }
