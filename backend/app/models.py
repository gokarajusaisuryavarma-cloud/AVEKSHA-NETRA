from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
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