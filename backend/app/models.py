from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, JSON
from sqlalchemy.sql import func

from app.database import Base


# ============================================================
# CAMERA MODEL
# ============================================================

class Camera(Base):

    __tablename__ = "cameras"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(100),
        nullable=False
    )

    location = Column(
        String(200),
        nullable=False
    )

    rtsp_url = Column(
        String(500),
        nullable=False
    )

    source_type = Column(
        String(20),
        default="RTSP"
    )

    is_active = Column(
        Boolean,
        default=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


# ============================================================
# USER MODEL
# ============================================================

class User(Base):

    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    username = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    role = Column(
        String(50),
        default="OPERATOR",
        nullable=False
    )

    is_active = Column(
        Boolean,
        default=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


# ============================================================
# ALERT MODEL
# ============================================================

class Alert(Base):

    __tablename__ = "alerts"

    # --------------------------------------------------------
    # PRIMARY KEY
    # --------------------------------------------------------

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # --------------------------------------------------------
    # CAMERA
    # --------------------------------------------------------

    camera_id = Column(
        Integer,
        nullable=False,
        index=True
    )

    # --------------------------------------------------------
    # ALERT TYPE
    #
    # Examples:
    # HUMAN_DETECTED
    # VEHICLE_DETECTED
    # MOTORCYCLE_DETECTED
    # BICYCLE_DETECTED
    # --------------------------------------------------------

    alert_type = Column(
        String(50),
        nullable=False,
        index=True
    )

    # --------------------------------------------------------
    # OBJECT TYPE
    #
    # person
    # car
    # motorcycle
    # bicycle
    # etc.
    # --------------------------------------------------------

    object_type = Column(
        String(50),
        nullable=False,
        index=True
    )

    # --------------------------------------------------------
    # TRACK ID
    # --------------------------------------------------------

    track_id = Column(
        Integer,
        nullable=True
    )

    # --------------------------------------------------------
    # ALERT TITLE
    # --------------------------------------------------------

    title = Column(
        String(150),
        nullable=False
    )

    # --------------------------------------------------------
    # ALERT DESCRIPTION
    # --------------------------------------------------------

    description = Column(
        Text,
        nullable=True
    )

    # --------------------------------------------------------
    # ALERT STATUS
    #
    # ACTIVE
    # CLEARED
    # --------------------------------------------------------

    status = Column(
        String(20),
        default="ACTIVE",
        nullable=False,
        index=True
    )

    # --------------------------------------------------------
    # CREATED TIME
    # --------------------------------------------------------

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )

    # --------------------------------------------------------
    # EXPIRY TIME
    #
    # Alert automatically becomes CLEARED
    # after 3 hours.
    # --------------------------------------------------------

    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )

    # --------------------------------------------------------
    # CLEARED TIME
    # --------------------------------------------------------

    cleared_at = Column(
        DateTime(timezone=True),
        nullable=True
    )


# ============================================================
# KNOWN FACE MODEL (Face Recognition)
# ============================================================

class KnownFace(Base):

    __tablename__ = "known_faces"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(100),
        nullable=False,
        index=True
    )

    role = Column(
        String(100),
        default="Staff",
        nullable=False
    )

    department = Column(
        String(100),
        default="General"
    )

    # Serialized 128-D embedding vector (JSON list of floats)
    embedding = Column(
        Text,
        nullable=False
    )

    notes = Column(
        Text,
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


# ============================================================
# PLATE WATCHLIST MODEL (ANPR)
# ============================================================

class PlateWatchlist(Base):

    __tablename__ = "plate_watchlists"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    plate_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )

    # ALLOWED, SUSPICIOUS, STOLEN, RESTRICTED
    category = Column(
        String(50),
        default="SUSPICIOUS",
        nullable=False,
        index=True
    )

    vehicle_description = Column(
        String(200),
        nullable=True
    )

    owner_name = Column(
        String(100),
        nullable=True
    )

    notes = Column(
        Text,
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


# ============================================================
# CAMERA ZONE MODEL (Virtual-Fence Intrusion Detection)
# ============================================================

class CameraZone(Base):

    __tablename__ = "camera_zones"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    camera_id = Column(
        Integer,
        nullable=False,
        index=True
    )

    name = Column(
        String(100),
        nullable=False
    )

    # RESTRICTED, VIRTUAL_FENCE, NO_ENTRY
    zone_type = Column(
        String(50),
        default="RESTRICTED",
        nullable=False
    )

    # JSON list of [[x1, y1], [x2, y2], ...] normalized coords [0.0, 1.0]
    polygon_points = Column(
        Text,
        nullable=False
    )

    # HIGH, CRITICAL
    alert_severity = Column(
        String(20),
        default="HIGH",
        nullable=False
    )

    is_active = Column(
        Boolean,
        default=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


# ============================================================
# SUSPICIOUS RULE MODEL (Loitering, Stationary, Crowd)
# ============================================================

class SuspiciousRule(Base):

    __tablename__ = "suspicious_rules"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    camera_id = Column(
        Integer,
        nullable=True,
        index=True
    )

    # LOITERING, STATIONARY, CROWD_GATHERING
    rule_type = Column(
        String(50),
        nullable=False
    )

    threshold_seconds = Column(
        Integer,
        default=30
    )

    is_active = Column(
        Boolean,
        default=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


# ============================================================
# NIGHT SCHEDULE MODEL (Night-Time Movement Detection)
# ============================================================

class NightSchedule(Base):

    __tablename__ = "night_schedules"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    camera_id = Column(
        Integer,
        nullable=True,
        index=True
    )

    start_time = Column(
        String(10),
        default="20:00"
    )

    end_time = Column(
        String(10),
        default="06:00"
    )

    # Luminance threshold (0 - 255 grayscale average)
    luminance_threshold = Column(
        Float,
        default=65.0
    )

    is_active = Column(
        Boolean,
        default=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )