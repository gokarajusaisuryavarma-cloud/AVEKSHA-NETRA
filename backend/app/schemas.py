from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel


# ==================================================
# CAMERA CREATE
# ==================================================

class CameraCreate(BaseModel):

    name: str
    location: str
    rtsp_url: str
    source_type: str = "RTSP"


# ==================================================
# CAMERA RESPONSE
# ==================================================

class CameraResponse(BaseModel):

    id: int
    name: str
    location: str
    rtsp_url: str
    source_type: str
    is_active: bool

    class Config:
        from_attributes = True


# ==================================================
# USER REGISTRATION
# ==================================================

class UserCreate(BaseModel):

    username: str
    password: str


# ==================================================
# USER RESPONSE
# ==================================================

class UserResponse(BaseModel):

    id: int
    username: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


# ==================================================
# USER LOGIN
# ==================================================

class UserLogin(BaseModel):

    username: str
    password: str


# ==================================================
# KNOWN FACE SCHEMAS
# ==================================================

class KnownFaceCreate(BaseModel):

    name: str
    role: str = "Staff"
    department: str = "General"
    image_base64: Optional[str] = None
    embedding: Optional[str] = None
    notes: Optional[str] = None


class KnownFaceResponse(BaseModel):

    id: int
    name: str
    role: str
    department: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================================================
# PLATE WATCHLIST SCHEMAS
# ==================================================

class PlateWatchlistCreate(BaseModel):

    plate_number: str
    category: str = "SUSPICIOUS"  # ALLOWED, SUSPICIOUS, STOLEN, RESTRICTED
    vehicle_description: Optional[str] = None
    owner_name: Optional[str] = None
    notes: Optional[str] = None


class PlateWatchlistResponse(BaseModel):

    id: int
    plate_number: str
    category: str
    vehicle_description: Optional[str] = None
    owner_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================================================
# CAMERA ZONE SCHEMAS
# ==================================================

class CameraZoneCreate(BaseModel):

    camera_id: int
    name: str
    zone_type: str = "RESTRICTED"
    polygon_points: str  # JSON string
    alert_severity: str = "HIGH"
    is_active: bool = True


class CameraZoneResponse(BaseModel):

    id: int
    camera_id: int
    name: str
    zone_type: str
    polygon_points: str
    alert_severity: str
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================================================
# SUSPICIOUS RULE SCHEMAS
# ==================================================

class SuspiciousRuleCreate(BaseModel):

    camera_id: Optional[int] = None
    rule_type: str
    threshold_seconds: int = 30
    is_active: bool = True


class SuspiciousRuleResponse(BaseModel):

    id: int
    camera_id: Optional[int] = None
    rule_type: str
    threshold_seconds: int
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================================================
# NIGHT SCHEDULE SCHEMAS
# ==================================================

class NightScheduleCreate(BaseModel):

    camera_id: Optional[int] = None
    start_time: str = "20:00"
    end_time: str = "06:00"
    luminance_threshold: float = 65.0
    is_active: bool = True


class NightScheduleResponse(BaseModel):

    id: int
    camera_id: Optional[int] = None
    start_time: str
    end_time: str
    luminance_threshold: float
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================================================
# ALERT SCHEMAS
# ==================================================

class AlertResponse(BaseModel):

    id: int
    camera_id: int
    alert_type: str
    object_type: str
    track_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    cleared_at: Optional[datetime] = None

    class Config:
        from_attributes = True