import os
import cv2
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import Base, engine, SessionLocal
from app import models

from app.schemas import (
    CameraCreate,
    CameraResponse,
    UserCreate,
    UserResponse,
    UserLogin,
)

from app.video import generate_video_stream

from ai.ai_services import (
    start_camera_ai,
    stop_camera_ai,
    remove_camera_ai,
    get_camera_ai,
    get_all_ai_status,
    get_camera_events,
    get_camera_tracks,
    get_active_event_count,
    get_total_event_count,
    stop_all_ai,
)

from ai.alert_manager import (
    get_alerts,
    get_active_alerts,
    get_alert_count,
    get_active_alert_count,
    get_human_alert_count,
    get_vehicle_alert_count,
    get_alert_summary,
)


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="AVEKSHA NETRA",
    description="AI-Based Intelligent Video Analytics Platform",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",

        "https://avekshanetra.in",
        "https://www.avekshanetra.in",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# JWT CONFIGURATION
# ============================================================

SECRET_KEY = "AVEKSHA_NETRA_CHANGE_THIS_SECRET_KEY"

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60


# ============================================================
# DATABASE TABLE CREATION
# ============================================================

Base.metadata.create_all(bind=engine)


# ============================================================
# DATABASE SESSION
# ============================================================

def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health_check():

    return {
        "status": "ok",
        "service": "AVEKSHA NETRA",
        "message": "Backend is alive",
    }


# ============================================================
# DATABASE TEST
# ============================================================

@app.get("/api/database-test")
def database_test():

    try:

        with engine.connect() as connection:

            connection.execute(
                text("SELECT 1")
            )

        return {
            "status": "ok",
            "database": "connected",
            "message": "PostgreSQL is connected",
        }

    except Exception as error:

        return {
            "status": "error",
            "database": "disconnected",
            "message": str(error),
        }


# ============================================================
# CAMERA MANAGEMENT
# ============================================================


# ============================================================
# GET ALL CAMERAS
# ============================================================

@app.get(
    "/api/cameras",
    response_model=list[CameraResponse],
)
def get_cameras(
    db: Session = Depends(get_db),
):

    cameras = (
        db.query(models.Camera)
        .order_by(models.Camera.id.asc())
        .all()
    )

    return cameras


# ============================================================
# GET SINGLE CAMERA
# ============================================================

@app.get(
    "/api/cameras/{camera_id}",
    response_model=CameraResponse,
)
def get_camera(
    camera_id: int,
    db: Session = Depends(get_db),
):

    camera = (
        db.query(models.Camera)
        .filter(
            models.Camera.id == camera_id
        )
        .first()
    )

    if not camera:

        raise HTTPException(
            status_code=404,
            detail="Camera not found",
        )

    return camera


# ============================================================
# ADD CAMERA
# ============================================================

@app.post(
    "/api/cameras",
    response_model=CameraResponse,
)
def create_camera(
    camera: CameraCreate,
    db: Session = Depends(get_db),
):

    camera_name = camera.name.strip()
    camera_location = camera.location.strip()
    rtsp_url = camera.rtsp_url.strip()

    if not camera_name:

        raise HTTPException(
            status_code=400,
            detail="Camera name cannot be empty",
        )

    if not camera_location:

        raise HTTPException(
            status_code=400,
            detail="Camera location cannot be empty",
        )

    if not rtsp_url:

        raise HTTPException(
            status_code=400,
            detail="Camera URL cannot be empty",
        )

    new_camera = models.Camera(
        name=camera_name,
        location=camera_location,
        rtsp_url=rtsp_url,
        source_type="RTSP",
        is_active=True,
    )

    db.add(new_camera)

    db.commit()

    db.refresh(new_camera)

    print()
    print("📷 CAMERA ADDED")
    print(f"   ID: {new_camera.id}")
    print(f"   Name: {new_camera.name}")
    print(f"   Location: {new_camera.location}")

    return new_camera


# ============================================================
# UPDATE CAMERA
# ============================================================

