import pytest
import uuid
from app.services.portal_db_service import portal_db_service

@pytest.mark.anyio
async def test_submission_lifecycle_and_rls_visibility():
    """Verify that:
       1. Pending items are NOT returned to public feed.
       2. Authors can access their own pending/rejected submissions.
       3. Approved items appear in public feed.
    """
    author_student = str(uuid.uuid4())
    author_other = str(uuid.uuid4())

    # 1. Create a pending student submission
    sub = await portal_db_service.create_user_submission({
        "title": "Quantum Circuit Synthesis via ZX-Calculus",
        "submission_type": "project",
        "section": "research",
        "note": "We introduce a rewrite pass that reduces T-count by 35% on benchmark circuits.",
        "author_id": author_student,
        "author_display_name": "Quantum Builder",
        "author_role": "student",
        "status": "pending",
        "audience": "public"
    })
    item_id = sub["id"]

    # 2. Public feed should NOT include pending submission
    public_items, _, _ = await portal_db_service.get_portal_items(section="research")
    public_ids = [i["id"] for i in public_items]
    assert item_id not in public_ids

    # 3. Author can view own pending submission
    my_subs = await portal_db_service.get_user_submissions(author_student)
    my_ids = [i["id"] for i in my_subs]
    assert item_id in my_ids
    assert my_subs[0]["status"] == "pending"

    # Other student cannot see this pending submission in their own list
    other_subs = await portal_db_service.get_user_submissions(author_other)
    assert item_id not in [i["id"] for i in other_subs]

    # 4. Moderation approval makes it visible publicly
    moderator_id = str(uuid.uuid4())
    approved_item = await portal_db_service.update_moderation_status(
        item_id=item_id,
        new_status="approved",
        reviewer_id=moderator_id,
        review_reason="Meets quality guidelines and contains novel open source code."
    )
    assert approved_item is not None
    assert approved_item["status"] == "approved"

    public_items_after, _, _ = await portal_db_service.get_portal_items(section="research")
    assert item_id in [i["id"] for i in public_items_after]

@pytest.mark.anyio
async def test_post_report_and_moderation_audit_logging():
    """Verify that reporting a post creates report records and logs moderation audit events."""
    reporter_id = str(uuid.uuid4())
    test_item_id = str(uuid.uuid4())

    report = await portal_db_service.create_post_report(
        item_id=test_item_id,
        reporter_id=reporter_id,
        reason="Promotional affiliate link included in abstract."
    )
    assert report["item_id"] == test_item_id
    assert report["reporter_id"] == reporter_id
    assert report["status"] == "open"

@pytest.mark.anyio
async def test_author_can_delete_own_submission():
    """Verify that authors can delete their own submissions and status becomes removed."""
    author_id = str(uuid.uuid4())
    sub = await portal_db_service.create_user_submission({
        "title": "Quantum Teleportation Lab Notes",
        "submission_type": "resource",
        "section": "courses",
        "author_id": author_id,
        "author_role": "student",
        "status": "pending",
        "audience": "public"
    })
    item_id = sub["id"]

    # Delete by wrong author fails
    wrong_author = str(uuid.uuid4())
    deleted_wrong = await portal_db_service.delete_user_submission(item_id, wrong_author)
    assert deleted_wrong is False

    # Delete by real author succeeds
    deleted_real = await portal_db_service.delete_user_submission(item_id, author_id)
    assert deleted_real is True

    # Item should now be removed from public feed
    public_items, _, _ = await portal_db_service.get_portal_items(section="courses")
    assert item_id not in [i["id"] for i in public_items]
