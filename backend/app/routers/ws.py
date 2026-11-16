from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..database import SessionLocal
from ..security import user_from_token
from ..services.crawler import crawler_service
from ..services.notifier import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = ""):
    with SessionLocal() as db:
        user = user_from_token(token, db)
    if not user:
        await ws.close(code=4401)
        return
    is_admin = user.role == "admin"
    await manager.connect(user.id, ws, is_admin)
    await ws.send_json({"type": "hello", "data": {"user_id": user.id, "role": user.role}})
    if is_admin:
        await ws.send_json({"type": "crawl_status", "data": crawler_service.status()})
    try:
        while True:
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user.id, ws)