@app.put(
    "/api/cameras/{camera_id}",
    response_model=CameraResponse,
)
def update_camera(
    camera_id: int,
    camera: CameraCreate,
    db: Session = Depends(get_db),
):

    existing_camera = (
        db.query(models.Camera)
        .filter(
            models.Camera.id == camera_id
        )
        .first()
    )

    if not existing_camera:

        raise HTTPException(
            status_code=404,
            detail="Camera not found",
        )

    camera_name = camera.name.strip()
    camera_location = camera.location.strip()
    rtsp_url = camera.rtsp_url.strip()

    if not camera_name:

        raise HTTPException(
            status_code=400,
            detail="Camera name cannot be empty",
        )

    if not camera_location:

        raise HTTPException(
            status_code=400,
            detail="Camera location cannot be empty",
        )

    if not rtsp_url:

        raise HTTPException(
            status_code=400,
            detail="Camera URL cannot be empty",
        )

    # Stop running AI before changing camera source

    try:

        stop_camera_ai(camera_id)

    except Exception as error:

        print(
            f"⚠️ AI stop error during update: {error}"
        )

    existing_camera.name = camera_name
    existing_camera.location = camera_location
    existing_camera.rtsp_url = rtsp_url

    db.commit()

    db.refresh(existing_camera)

    print()
    print("✏️ CAMERA UPDATED")
    print(f"   ID: {existing_camera.id}")
    print(f"   Name: {existing_camera.name}")

    return existing_camera


# ============================================================
# DELETE CAMERA
# ============================================================

@app.delete(
    "/api/cameras/{camera_id}"
)
def delete_camera(
    camera_id: int,
    db: Session = Depends(get_db),
):

    existing_camera = (
        db.query(models.Camera)
        .filter(
            models.Camera.id == camera_id
        )
        .first()
    )

    if not existing_camera:

        raise HTTPException(
            status_code=404,
            detail="Camera not found",
        )

    camera_name = existing_camera.name

    try:

        remove_camera_ai(camera_id)

    except Exception as error:

        print(
            f"⚠️ AI cleanup error: {error}"
        )

    db.delete(existing_camera)

    db.commit()

    print()
    print("🗑️ CAMERA DELETED")
    print(f"   ID: {camera_id}")
    print(f"   Name: {camera_name}")

    return {
        "status": "success",
        "message": "Camera deleted successfully",
        "camera_id": camera_id,
    }


# ============================================================
# TEST CAMERA CONNECTION
# ============================================================

@app.post("/api/cameras/test-connection")
def test_camera_connection(camera: CameraCreate):

    camera_name = camera.name.strip()
    camera_location = camera.location.strip()
    rtsp_url = camera.rtsp_url.strip()

    if not rtsp_url:

        raise HTTPException(
            status_code=400,
            detail="Camera URL cannot be empty",
        )

    print()
    print("📡 CAMERA CONNECTION TEST")
    print(f"   Camera: {camera_name}")
    print(f"   Location: {camera_location}")
    print(f"   Source: {rtsp_url}")

    capture = None

    try:

        # Open RTSP/video source
        capture = cv2.VideoCapture(
            rtsp_url,
            cv2.CAP_FFMPEG
        )

        # Give OpenCV a chance to open the stream
        if not capture.isOpened():

            print("❌ Camera connection failed")

            return {
                "status": "FAILED",
                "connected": False,
                "message": "Unable to connect to camera source",
            }

        # Try to read one frame
        success, frame = capture.read()

        if success and frame is not None:

            height, width = frame.shape[:2]

            print("✅ Camera connection successful")
            print(f"   Resolution: {width}x{height}")

            return {
                "status": "CONNECTED",
                "connected": True,
                "message": "Camera connection successful",
                "width": width,
                "height": height,
            }

        print(
            "⚠️ Camera opened but frame could not be read"
        )

        return {
            "status": "FAILED",
            "connected": False,
            "message": "Camera opened but no video frame received",
        }

    except Exception as error:

        print(
            f"❌ Camera test error: {error}"
        )

        return {
            "status": "FAILED",
            "connected": False,
            "message": str(error),
        }

    finally:

        if capture is not None:

            capture.release()

            print("🔌 Camera test connection released")


