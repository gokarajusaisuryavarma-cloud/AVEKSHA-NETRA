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

import base64
import numpy as np

from app.schemas import (
    CameraCreate,
    CameraResponse,
    UserCreate,
    UserResponse,
    UserLogin,
    KnownFaceCreate,
    KnownFaceResponse,
    PlateWatchlistCreate,
    PlateWatchlistResponse,
    CameraZoneCreate,
    CameraZoneResponse,
    SuspiciousRuleCreate,
    SuspiciousRuleResponse,
    NightScheduleCreate,
    NightScheduleResponse,
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

from ai.face_engine import face_engine
from ai.fence_engine import fence_engine
from ai.anpr_manager import anpr_manager
from ai.behavior_engine import behavior_engine
from ai.night_engine import night_engine
from ai.alert_manager import (
    get_alerts,
    get_active_alerts,
    acknowledge_alert,
    clear_alerts,
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

        # Production frontend
        "https://avekshanetra.in",

          # Cloudflare Tunnel
    "https://reservations-antarctica-tube-pursuant.trycloudflare.com",
    ],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ============================================================
# JWT CONFIGURATION
# ============================================================

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "development-secret-change-me",
)
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
            connection.execute(text("SELECT 1"))

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
    print(f"   Source Type: {new_camera.source_type}")

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

    # --------------------------------------------------------
    # STOP EXISTING AI
    # --------------------------------------------------------

    try:

        stop_camera_ai(camera_id)

    except Exception as error:

        print(
            f"⚠️ AI stop error during update: {error}"
        )

    # --------------------------------------------------------
    # UPDATE CAMERA
    # --------------------------------------------------------

    existing_camera.name = camera_name
    existing_camera.location = camera_location
    existing_camera.rtsp_url = rtsp_url

    # Existing camera remains RTSP
    existing_camera.source_type = "RTSP"

    db.commit()

    db.refresh(existing_camera)

    print()
    print("✏️ CAMERA UPDATED")
    print(f"   ID: {existing_camera.id}")
    print(f"   Name: {existing_camera.name}")
    print(f"   Source Type: {existing_camera.source_type}")

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

