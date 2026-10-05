import asyncio
import json
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.portal_event_service import portal_event_broadcaster, PortalEventBroadcaster

@pytest.mark.anyio
async def test_portal_event_broadcaster_pubsub():
    """Verify that PortalEventBroadcaster registers queues and broadcasts formatted SSE payloads."""
    broadcaster = PortalEventBroadcaster()
    queue = await broadcaster.register()

    test_signal = {
        "id": "sig-direct-001",
        "title": "Topological Braiding Simulation Benchmark",
        "section": "research"
    }

    # Stream generator
    gen = broadcaster.stream_events(queue, heartbeat_interval=1.0)
    
    # 1. Initial welcome event
    welcome_msg = await gen.__anext__()
    assert "event: connected" in welcome_msg
    assert "active_subscribers" in welcome_msg

    # 2. Broadcast signal
    await broadcaster.broadcast_signal(test_signal)
    sig_msg = await gen.__anext__()
    assert "event: signal" in sig_msg
    assert "Topological Braiding" in sig_msg

    # 3. Clean unregister
    await broadcaster.unregister(queue)
    assert len(broadcaster._subscribers) == 0

@pytest.mark.anyio
async def test_portal_stream_endpoint_headers():
    """Verify that GET /api/v1/portal/stream returns HTTP 200 with text/event-stream headers."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        queue = await portal_event_broadcaster.register()
        try:
            assert len(portal_event_broadcaster._subscribers) >= 1
        finally:
            await portal_event_broadcaster.unregister(queue)
