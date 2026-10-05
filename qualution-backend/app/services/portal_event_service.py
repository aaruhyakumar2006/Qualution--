import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Set, Dict, Any, AsyncGenerator

logger = logging.getLogger("portal_event_service")

class PortalEventBroadcaster:
    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()

    async def register(self) -> asyncio.Queue:
        """Register a new SSE client subscriber queue."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers.add(queue)
        logger.info(f"New SSE client connected. Active subscribers: {len(self._subscribers)}")
        return queue

    async def unregister(self, queue: asyncio.Queue):
        """Unregister a disconnected SSE client subscriber queue."""
        async with self._lock:
            self._subscribers.discard(queue)
        logger.info(f"SSE client disconnected. Remaining subscribers: {len(self._subscribers)}")

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        """Broadcast an event payload to all active subscriber queues."""
        payload = {
            "event": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        msg = f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"
        
        async with self._lock:
            subs = list(self._subscribers)

        for queue in subs:
            try:
                if queue.full():
                    try:
                        queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                queue.put_nowait(msg)
            except Exception as e:
                logger.warning(f"Failed to deliver SSE event to subscriber: {e}")

    async def broadcast_signal(self, item: Dict[str, Any]):
        """Convenience helper for broadcasting a new quantum telemetry signal."""
        await self.broadcast("signal", item)

    async def stream_events(self, queue: asyncio.Queue, heartbeat_interval: float = 15.0) -> AsyncGenerator[str, None]:
        """
        Yields SSE messages from the subscriber queue with periodic keep-alive heartbeats.
        """
        try:
            # Send initial connection confirmation
            welcome = {
                "event": "connected",
                "data": {"status": "connected", "active_subscribers": len(self._subscribers)},
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            yield f"event: connected\ndata: {json.dumps(welcome)}\n\n"

            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=heartbeat_interval)
                    yield msg
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep connection alive
                    yield ": ping\n\n"
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            await self.unregister(queue)

portal_event_broadcaster = PortalEventBroadcaster()
