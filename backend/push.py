"""Emergent managed push relay (SuprSend). Tokens are resolved by user id upstream."""
import asyncio
import logging
import os

import httpx
from fastapi import HTTPException

log = logging.getLogger("push")
PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")

_client = httpx.AsyncClient(base_url=PUSH_BASE_URL, headers={"X-Push-Key": PUSH_KEY}, timeout=10.0)


async def register(user_id: str, platform: str, device_token: str):
    resp = await _client.post("/api/v1/push/users/register",
                              json={"user_id": user_id, "platform": platform, "device_token": device_token})
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


async def send_push(recipients: list[str], data: dict, idempotency_key: str | None = None, _attempt: int = 0) -> None:
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 recipients per /trigger call; chunk before sending")
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload: dict = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    code = resp.json().get("code", "") if resp.headers.get("content-type", "").startswith("application/json") else ""
    if code == "idempotency_key_in_progress" and idempotency_key and _attempt < 3:
        await asyncio.sleep(3)
        return await send_push(recipients, data, idempotency_key=idempotency_key, _attempt=_attempt + 1)
    if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
        log.warning("Push paused: %s (%s): %s", code, resp.status_code, resp.json().get("message", ""))
        return
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


async def notify(user_id: str, title: str, message: str, action_url: str, key: str | None = None):
    """Fire-and-forget wrapper: push failures never block the caller."""
    try:
        await send_push([user_id], {"title": title, "message": message, "action_url": action_url}, idempotency_key=key)
    except Exception as e:
        log.warning("Push failed (non-blocking): %s", e)
