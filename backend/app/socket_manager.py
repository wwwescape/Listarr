import socketio

from app.schemas.list_item import ListItemOut

# AsyncServer (not Server — no ASGI support). CORS here is independent of
# FastAPI's CORSMiddleware: socketio.ASGIApp intercepts /socket.io/... before
# FastAPI's middleware ever runs. "*" is safe specifically because the
# frontend's `io(serverURL)` call has no `withCredentials`, so no cookie ever
# rides the socket connection.
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")


def _list_room(list_id) -> str:
    return f"list:{list_id}"


@sio.event
async def joinList(sid, list_id):
    await sio.enter_room(sid, _list_room(list_id))


@sio.event
async def leaveList(sid, list_id):
    await sio.leave_room(sid, _list_room(list_id))


def serialize_item(item) -> dict:
    # mode="json" turns datetimes/nested models into plain JSON-safe values —
    # the same shape the REST endpoints already return, so the client can
    # reuse one reconciliation path for both.
    return ListItemOut.model_validate(item).model_dump(mode="json")


async def notify_item_added(list_id, item, skip_sid=None) -> None:
    await sio.emit(
        "itemAdded",
        {"list_id": list_id, "item": serialize_item(item)},
        room=_list_room(list_id),
        skip_sid=skip_sid,
    )


async def notify_item_updated(list_id, item, skip_sid=None) -> None:
    await sio.emit(
        "itemUpdated",
        {"list_id": list_id, "item": serialize_item(item)},
        room=_list_room(list_id),
        skip_sid=skip_sid,
    )


async def notify_item_deleted(list_id, item_id, skip_sid=None) -> None:
    await sio.emit(
        "itemDeleted",
        {"list_id": list_id, "item_id": item_id},
        room=_list_room(list_id),
        skip_sid=skip_sid,
    )