# ============================================================
# CAMERA VIDEO STREAM
# ============================================================

@app.get(
    "/api/cameras/{camera_id}/stream"
)
def camera_stream(
    camera_id: int,
    db: Session = Depends(get_db),
):

    camera = (
        db.query(models.Camera)
        .filter(
            models.Camera.id == camera_id
        )
        .first()
    )

    if not camera:

        raise HTTPException(
            status_code=404,
            detail="Camera not found",
        )

    if not camera.is_active:

        raise HTTPException(
            status_code=400,
            detail="Camera is inactive",
        )

    # --------------------------------------------------------
    # LOCAL TEST VIDEO
    # --------------------------------------------------------

    if camera.source_type == "FILE":

        video_path = os.path.abspath(
            os.path.join(
                os.path.dirname(
                    os.path.dirname(__file__)
                ),
                "test_media",
                "test.mp4",
            )
        )

        if not os.path.exists(video_path):

            raise HTTPException(
                status_code=404,
                detail="Test video not found",
            )

        print(
            f"🎥 FILE STREAM CAM-{camera.id:03d}"
        )

        return StreamingResponse(
            generate_video_stream(
                video_path
            ),
            media_type=(
                "multipart/x-mixed-replace; "
                "boundary=frame"
            ),
        )

    # --------------------------------------------------------
    # RTSP CAMERA
    # --------------------------------------------------------

    if camera.source_type == "RTSP":

        if not camera.rtsp_url:

            raise HTTPException(
                status_code=400,
                detail="RTSP URL is not configured",
            )

        print(
            f"📡 RTSP STREAM CAM-{camera.id:03d}"
        )

        return StreamingResponse(
            generate_video_stream(
                camera.rtsp_url
            ),
            media_type=(
                "multipart/x-mixed-replace; "
                "boundary=frame"
            ),
        )

    raise HTTPException(
        status_code=400,
        detail=(
            f"Unsupported camera source type: "
            f"{camera.source_type}"
        ),
    )


# ============================================================
# USER REGISTRATION
# ============================================================

@app.post(
    "/api/auth/register",
    response_model=UserResponse,
)
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db),
):

    username = user.username.strip()

    if not username:

        raise HTTPException(
            status_code=400,
            detail="Username cannot be empty",
        )

    if not user.password:

        raise HTTPException(
            status_code=400,
            detail="Password cannot be empty",
        )

    password_bytes = (
        user.password.encode("utf-8")
    )

    if len(password_bytes) > 72:

        raise HTTPException(
            status_code=400,
            detail="Password must be 72 bytes or less",
        )

    existing_user = (
        db.query(models.User)
        .filter(
            models.User.username == username
        )
        .first()
    )

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="Username already exists",
        )

    password_hash = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt(),
    ).decode("utf-8")

    new_user = models.User(
        username=username,
        password_hash=password_hash,
        role="OPERATOR",
        is_active=True,
    )

    db.add(new_user)

    db.commit()

    db.refresh(new_user)

    return new_user


# ============================================================
# USER LOGIN
# ============================================================

@app.post(
    "/api/auth/login"
)
def login_user(
    user: UserLogin,
    db: Session = Depends(get_db),
):

    username = user.username.strip()

    existing_user = (
        db.query(models.User)
        .filter(
            models.User.username == username
        )
        .first()
    )

    if not existing_user:

        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if not existing_user.is_active:

        raise HTTPException(
            status_code=403,
            detail="User account is inactive",
        )

    password_bytes = (
        user.password.encode("utf-8")
    )

    if len(password_bytes) > 72:

        raise HTTPException(
            status_code=400,
            detail="Password is too long",
        )

    try:

        password_valid = bcrypt.checkpw(
            password_bytes,
            existing_user.password_hash.encode(
                "utf-8"
            ),
        )

    except Exception:

        password_valid = False

    if not password_valid:

        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    expire = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    token_data = {
        "sub": str(existing_user.id),
        "username": existing_user.username,
        "role": existing_user.role,
        "exp": expire,
    }

    access_token = jwt.encode(
        token_data,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )

    return {
        "status": "success",
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": existing_user.id,
            "username": existing_user.username,
            "role": existing_user.role,
        },
    }