@app.post(
    "/api/cameras/test-connection"
)
def test_camera_connection(
    camera: CameraCreate,
):

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

        capture = cv2.VideoCapture(
            rtsp_url,
            cv2.CAP_FFMPEG,
        )

        if not capture.isOpened():

            print(
                "❌ Camera connection failed"
            )

            return {
                "status": "FAILED",
                "connected": False,
                "message": (
                    "Unable to connect "
                    "to camera source"
                ),
            }

        success, frame = capture.read()

        if success and frame is not None:

            height, width = frame.shape[:2]

            print(
                "✅ Camera connection successful"
            )

            print(
                f"   Resolution: "
                f"{width}x{height}"
            )

            return {
                "status": "CONNECTED",
                "connected": True,
                "message": (
                    "Camera connection successful"
                ),
                "width": width,
                "height": height,
            }

        print(
            "⚠️ Camera opened but frame "
            "could not be read"
        )

        return {
            "status": "FAILED",
            "connected": False,
            "message": (
                "Camera opened but no "
                "video frame received"
            ),
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

            try:
                capture.release()
            except Exception:
                pass


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
            f"🎥 FILE STREAM "
            f"CAM-{camera.id:03d}"
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
                detail=(
                    "RTSP URL is not configured"
                ),
            )

        print(
            f"📡 RTSP STREAM "
            f"CAM-{camera.id:03d}"
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
            "Unsupported camera source type: "
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

    password_bytes = user.password.encode(
        "utf-8"
    )

    if len(password_bytes) > 72:

        raise HTTPException(
            status_code=400,
            detail=(
                "Password must be "
                "72 bytes or less"
            ),
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
            detail=(
                "Invalid username or password"
            ),
        )

    if not existing_user.is_active:

        raise HTTPException(
            status_code=403,
            detail="User account is inactive",
        )

    password_bytes = user.password.encode(
        "utf-8"
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
            detail=(
                "Invalid username or password"
            ),
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
    # DETERMINE SOURCE
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

    elif camera.source_type == "RTSP":

        source = camera.rtsp_url

    else:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported camera source type: "
                f"{camera.source_type}"
            ),
        )

    if not source:

        raise HTTPException(
            status_code=400,
            detail="Camera source is empty",
        )

    print()
    print("🤖 AI START REQUEST")
    print(f"   Camera: {camera.name}")
    print(f"   ID: {camera.id}")
    print(f"   Type: {camera.source_type}")
    print(f"   Source: {source}")

    # --------------------------------------------------------
    # START AI WORKER
    # --------------------------------------------------------

    try:

        worker = start_camera_ai(
            camera_id=camera.id,
            source=source,
            source_type=camera.source_type,
            camera_name=camera.name,
            location=camera.location,
        )

    except Exception as error:

        print(
            f"❌ Failed to start AI: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to start AI: {error}"
            ),
        )

    return {
        "status": "success",
        "message": "AI processing started",
        "camera_id": camera.id,
        "camera_name": camera.name,
        "source_type": camera.source_type,
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
        "events": get_camera_events(
            camera_id
        ),
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
        "tracks": get_camera_tracks(
            camera_id
        ),
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
    # GET AI WORKER
    # --------------------------------------------------------

    worker = get_camera_ai(camera_id)

    if worker is None:

        print(
            f"❌ No AI worker for camera "
            f"{camera_id}"
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
        "generate_ai_stream",
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
            detail=(
                f"AI stream error: {error}"
            ),
        )


# ============================================================
# FACE RECOGNITION REGISTRY
# ============================================================

@app.get("/api/faces", response_model=list[KnownFaceResponse])
def get_registered_faces(db: Session = Depends(get_db)):
    faces = db.query(models.KnownFace).order_by(models.KnownFace.created_at.desc()).all()
    return faces


@app.post("/api/faces")
def register_face(data: KnownFaceCreate, db: Session = Depends(get_db)):
    if data.image_base64:
        try:
            raw_b64 = data.image_base64
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            img_bytes = base64.b64decode(raw_b64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise HTTPException(status_code=400, detail="Invalid image data")

            success, msg, face_id = face_engine.register_face(
                name=data.name,
                role=data.role,
                department=data.department,
                image_bgr=img,
                notes=data.notes,
            )
            if not success:
                raise HTTPException(status_code=400, detail=msg)

            return {"status": "success", "message": msg, "face_id": face_id}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Face registration failed: {e}")

    if data.embedding:
        kf = models.KnownFace(
            name=data.name.strip(),
            role=data.role.strip() if data.role else "Staff",
            department=data.department.strip() if data.department else "General",
            embedding=data.embedding,
            notes=data.notes,
        )
        db.add(kf)
        db.commit()
        db.refresh(kf)
        face_engine.reload_cache()
        return {"status": "success", "message": "Face registered successfully", "face_id": kf.id}

    raise HTTPException(status_code=400, detail="Either image_base64 or embedding is required")


@app.delete("/api/faces/{face_id}")
def delete_registered_face(face_id: int, db: Session = Depends(get_db)):
    kf = db.query(models.KnownFace).filter(models.KnownFace.id == face_id).first()
    if not kf:
        raise HTTPException(status_code=404, detail="Registered face not found")
    db.delete(kf)
    db.commit()
    face_engine.reload_cache()
    return {"status": "success", "message": "Face removed"}


# ============================================================
# ANPR WATCHLIST
# ============================================================

@app.get("/api/watchlist", response_model=list[PlateWatchlistResponse])
def get_watchlist(db: Session = Depends(get_db)):
    items = db.query(models.PlateWatchlist).order_by(models.PlateWatchlist.created_at.desc()).all()
    return items


@app.post("/api/watchlist")
def add_to_watchlist(entry: PlateWatchlistCreate, db: Session = Depends(get_db)):
    import re
    clean_plate = re.sub(r"[^A-Z0-9]", "", entry.plate_number.upper().strip())
    if not clean_plate:
        raise HTTPException(status_code=400, detail="Valid plate number is required")

    existing = db.query(models.PlateWatchlist).filter(models.PlateWatchlist.plate_number == clean_plate).first()
    if existing:
        existing.category = entry.category.upper()
        existing.vehicle_description = entry.vehicle_description
        existing.owner_name = entry.owner_name
        existing.notes = entry.notes
        db.commit()
        db.refresh(existing)
        anpr_manager.reload_watchlist()
        return {"status": "success", "message": "Watchlist entry updated", "id": existing.id}

    item = models.PlateWatchlist(
        plate_number=clean_plate,
        category=entry.category.upper(),
        vehicle_description=entry.vehicle_description,
        owner_name=entry.owner_name,
        notes=entry.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    anpr_manager.reload_watchlist()
    return {"status": "success", "message": "Plate added to watchlist", "id": item.id}


@app.delete("/api/watchlist/{entry_id}")
def delete_from_watchlist(entry_id: int, db: Session = Depends(get_db)):
    item = db.query(models.PlateWatchlist).filter(models.PlateWatchlist.id == entry_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist entry not found")
    db.delete(item)
    db.commit()
    anpr_manager.reload_watchlist()
    return {"status": "success", "message": "Entry removed from watchlist"}


# ============================================================
# VIRTUAL-FENCE CAMERA ZONES
# ============================================================

@app.get("/api/cameras/{camera_id}/zones", response_model=list[CameraZoneResponse])
def get_camera_zones(camera_id: int, db: Session = Depends(get_db)):
    zones = db.query(models.CameraZone).filter(models.CameraZone.camera_id == camera_id).all()
    return zones


@app.post("/api/cameras/{camera_id}/zones")
def create_camera_zone(camera_id: int, zone: CameraZoneCreate, db: Session = Depends(get_db)):
    camera = db.query(models.Camera).filter(models.Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    new_zone = models.CameraZone(
        camera_id=camera_id,
        name=zone.name.strip(),
        zone_type=zone.zone_type.upper(),
        polygon_points=zone.polygon_points,
        alert_severity=zone.alert_severity.upper(),
        is_active=zone.is_active,
    )
    db.add(new_zone)
    db.commit()
    db.refresh(new_zone)
    fence_engine.reload_zones()
    return {"status": "success", "message": "Zone created successfully", "id": new_zone.id}


@app.delete("/api/cameras/{camera_id}/zones/{zone_id}")
def delete_camera_zone(camera_id: int, zone_id: int, db: Session = Depends(get_db)):
    z = db.query(models.CameraZone).filter(models.CameraZone.id == zone_id, models.CameraZone.camera_id == camera_id).first()
    if not z:
        raise HTTPException(status_code=404, detail="Zone not found")
    db.delete(z)
    db.commit()
    fence_engine.reload_zones()
    return {"status": "success", "message": "Zone removed"}


# ============================================================
# LIVE THREAT ALERTS
# ============================================================

@app.get("/api/alerts")
def get_live_alerts(category: str = None, status: str = None, camera_id: int = None, limit: int = 100):
    all_alerts = get_alerts()
    filtered = all_alerts

    if camera_id is not None:
        filtered = [a for a in filtered if a.get("camera_id") == camera_id]

    if status:
        filtered = [a for a in filtered if str(a.get("status", "")).upper() == status.upper()]

    if category:
        cat_upper = category.upper()
        if cat_upper == "INTRUSIONS":
            filtered = [a for a in filtered if "INTRUSION" in str(a.get("alert_type", ""))]
        elif cat_upper in {"ANPR", "PLATES"}:
            filtered = [a for a in filtered if "ANPR" in str(a.get("alert_type", ""))]
        elif cat_upper in {"FACE", "FACE_ID"}:
            filtered = [a for a in filtered if "FACE" in str(a.get("alert_type", ""))]
        elif cat_upper in {"SUSPICIOUS", "BEHAVIOR"}:
            filtered = [a for a in filtered if str(a.get("alert_type")) in {"LOITERING_DETECTED", "STATIONARY_OBJECT", "CROWD_GATHERING"}]
        elif cat_upper in {"NIGHT", "NIGHT_PATROL"}:
            filtered = [a for a in filtered if "NIGHT" in str(a.get("alert_type", ""))]

    return {
        "status": "ok",
        "total": len(filtered),
        "alerts": filtered[:limit],
    }


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert_endpoint(alert_id: int):
    alert = acknowledge_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success", "message": f"Alert #{alert_id} acknowledged", "alert": alert}


@app.delete("/api/alerts")
def clear_all_alerts_endpoint():
    clear_alerts()
    return {"status": "success", "message": "All live alerts cleared"}


# ============================================================
# SECURITY RULES & NIGHT CURFEW SETTINGS
# ============================================================

@app.get("/api/settings/security-rules")
def get_security_settings(db: Session = Depends(get_db)):
    rules = db.query(models.SuspiciousRule).all()
    schedules = db.query(models.NightSchedule).all()
    return {
        "status": "ok",
        "rules": [
            {
                "id": r.id,
                "camera_id": r.camera_id,
                "rule_type": r.rule_type,
                "threshold_seconds": r.threshold_seconds,
                "is_active": r.is_active,
            }
            for r in rules
        ],
        "night_schedules": [
            {
                "id": s.id,
                "camera_id": s.camera_id,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "luminance_threshold": s.luminance_threshold,
                "is_active": s.is_active,
            }
            for s in schedules
        ],
    }


# ============================================================
# SHUTDOWN
# ============================================================

@app.on_event("shutdown")
def shutdown_event():

    print()
    print(
        "🛑 Shutting down "
        "AVEKSHA NETRA AI..."
    )

    try:

        stop_all_ai()

    except Exception as error:

        print(
            f"⚠️ AI shutdown error: {error}"
        )

    print(
        "🛑 All AI workers stopped"
    )

    print(
        "✅ AVEKSHA NETRA shutdown complete"
    )
