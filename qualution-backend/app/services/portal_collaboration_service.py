import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional
from app.schemas.portal_collaboration import (
    CollaborationUser,
    SignalAnnotation,
    RoomChatMessage,
    JoinRoomRequest,
    JoinRoomResponse,
    CreateAnnotationRequest,
    PostChatMessageRequest
)

class PortalCollaborationService:
    def __init__(self):
        # Key: item_id -> List[SignalAnnotation]
        self._annotations_store: Dict[str, List[SignalAnnotation]] = {}
        # Key: item_id -> List[RoomChatMessage]
        self._chat_store: Dict[str, List[RoomChatMessage]] = {}
        # Key: item_id -> Dict[user_id, CollaborationUser]
        self._active_users: Dict[str, Dict[str, CollaborationUser]] = {}

        self._seed_default_rooms()

    def _seed_default_rooms(self):
        default_item_id = "paper-surface-code-123"
        now_str = datetime.now(timezone.utc).isoformat()

        self._annotations_store[default_item_id] = [
            SignalAnnotation(
                id="ann-seed-1",
                item_id=default_item_id,
                user_id="usr-teacher-prof-ram",
                user_name="Prof. Ram",
                user_role="educator",
                selected_text="Syndrome extraction circuits operate with < 0.12% 2-qubit gate error rates",
                paragraph_ref="Section 3.2 Physical Threshold Bounds",
                comment="Critical experimental breakthrough: this places heavy-hex below the planar surface code fault-tolerance threshold.",
                tag="breakthrough",
                color="#10B981",
                created_at=now_str,
                likes_count=14
            ),
            SignalAnnotation(
                id="ann-seed-2",
                item_id=default_item_id,
                user_id="usr-researcher-alice",
                user_name="Dr. Alice Chen",
                user_role="qpu_engineer",
                selected_text="DRAG coefficient beta = 0.32 eliminates transmon leakage into state |2>",
                paragraph_ref="Section 4.1 Pulse Calibration Protocol",
                comment="Notice the pulse envelope shaping here avoids the higher transmon anharmonicity trap.",
                tag="hardware",
                color="#6366F1",
                created_at=now_str,
                likes_count=9
            ),
            SignalAnnotation(
                id="ann-seed-3",
                item_id=default_item_id,
                user_id="usr-student-alex",
                user_name="Alex (Quantum Graduate)",
                user_role="student",
                selected_text="Stabilizer measurement sequence: X-type and Z-type interleaved",
                paragraph_ref="Equation (7) Syndrome Commutation",
                comment="Can we verify this in the QUALUTION Workbench simulator with noisy depolarizing channel?",
                tag="question",
                color="#F59E0B",
                created_at=now_str,
                likes_count=5
            )
        ]

        self._chat_store[default_item_id] = [
            RoomChatMessage(
                id="msg-seed-1",
                item_id=default_item_id,
                user_id="usr-teacher-prof-ram",
                user_name="Prof. Ram",
                user_role="educator",
                message="Welcome everyone to the collaborative review room for this Heavy-Hex QEC paper! Check out the sticky notes in Section 3.",
                timestamp=now_str
            ),
            RoomChatMessage(
                id="msg-seed-2",
                item_id=default_item_id,
                user_id="usr-researcher-alice",
                user_name="Dr. Alice Chen",
                user_role="qpu_engineer",
                message="I verified their pulse shaping calibration. Matches our Heron QPU test benchmarks perfectly.",
                timestamp=now_str
            )
        ]

        self._active_users[default_item_id] = {
            "usr-teacher-prof-ram": CollaborationUser(
                user_id="usr-teacher-prof-ram",
                user_name="Prof. Ram",
                role="educator",
                avatar_color="#10B981",
                active_section="Section 3.2",
                joined_at=now_str
            ),
            "usr-researcher-alice": CollaborationUser(
                user_id="usr-researcher-alice",
                user_name="Dr. Alice Chen",
                role="qpu_engineer",
                avatar_color="#6366F1",
                active_section="Section 4.1",
                joined_at=now_str
            )
        }

    async def join_room(self, item_id: str, req: JoinRoomRequest) -> JoinRoomResponse:
        now_str = datetime.now(timezone.utc).isoformat()
        if item_id not in self._annotations_store:
            self._annotations_store[item_id] = []
        if item_id not in self._chat_store:
            self._chat_store[item_id] = []
        if item_id not in self._active_users:
            self._active_users[item_id] = {}

        user_id = req.user_id or f"usr-anon-{uuid.uuid4().hex[:6]}"
        user_name = req.user_name or "Quantum Researcher"
        user_role = req.user_role or "researcher"

        self._active_users[item_id][user_id] = CollaborationUser(
            user_id=user_id,
            user_name=user_name,
            role=user_role,
            avatar_color="#EC4899" if user_role == "student" else "#6366F1",
            active_section="Live Feed",
            joined_at=now_str
        )

        return JoinRoomResponse(
            room_id=f"room-{item_id}",
            item_id=item_id,
            paper_title="Interactive Quantum Review Room",
            active_participants=list(self._active_users[item_id].values()),
            annotations=self._annotations_store.get(item_id, []),
            recent_messages=self._chat_store.get(item_id, [])[-30:]
        )

    async def add_annotation(
        self,
        req: CreateAnnotationRequest,
        user_id: str = "usr-current",
        user_name: str = "Quantum Contributor",
        user_role: str = "researcher"
    ) -> SignalAnnotation:
        now_str = datetime.now(timezone.utc).isoformat()
        if req.item_id not in self._annotations_store:
            self._annotations_store[req.item_id] = []

        new_ann = SignalAnnotation(
            id=f"ann-{uuid.uuid4().hex[:8]}",
            item_id=req.item_id,
            user_id=user_id,
            user_name=user_name,
            user_role=user_role,
            selected_text=req.selected_text,
            paragraph_ref=req.paragraph_ref or "Section 1",
            comment=req.comment,
            tag=req.tag or "discussion",
            color=req.color or "#10B981",
            created_at=now_str,
            likes_count=0
        )
        self._annotations_store[req.item_id].insert(0, new_ann)
        return new_ann

    async def get_annotations(self, item_id: str) -> List[SignalAnnotation]:
        return self._annotations_store.get(item_id, [])

    async def delete_annotation(self, item_id: str, annotation_id: str) -> bool:
        if item_id in self._annotations_store:
            initial_len = len(self._annotations_store[item_id])
            self._annotations_store[item_id] = [
                a for a in self._annotations_store[item_id] if a.id != annotation_id
            ]
            return len(self._annotations_store[item_id]) < initial_len
        return False

    async def post_chat_message(
        self,
        req: PostChatMessageRequest,
        user_id: str = "usr-current",
        user_name: str = "Quantum Contributor",
        user_role: str = "researcher"
    ) -> RoomChatMessage:
        now_str = datetime.now(timezone.utc).isoformat()
        if req.item_id not in self._chat_store:
            self._chat_store[req.item_id] = []

        new_msg = RoomChatMessage(
            id=f"msg-{uuid.uuid4().hex[:8]}",
            item_id=req.item_id,
            user_id=user_id,
            user_name=user_name,
            user_role=user_role,
            message=req.message,
            timestamp=now_str
        )
        self._chat_store[req.item_id].append(new_msg)
        return new_msg

portal_collaboration_service = PortalCollaborationService()