# ============================================================
# START AI
# ============================================================

@app.post(
    "/api/cameras/{camera_id}/ai/start"
)
def start_camera_ai_endpoint(
    camera_id: int,
    db: Session = Depends(get_db),
):

    camera = (
        db.query(models.Camera)
        .filter(
            models.Camera.id == camera_id
        )
        .first()
    )

    if not camera:

        raise HTTPException(
            status_code=404,
            detail="Camera not found",
        )

    if not camera.is_active:

        raise HTTPException(
            status_code=400,
            detail="Camera is inactive",
        )

    # --------------------------------------------------------
    # FILE SOURCE
    # --------------------------------------------------------

    if camera.source_type == "FILE":

        source = os.path.abspath(
            os.path.join(
                os.path.dirname(
                    os.path.dirname(__file__)
                ),
                "test_media",
                "test.mp4",
            )
        )

        if not os.path.exists(source):

            raise HTTPException(
                status_code=404,
                detail="Test video not found",
            )

    # --------------------------------------------------------
    # RTSP SOURCE
    # --------------------------------------------------------

    else:

        source = camera.rtsp_url

    if not source:

        raise HTTPException(
            status_code=400,
            detail="Camera source is empty",
        )

    print()
    print("🤖 AI START REQUEST")
    print(f"   Camera: {camera.name}")
    print(f"   ID: {camera.id}")
    print(f"   Source: {source}")

    try:

        worker = start_camera_ai(
            camera_id=camera.id,
            source=source,
            camera_name=camera.name,
            location=camera.location,
        )

    except Exception as error:

        print(
            f"❌ Failed to start AI: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail=f"Failed to start AI: {error}",
        )

    return {
        "status": "success",
        "message": "AI processing started",
        "camera_id": camera.id,
        "camera_name": camera.name,
        "ai_status": worker.get_status(),
    }


# ============================================================
# STOP AI
# ============================================================

@app.post(
    "/api/cameras/{camera_id}/ai/stop"
)
def stop_camera_ai_endpoint(
    camera_id: int,
):

    stopped = stop_camera_ai(camera_id)

    if not stopped:

        raise HTTPException(
            status_code=404,
            detail="AI worker not found",
        )

    return {
        "status": "success",
        "message": "AI processing stopped",
        "camera_id": camera_id,
    }


# ============================================================
# AI STATUS
# ============================================================

@app.get(
    "/api/cameras/{camera_id}/ai/status"
)
def camera_ai_status(
    camera_id: int,
):

    worker = get_camera_ai(camera_id)

    if worker is None:

        return {
            "camera_id": camera_id,
            "running": False,
            "status": "NOT_STARTED",
            "message": "AI worker not started",
        }

    try:

        return worker.get_status()

    except Exception as error:

        return {
            "camera_id": camera_id,
            "running": False,
            "status": "ERROR",
            "message": str(error),
        }


# ============================================================
# ALL AI STATUS
# ============================================================

@app.get(
    "/api/ai/status"
)
def all_ai_status():

    return {
        "status": "ok",
        "workers": get_all_ai_status(),
    }


# ============================================================
# CAMERA EVENTS
# ============================================================

@app.get(
    "/api/cameras/{camera_id}/events"
)
def camera_events(
    camera_id: int,
):

    worker = get_camera_ai(camera_id)

    if worker is None:

        return {
            "camera_id": camera_id,
            "events": [],
        }

    return {
        "camera_id": camera_id,
        "events": get_camera_events(camera_id),
    }


# ============================================================
# CAMERA TRACKS
# ============================================================

@app.get(
    "/api/cameras/{camera_id}/tracks"
)
def camera_tracks(
    camera_id: int,
):

    worker = get_camera_ai(camera_id)

    if worker is None:

        return {
            "camera_id": camera_id,
            "tracks": [],
        }

    return {
        "camera_id": camera_id,
        "tracks": get_camera_tracks(camera_id),
    }


