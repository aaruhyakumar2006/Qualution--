import time
from typing import Dict, Any, List, Optional, Tuple
from fastapi import APIRouter, HTTPException, Header, Query, Depends, status, Response
from starlette.responses import StreamingResponse
from app.core.config import settings
from app.core.auth_dependency import get_current_user, CurrentUser
from app.schemas.portal_submission import (
    CreateSubmissionRequest,
    CreateReportRequest,
    SubmissionResponse
)
from app.services.rate_limiter import rate_limiter
from app.services.ingestion_handlers import clean_tracking_url
from app.services.portal_db_service import portal_db_service, compute_title_hash
from app.services.portal_ingestion_service import portal_ingestion_service
from app.services.portal_event_service import portal_event_broadcaster
from app.schemas.portal_hardware import HardwareTelemetryResponse, HardwareStatusSummary
from app.services.portal_hardware_service import portal_hardware_service
from app.schemas.portal_benchmark import (
    BenchmarkPreset,
    BenchmarkComparisonRequest,
    BenchmarkComparisonResponse,
)
from app.services.portal_benchmark_service import (
    get_benchmark_presets,
    compare_circuit_across_qpus,
)
from app.schemas.portal_analytics import (
    AnalyticsOverviewResponse,
    TopicClustersResponse,
)
from app.services.portal_analytics_service import portal_analytics_service
from app.schemas.portal_explainer import ExplainRequest, ExplainResponse
from app.services.portal_explainer_service import mario_portal_explainer_service
from app.schemas.portal_importer import BatchImportRequest, BatchImportResponse
from app.services.portal_importer_service import portal_importer_service
from app.schemas.portal_collaboration import (
    JoinRoomRequest,
    JoinRoomResponse,
    SignalAnnotation,
    CreateAnnotationRequest,
    RoomChatMessage,
    PostChatMessageRequest
)
from app.services.portal_collaboration_service import portal_collaboration_service
from app.schemas.portal_pulse import (
    PulsePreset,
    PulseSimulateRequest,
    PulseSimulateResponse
)
from app.services.portal_pulse_service import portal_pulse_service

router = APIRouter(prefix="/portal", tags=["Community Telemetry Portal"])

# In-memory cache for public GET endpoints with TTL
_cache_store: Dict[str, Tuple[float, Any]] = {}

def get_from_cache(key: str) -> Optional[Any]:
    if key in _cache_store:
        timestamp, value = _cache_store[key]
        if time.time() - timestamp < settings.PORTAL_CACHE_TTL_SECONDS:
            return value
        del _cache_store[key]
    return None

def set_in_cache(key: str, value: Any):
    _cache_store[key] = (time.time(), value)

@router.get("/sections", response_model=List[Dict[str, Any]])
async def get_sections():
    """
    Returns the dynamic list of portal books/sections with accent colors,
    subtitles, and live item counts.
    """
    cache_key = "portal:sections"
    cached = get_from_cache(cache_key)
    if cached is not None:
        return cached

    sections = await portal_db_service.get_portal_sections()
    set_in_cache(cache_key, sections)
    return sections

@router.get("/tags", response_model=List[Dict[str, Any]])
async def get_curriculum_tags():
    """
    Returns the active list of curriculum tags mapped to Workbench lessons.
    """
    cache_key = "portal:tags"
    cached = get_from_cache(cache_key)
    if cached is not None:
        return cached

    tags = await portal_db_service.get_curriculum_tags()
    set_in_cache(cache_key, tags)
    return tags

@router.get("/items")
async def get_items(
    section: Optional[str] = Query(None, description="Filter by section: all, courses, news, research, events, opportunities, qualution"),
    level: Optional[str] = Query(None, description="Filter by difficulty level: Beginner, Intermediate, Advanced"),
    q: Optional[str] = Query(None, description="Full-text search query across titles, abstracts, summaries, and tags"),
    cursor: Optional[str] = Query(None, description="Keyset cursor pagination identifier"),
    limit: int = Query(default=10, ge=1, le=50, description="Page size limit")
):
    """
    Keyset-paginated portal content items with PostgreSQL full-text search,
    section filtering, and educational level filtering.
    """
    clamped_limit = min(max(1, limit), settings.PORTAL_PAGE_SIZE_MAX)
    cache_key = f"portal:items:{section}:{level}:{q}:{cursor}:{clamped_limit}"
    cached = get_from_cache(cache_key)
    if cached is not None:
        return cached

    items, next_cursor, has_more = await portal_db_service.get_portal_items(
        section=section,
        level=level,
        q=q,
        cursor=cursor,
        limit=clamped_limit
    )

    response_payload = {
        "items": items,
        "next_cursor": next_cursor,
        "has_more": has_more,
        "limit": clamped_limit
    }
    set_in_cache(cache_key, response_payload)
    return response_payload

