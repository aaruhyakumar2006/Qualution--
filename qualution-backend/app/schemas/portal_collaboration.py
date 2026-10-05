from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class CollaborationUser(BaseModel):
    user_id: str
    user_name: str
    role: str = "researcher"  # "teacher", "student", "researcher", "qpu_engineer"
    avatar_color: str = "#6366F1"
    active_section: Optional[str] = None
    joined_at: str

class SignalAnnotation(BaseModel):
    id: str
    item_id: str
    user_id: str
    user_name: str
    user_role: str = "researcher"
    selected_text: str
    paragraph_ref: str = "Abstract / Core Method"
    comment: str
    tag: str = "discussion"  # "qec", "hardware", "math", "pedagogy", "question", "breakthrough"
    color: str = "#F59E0B"
    created_at: str
    likes_count: int = 0

class RoomChatMessage(BaseModel):
    id: str
    item_id: str
    user_id: str
    user_name: str
    user_role: str = "researcher"
    message: str
    timestamp: str

class JoinRoomRequest(BaseModel):
    user_id: Optional[str] = "usr-current"
    user_name: Optional[str] = "Prof. Quantum"
    user_role: Optional[str] = "educator"

class JoinRoomResponse(BaseModel):
    room_id: str
    item_id: str
    paper_title: str
    active_participants: List[CollaborationUser] = Field(default_factory=list)
    annotations: List[SignalAnnotation] = Field(default_factory=list)
    recent_messages: List[RoomChatMessage] = Field(default_factory=list)

class CreateAnnotationRequest(BaseModel):
    item_id: str
    selected_text: str
    paragraph_ref: Optional[str] = "Section 2.1 Hamiltonian Formulation"
    comment: str
    tag: Optional[str] = "breakthrough"
    color: Optional[str] = "#10B981"

class PostChatMessageRequest(BaseModel):
    item_id: str
    message: str