# ============================================================
# DASHBOARD AI SUMMARY
# ============================================================

@app.get(
    "/api/dashboard/ai-summary"
)
def dashboard_ai_summary():

    return {
        "status": "ok",
        "active_alerts": get_active_event_count(),
        "total_events": get_total_event_count(),
        "workers": get_all_ai_status(),
    }


# ============================================================
# AI PROCESSED VIDEO STREAM
# ============================================================

@app.get(
    "/api/cameras/{camera_id}/ai-stream"
)
def camera_ai_stream(
    camera_id: int,
):

    print()
    print("🎬 AI STREAM REQUEST")
    print(f"   Camera ID: {camera_id}")

    # --------------------------------------------------------
    # GET WORKER
    # --------------------------------------------------------

    worker = get_camera_ai(camera_id)

    if worker is None:

        print(
            f"❌ No AI worker for camera {camera_id}"
        )

        raise HTTPException(
            status_code=404,
            detail=(
                "AI worker is not running "
                "for this camera. "
                "Start AI first."
            ),
        )

    # --------------------------------------------------------
    # CHECK STREAM METHOD
    # --------------------------------------------------------

    if not hasattr(
        worker,
        "generate_ai_stream"
    ):

        print(
            "❌ AI worker does not have "
            "generate_ai_stream()"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "AI worker does not support "
                "AI video streaming"
            ),
        )

    # --------------------------------------------------------
    # RETURN AI STREAM
    # --------------------------------------------------------

    try:

        stream = worker.generate_ai_stream()

        return StreamingResponse(
            stream,
            media_type=(
                "multipart/x-mixed-replace; "
                "boundary=frame"
            ),
        )

    except Exception as error:

        print(
            f"❌ AI stream error: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail=f"AI stream error: {error}",
        )


# ============================================================
# ALERT MANAGEMENT
# ============================================================


# ============================================================
# GET ALL ALERTS
# ============================================================

@app.get(
    "/api/alerts"
)
def get_all_alerts():

    try:

        alerts = get_alerts()

        return {
            "status": "ok",
            "alerts": alerts,
            "count": len(alerts),
        }

    except Exception as error:

        print(
            f"❌ Failed to get alerts: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail=f"Failed to get alerts: {error}",
        )


# ============================================================
# GET ACTIVE ALERTS
# ============================================================

@app.get(
    "/api/alerts/active"
)
def get_active_alerts_endpoint():

    try:

        alerts = get_active_alerts()

        return {
            "status": "ok",
            "alerts": alerts,
            "count": len(alerts),
        }

    except Exception as error:

        print(
            f"❌ Failed to get active alerts: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to get active alerts: {error}"
            ),
        )


# ============================================================
# ALERT SUMMARY
# ============================================================

@app.get(
    "/api/alerts/summary"
)
def get_alert_summary_endpoint():

    try:

        summary = get_alert_summary()

        return {
            "status": "ok",
            "summary": summary,
        }

    except Exception as error:

        print(
            f"❌ Failed to get alert summary: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to get alert summary: {error}"
            ),
        )


# ============================================================
# ALERT COUNTS
# ============================================================

@app.get(
    "/api/alerts/count"
)
def get_alert_counts():

    try:

        return {
            "status": "ok",
            "total": get_alert_count(),
            "active": get_active_alert_count(),
            "human": get_human_alert_count(),
            "vehicle": get_vehicle_alert_count(),
        }

    except Exception as error:

        print(
            f"❌ Failed to get alert counts: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to get alert counts: {error}"
            ),
        )


# ============================================================
# SHUTDOWN
# ============================================================

@app.on_event("shutdown")
def shutdown_event():

    print()
    print("🛑 Shutting down AVEKSHA NETRA AI...")

    try:

        stop_all_ai()

    except Exception as error:

        print(
            f"⚠️ AI shutdown error: {error}"
        )

    print("🛑 All AI workers stopped")
    print("✅ AVEKSHA NETRA shutdown complete")