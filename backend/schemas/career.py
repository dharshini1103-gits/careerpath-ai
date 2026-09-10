from pydantic import BaseModel
from typing import Optional


class CareerProfileRequest(BaseModel):
    target_role: Optional[str] = None
    experience_level: Optional[str] = None
    skills: Optional[str] = None
    education: Optional[str] = None
    projects: Optional[str] = None


class CareerProfileResponse(BaseModel):
    id: int
    user_id: int
    target_role: Optional[str] = None
    experience_level: Optional[str] = None
    skills: Optional[str] = None
    education: Optional[str] = None
    projects: Optional[str] = None

    class Config:
        from_attributes = True