@router.get("/items/{item_id}")
async def get_item_by_id(item_id: str):
    """
    Retrieves full details for a single content item by its unique ID.
    """
    cache_key = f"portal:item:{item_id}"
    cached = get_from_cache(cache_key)
    if cached is not None:
        return cached

    item = await portal_db_service.get_portal_item_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content item '{item_id}' not found."
        )

    set_in_cache(cache_key, item)
    return item

@router.post("/ingest")
async def trigger_manual_ingestion(
    x_ingestion_secret: Optional[str] = Header(None, alias="X-Ingestion-Secret")
):
    """
    Protected manual trigger for the Community Telemetry Portal ingestion pipeline.
    Requires X-Ingestion-Secret header matching INGESTION_SECRET from Settings.
    """
    if not x_ingestion_secret or x_ingestion_secret != settings.INGESTION_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Ingestion-Secret header."
        )

    # Invalidate cache so newly ingested items reflect immediately
    _cache_store.clear()

    result = await portal_ingestion_service.run_ingestion_cycle()
    return result

@router.get("/stream")
async def stream_portal_telemetry():
    """
    Server-Sent Events (SSE) stream for real-time quantum telemetry signals.
    Streams newly ingested preprints, news, and approved community submissions in real-time.
    """
    queue = await portal_event_broadcaster.register()
    return StreamingResponse(
        portal_event_broadcaster.stream_events(queue),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# ─── USER SUBMISSIONS & REPORTING (PHASE 1) ───────────────────────────────────
from datetime import datetime, timezone
from app.schemas.portal_moderation import (
    ModerationRejectRequest,
    ModerationRemoveRequest,
    ModerationQueueItem
)
from app.services.portal_screening_service import portal_screening_service

TYPE_TO_SECTION_MAP = {
    "news": "news",
    "paper": "research",
    "research": "research",
    "resource": "courses",
    "courses": "courses",
    "event": "events",
    "events": "events",
    "opportunity": "opportunities",
    "project": "research"
}

@router.post("/submissions", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def create_submission(
    payload: CreateSubmissionRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Submits a new signal to the community portal.
    - Derived author_id and role from authenticated session.
    - Rate limited per user per minute & day.
    - Automatic LLM safety & spam screening with fallback.
    - Auto-approved for roles in AUTO_APPROVE_ROLES (e.g. teachers/admins); auto-rejected on high spam; pending for students.
    - URL tracking parameters stripped; server NEVER fetches external URL to prevent SSRF.
    """
    # 1. Enforce per-user sliding window rate limits
    rate_limiter.check_rate_limit(
        key=f"sub_min:{current_user.id}",
        max_requests=settings.SUBMISSION_RATE_LIMIT_PER_MINUTE,
        window_seconds=60.0,
        action_name="submissions (per-minute limit)"
    )
    rate_limiter.check_rate_limit(
        key=f"sub_day:{current_user.id}",
        max_requests=settings.SUBMISSION_RATE_LIMIT_PER_DAY,
        window_seconds=86400.0,
        action_name="submissions (daily limit)"
    )

    # 2. Canonical URL handling & deduplication check
    canonical_url = None
    if payload.url:
        canonical_url = clean_tracking_url(payload.url)
        t_hash = compute_title_hash(payload.title)
        if await portal_db_service.check_item_exists(canonical_url, t_hash):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This signal or URL has already been submitted or archived in the telemetry portal."
            )

    # 3. Automatic Screening
    screening_output = portal_screening_service.screen_submission(
        title=payload.title,
        submission_type=payload.submission_type,
        note=payload.note or "",
        url=canonical_url
    )
    screening_dict = screening_output.model_dump()

    now_iso = datetime.now(timezone.utc).isoformat()
    if current_user.role in settings.AUTO_APPROVE_ROLES:
        status_on_create = "approved"
        reviewed_by = current_user.id
        reviewed_at = now_iso
        review_reason = "Auto-approved for educator/admin role"
    elif screening_output.spam_likelihood >= settings.AUTO_REJECT_SPAM_THRESHOLD:
        status_on_create = "rejected"
        reviewed_by = "system"
        reviewed_at = now_iso
        review_reason = "Automated spam filter threshold exceeded"
    else:
        status_on_create = "pending"
        reviewed_by = None
        reviewed_at = None
        review_reason = None

    section = TYPE_TO_SECTION_MAP.get(payload.submission_type.lower(), "news")
    display_name = "Anonymous Contributor" if settings.PORTAL_ANONYMIZE_COMMUNITY_AUTHORS else current_user.display_name

    submission_dict = {
        "title": payload.title,
        "submission_type": payload.submission_type.lower(),
        "section": section,
        "note": payload.note or "",
        "canonical_url": canonical_url,
        "circuit_qasm": payload.circuit_qasm,
        "circuit_data": payload.circuit_data,
        "author_id": current_user.id,
        "author_display_name": display_name,
        "author_role": current_user.role,
        "status": status_on_create,
        "audience": "public",
        "screening": screening_dict,
        "reviewed_by": reviewed_by,
        "reviewed_at": reviewed_at,
        "review_reason": review_reason
    }

    # 4. Create in DB / memory
    created = await portal_db_service.create_user_submission(submission_dict)

    # Invalidate public cache if auto-approved and broadcast live signal
    if status_on_create == "approved":
        _cache_store.clear()
        try:
            await portal_event_broadcaster.broadcast_signal(created)
        except Exception as b_err:
            pass

    return SubmissionResponse(
        id=str(created["id"]),
        title=created["title"],
        submission_type=created["submission_type"],
        section=created["section"],
        canonical_url=created["canonical_url"],
        note=created.get("note"),
        circuit_qasm=created.get("circuit_qasm"),
        circuit_data=created.get("circuit_data"),
        status=created["status"],
        submitted_at=created.get("submitted_at"),
        reviewed_at=created.get("reviewed_at"),
        review_reason=created.get("review_reason"),
        author_display_name=created["author_display_name"],
        author_role=created["author_role"],
        audience=created.get("audience", "public"),
        created_at=created["created_at"],
        screening=created.get("screening")
    )

@router.get("/submissions/mine", response_model=List[SubmissionResponse])
async def get_my_submissions(
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Returns all signals submitted by the authenticated author across all statuses (pending, approved, rejected, removed).
    """
    user_items = await portal_db_service.get_user_submissions(current_user.id)
    return [
        SubmissionResponse(
            id=str(item["id"]),
            title=item["title"],
            submission_type=item.get("submission_type", "news"),
            section=item.get("section", "news"),
            canonical_url=item.get("canonical_url", ""),
            note=item.get("note"),
            circuit_qasm=item.get("circuit_qasm"),
            circuit_data=item.get("circuit_data"),
            status=item.get("status", "pending"),
            submitted_at=item.get("submitted_at"),
            reviewed_at=item.get("reviewed_at"),
            review_reason=item.get("review_reason"),
            author_display_name=item.get("author_display_name", current_user.display_name),
            author_role=item.get("author_role", current_user.role),
            audience=item.get("audience", "public"),
            created_at=item.get("created_at") or item.get("published_at") or "",
            screening=item.get("screening")
        )
        for item in user_items
    ]

@router.delete("/submissions/{item_id}", status_code=status.HTTP_200_OK)
async def delete_my_submission(
    item_id: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Allows authors to delete their own submissions.
    """
    success = await portal_db_service.delete_user_submission(item_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found or you are not authorized to delete it."
        )

    _cache_store.clear()
    return {"status": "success", "message": "Submission deleted successfully."}

@router.post("/items/{item_id}/report", status_code=status.HTTP_201_CREATED)
async def report_item(
    item_id: str,
    payload: CreateReportRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Submits a moderation report for a content item.
    One open report per user per item with rate limiting.
    """
    # 1. Enforce rate limiting
    rate_limiter.check_rate_limit(
        key=f"rep_min:{current_user.id}",
        max_requests=settings.REPORT_RATE_LIMIT_PER_MINUTE,
        window_seconds=60.0,
        action_name="reports"
    )

    # 2. Check item exists
    item = await portal_db_service.get_portal_item_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content item '{item_id}' not found."
        )

    # 3. Create report
    report = await portal_db_service.create_post_report(
        item_id=item_id,
        reporter_id=current_user.id,
        reason=payload.reason
    )

    return {"status": "success", "message": "Report submitted successfully.", "report_id": report["id"]}

# =========================================================================
# MODERATION QUEUE & REVIEW ACTIONS (Teacher / Admin only)
# =========================================================================

def _verify_moderator(current_user: CurrentUser):
    if current_user.role not in settings.AUTO_APPROVE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to authorized educators and portal administrators."
        )

@router.get("/moderation/queue", response_model=List[ModerationQueueItem])
async def get_moderation_queue(
    status: str = Query("pending", description="Filter by status: pending, reported, rejected, all"),
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Returns items awaiting moderation review for teachers and administrators.
    """
    _verify_moderator(current_user)
    items = await portal_db_service.get_moderation_queue(status=status)
    return [
        ModerationQueueItem(
            id=str(item["id"]),
            title=item["title"],
            submission_type=item.get("submission_type", "news"),
            section=item.get("section", "news"),
            canonical_url=item.get("canonical_url", ""),
            note=item.get("note"),
            circuit_qasm=item.get("circuit_qasm"),
            circuit_data=item.get("circuit_data"),
            status=item.get("status", "pending"),
            author_id=item.get("author_id"),
            author_display_name=item.get("author_display_name", "Anonymous"),
            author_role=item.get("author_role", "student"),
            audience=item.get("audience", "public"),
            submitted_at=item.get("submitted_at"),
            created_at=item.get("created_at") or item.get("published_at") or "",
            screening=item.get("screening"),
            report_count=item.get("report_count", 0),
            reports=item.get("reports", [])
        )
        for item in items
    ]

@router.post("/moderation/{item_id}/approve", status_code=status.HTTP_200_OK)
async def approve_submission(
    item_id: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Approves a pending community submission to make it visible in the public book/feed.
    Reviewers cannot review their own posts.
    """
    _verify_moderator(current_user)
    item = await portal_db_service.get_portal_item_by_id(item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    if str(item.get("author_id")) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reviewers cannot approve their own submissions."
        )

    updated = await portal_db_service.update_moderation_status(
        item_id=item_id,
        new_status="approved",
        reviewer_id=current_user.id,
        review_reason=f"Approved by {current_user.display_name} ({current_user.role})"
    )
    _cache_store.clear()
    try:
        await portal_event_broadcaster.broadcast_signal(updated)
    except Exception as b_err:
        pass
    return {"status": "success", "message": "Submission approved and published.", "item": updated}

@router.post("/moderation/{item_id}/reject", status_code=status.HTTP_200_OK)
async def reject_submission(
    item_id: str,
    payload: ModerationRejectRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Rejects a submission with a required rationale.
    Reviewers cannot review their own posts.
    """
    _verify_moderator(current_user)
    item = await portal_db_service.get_portal_item_by_id(item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    if str(item.get("author_id")) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reviewers cannot reject their own submissions."
        )

    updated = await portal_db_service.update_moderation_status(
        item_id=item_id,
        new_status="rejected",
        reviewer_id=current_user.id,
        review_reason=payload.reason
    )
    _cache_store.clear()
    return {"status": "success", "message": "Submission rejected.", "item": updated}

@router.post("/moderation/{item_id}/remove", status_code=status.HTTP_200_OK)
async def remove_submission(
    item_id: str,
    payload: Optional[ModerationRemoveRequest] = None,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Removes an item from public feeds (soft delete or takedown).
    """
    _verify_moderator(current_user)
    item = await portal_db_service.get_portal_item_by_id(item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found.")

    reason = payload.reason if payload else "Removed by moderator"
    updated = await portal_db_service.update_moderation_status(
        item_id=item_id,
        new_status="removed",
        reviewer_id=current_user.id,
        review_reason=reason
    )
    _cache_store.clear()
    return {"status": "success", "message": "Item removed from public feed.", "item": updated}


# =========================================================================
# INGESTION WORKER & SCHEDULER MANAGEMENT
# =========================================================================

@router.post("/ingest/trigger", status_code=status.HTTP_200_OK)
async def trigger_manual_ingestion(
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Manually triggers an immediate ingestion cycle across all active sources.
    Restricted to educators and administrators.
    """
    _verify_moderator(current_user)
    result = await portal_ingestion_service.run_ingestion_cycle()
    _cache_store.clear()
    return result

@router.get("/ingest/status", status_code=status.HTTP_200_OK)
async def get_ingestion_status(
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Returns the live status, scheduler health, and last execution metrics.
    Restricted to educators and administrators.
    """
    _verify_moderator(current_user)
    return portal_ingestion_service.get_status()

@router.put("/ingest/interval", status_code=status.HTTP_200_OK)
async def update_ingestion_interval(
    minutes: int = Query(..., ge=1, le=1440, description="Ingestion interval in minutes"),
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Updates the background crawler interval dynamically.
    Restricted to educators and administrators.
    """
    _verify_moderator(current_user)
    portal_ingestion_service.update_scheduler_interval(minutes)
    return {
        "status": "success",
        "message": f"Ingestion interval updated to {minutes} minutes.",
        "status_info": portal_ingestion_service.get_status()
    }


# =========================================================================
# LIVE QPU HARDWARE TELEMETRY & CLOUD ACCELERATOR STATUS
# =========================================================================

@router.get("/hardware/telemetry", response_model=HardwareTelemetryResponse)
async def get_hardware_telemetry():
    """
    Returns live calibration metrics, coherence times (T1/T2), error rates,
    and topology coupling maps for active QPUs (IBM, NVIDIA, Rigetti, IonQ).
    """
    return portal_hardware_service.get_hardware_telemetry()

@router.get("/hardware/status", response_model=HardwareStatusSummary)
async def get_hardware_status():
    """
    Returns high-level system status and online hardware summary.
    """
    return portal_hardware_service.get_hardware_status()


# =========================================================================
# CROSS-QPU BENCHMARKING & REAL-TIME PERFORMANCE MATRIX
# =========================================================================

@router.get("/benchmark/presets", response_model=List[BenchmarkPreset])
async def get_benchmark_algorithm_presets():
    """
    Returns canonical quantum algorithm benchmark presets (Grover, QFT, BV, QAOA).
    """
    return get_benchmark_presets()

@router.post("/benchmark/compare", response_model=BenchmarkComparisonResponse)
async def compare_circuit_performance(
    payload: Optional[BenchmarkComparisonRequest] = None
):
    """
    Simulates transpilation depth expansion, basis gate decomposition,
    and predicted circuit execution fidelity across active QPUs (IBM, NVIDIA, Rigetti, IonQ).
    """
    preset_id = payload.preset_id if payload else None
    custom_qasm = payload.custom_qasm if payload else None
    return compare_circuit_across_qpus(preset_id=preset_id, custom_qasm=custom_qasm)


# =========================================================================
# COMMUNITY PORTAL ANALYTICS & RESEARCH TOPIC CLUSTERS
# =========================================================================

@router.get("/analytics/overview", response_model=AnalyticsOverviewResponse)
async def get_portal_analytics_overview():
    """
    Returns aggregate research signal ingestion metrics, curriculum tag frequency distributions,
    section breakdowns, and overall quantum benchmark fidelity metrics.
    """
    return await portal_analytics_service.get_overview_metrics()

@router.get("/analytics/clusters", response_model=TopicClustersResponse)
async def get_portal_topic_clusters():
    """
    Returns semantic research topic cluster nodes and co-occurrence graph edges
    based on keyword matching across curated community signals.
    """
    return await portal_analytics_service.get_topic_clusters()


# =========================================================================
# MARIO QUANTUM AI — PREPRINT EXPLAINER & CONCEPT MAP GENERATOR
# =========================================================================

@router.post("/explain", response_model=ExplainResponse)
async def explain_quantum_paper(
    payload: Optional[ExplainRequest] = None
):
    """
    Generates multi-tier explanations (Beginner, Undergrad, Practitioner)
    and mathematical concept dependency maps powered by Mario Quantum AI.
    """
    req = payload or ExplainRequest()
    return await mario_portal_explainer_service.generate_explanation(req)


# =========================================================================
# BATCH SIGNAL INGESTION & SYNDICATION FEEDS (RSS & BIBTEX)
# =========================================================================

@router.post("/ingest/batch-import", response_model=BatchImportResponse)
async def batch_import_portal_signals(
    payload: BatchImportRequest,
    current_user: Optional[CurrentUser] = Depends(get_current_user)
):
    """
    Batch imports signals from raw BibTeX entries or JSON items with automated
    title deduplication, metadata parsing, and screening.
    """
    actor_id = current_user.id if current_user else "usr-batch-importer"
    return await portal_importer_service.batch_import_signals(payload, actor_id=actor_id)

@router.get("/export/rss")
async def export_portal_rss_feed():
    """
    Returns standard RSS 2.0 XML feed of curated community quantum signals.
    """
    xml_content = await portal_importer_service.generate_rss_feed_xml()
    return Response(content=xml_content, media_type="application/rss+xml")

@router.get("/export/bibtex")
async def export_portal_bibtex_catalog():
    """
    Returns comprehensive BibTeX catalog of curated community quantum signals.
    """
    bibtex_content = await portal_importer_service.generate_bibtex_catalog()
    return Response(content=bibtex_content, media_type="text/plain; charset=utf-8")


# =========================================================================
# REAL-TIME QUANTUM COLLABORATION ROOMS & LIVE CO-ANNOTATION (PHASE 12)
# =========================================================================

@router.post("/rooms/{item_id}/join", response_model=JoinRoomResponse)
async def join_collaboration_room(
    item_id: str,
    payload: Optional[JoinRoomRequest] = None,
    current_user: Optional[CurrentUser] = Depends(get_current_user)
):
    """
    Joins or initializes a live collaborative co-annotation room for a quantum signal.
    """
    req = payload or JoinRoomRequest()
    if current_user:
        req.user_id = current_user.id
        req.user_role = current_user.role
    return await portal_collaboration_service.join_room(item_id, req)

@router.get("/rooms/{item_id}/annotations", response_model=List[SignalAnnotation])
async def get_room_annotations(item_id: str):
    """
    Returns all shared co-annotations and sticky notes for a specific quantum signal.
    """
    return await portal_collaboration_service.get_annotations(item_id)

@router.post("/rooms/{item_id}/annotations", response_model=SignalAnnotation)
async def create_room_annotation(
    item_id: str,
    payload: CreateAnnotationRequest,
    current_user: Optional[CurrentUser] = Depends(get_current_user)
):
    """
    Creates a new paragraph-level or equation-level sticky co-annotation.
    """
    user_id = current_user.id if current_user else "usr-contributor"
    user_name = "Prof. Ram" if current_user and current_user.role == "teacher" else "Quantum Contributor"
    user_role = current_user.role if current_user else "researcher"
    payload.item_id = item_id
    return await portal_collaboration_service.add_annotation(
        payload, user_id=user_id, user_name=user_name, user_role=user_role
    )

@router.delete("/rooms/{item_id}/annotations/{annotation_id}")
async def delete_room_annotation(
    item_id: str,
    annotation_id: str,
    current_user: Optional[CurrentUser] = Depends(get_current_user)
):
    """
    Deletes an annotation by ID.
    """
    success = await portal_collaboration_service.delete_annotation(item_id, annotation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Annotation not found")
    return {"status": "success", "message": "Annotation deleted successfully"}

@router.post("/rooms/{item_id}/chat", response_model=RoomChatMessage)
async def post_room_chat_message(
    item_id: str,
    payload: PostChatMessageRequest,
    current_user: Optional[CurrentUser] = Depends(get_current_user)
):
    """
    Posts a real-time message to the preprint discussion thought stream.
    """
    user_id = current_user.id if current_user else "usr-contributor"
    user_name = "Prof. Ram" if current_user and current_user.role == "teacher" else "Quantum Contributor"
    user_role = current_user.role if current_user else "researcher"
    payload.item_id = item_id
    return await portal_collaboration_service.post_chat_message(
        payload, user_id=user_id, user_name=user_name, user_role=user_role
    )


# =========================================================================
# QUANTUM HARDWARE PULSE-LEVEL CALIBRATION VISUALIZER (PHASE 13)
# =========================================================================

@router.get("/hardware/pulses/presets", response_model=List[PulsePreset])
async def get_hardware_pulse_presets():
    """
    Returns calibrated RF/microwave pulse shape presets across IBM Heron, Rigetti Ankaa, and IonQ Forte.
    """
    return portal_pulse_service.get_presets()

@router.post("/hardware/pulses/simulate", response_model=PulseSimulateResponse)
async def simulate_hardware_pulse(
    payload: Optional[PulseSimulateRequest] = None
):
    """
    Simulates time-domain In-phase I(t) / Quadrature Q(t) waveform samples,
    FFT power spectral density, and DRAG transmon leakage suppression ratio.
    """
    req = payload or PulseSimulateRequest()
    return portal_pulse_service.simulate_pulse(req)


# =========================================================================
# TEACHER PORTAL MANAGEMENT ENDPOINTS (SUPABASE & LIVE BACKEND DATA)
# =========================================================================

@router.get("/teacher/overview")
async def get_teacher_overview():
    """Returns live teacher overview metrics."""
    pool = await portal_db_service.get_db_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow("SELECT active_courses, students, completion_rate, challenges, certificates, circuits_run FROM public.teacher_overview LIMIT 1")
                if row and row["students"] > 0:
                    return {
                        "activeCourses": row["active_courses"],
                        "students": row["students"],
                        "completionRate": row["completion_rate"],
                        "challenges": row["challenges"],
                        "certificates": row["certificates"],
                        "circuitsRun": int(row["circuits_run"])
                    }
                # If no row or 0 students in teacher_overview, compute count dynamically from students/courses
                c_count = await conn.fetchval("SELECT COUNT(*) FROM public.courses") or 0
                s_count = await conn.fetchval("SELECT COUNT(*) FROM public.students") or 0
                ch_count = await conn.fetchval("SELECT COUNT(*) FROM public.challenges") or 0
                cert_count = await conn.fetchval("SELECT COUNT(*) FROM public.certificates") or 0
                circ_count = await conn.fetchval("SELECT COUNT(*) FROM public.circuits") or 0
                return {
                    "activeCourses": c_count,
                    "students": s_count,
                    "completionRate": "0%" if s_count == 0 else f"{min(100, round((cert_count / max(1, s_count)) * 100))}%",
                    "challenges": ch_count,
                    "certificates": cert_count,
                    "circuitsRun": circ_count
                }
        except Exception as e:
            logger.warning(f"DB query for teacher overview failed: {e}")
    return {
        "activeCourses": 0,
        "students": 0,
        "completionRate": "0%",
        "challenges": 0,
        "certificates": 0,
        "circuitsRun": 0
    }

@router.get("/teacher/students")
async def get_teacher_students():
    """Returns live list of students from database/Supabase."""
    pool = await portal_db_service.get_db_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch("SELECT id, name, email, avatar, course, accuracy, circuits_run, challenges_completed, status, last_active, misconception_risk, notes FROM public.students ORDER BY created_at DESC")
                if rows:
                    return [
                        {
                            "id": str(r["id"]),
                            "name": r["name"],
                            "email": r["email"],
                            "avatar": r["avatar"],
                            "course": r["course"],
                            "accuracy": float(r["accuracy"]),
                            "circuitsRun": r["circuits_run"],
                            "challengesCompleted": r["challenges_completed"],
                            "status": r["status"],
                            "lastActive": r["last_active"],
                            "misconceptionRisk": r["misconception_risk"],
                            "notes": r["notes"]
                        } for r in rows
                    ]
        except Exception as e:
            logger.warning(f"DB query for students failed: {e}")
    return []









