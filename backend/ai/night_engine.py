import cv2
import time
import threading
import numpy as np
from datetime import datetime

# ============================================================
# AVEKSHA NETRA
# NIGHT-TIME MOVEMENT DETECTION ENGINE
#
# Evaluates:
# 1. Optical frame luminance (low-light threshold < 65.0)
# 2. Curfew schedule (default 20:00 - 06:00 local time)
# ============================================================

DEFAULT_LUMINANCE_THRESHOLD = 65.0
DEFAULT_START_HOUR = 20  # 8 PM
DEFAULT_END_HOUR = 6     # 6 AM
ALERT_COOLDOWN = 45.0


class NightEngine:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(NightEngine, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return

        self._schedules = {}  # camera_id -> schedule dict
        self._last_alert_time = {}  # (camera_id, track_id) -> timestamp
        self._lock = threading.RLock()

        self._load_schedules_from_db()
        self._initialized = True

    def _load_schedules_from_db(self):
        try:
            from app.database import SessionLocal
            from app.models import NightSchedule

            db = SessionLocal()
            try:
                records = db.query(NightSchedule).filter(NightSchedule.is_active == True).all()
                with self._lock:
                    self._schedules = {}
                    for r in records:
                        self._schedules[r.camera_id] = {
                            "start_time": r.start_time,
                            "end_time": r.end_time,
                            "luminance_threshold": r.luminance_threshold,
                        }
                print(f"✅ NightEngine loaded {len(self._schedules)} camera schedules")
            finally:
                db.close()
        except Exception as e:
            print(f"⚠️ NightEngine DB load note: {e}")

    def reload_schedules(self):
        self._load_schedules_from_db()

    def is_night_mode(self, frame_bgr, camera_id=None):
        """
        Evaluates whether night mode is active for the given frame/camera.
        Returns (is_night: bool, luminance: float, reason: str).
        """
        luminance = 100.0
        if frame_bgr is not None and frame_bgr.size > 0:
            try:
                # Fast downsampled luminance check
                small = cv2.resize(frame_bgr, (160, 120))
                gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
                luminance = float(np.mean(gray))
            except Exception:
                luminance = 100.0

        # Check schedule
        now = datetime.now()
        current_hour = now.hour

        # Default curfew is 20:00 to 06:00
        curfew_active = (current_hour >= DEFAULT_START_HOUR or current_hour < DEFAULT_END_HOUR)

        threshold = DEFAULT_LUMINANCE_THRESHOLD
        with self._lock:
            sched = self._schedules.get(camera_id)
            if sched:
                threshold = sched.get("luminance_threshold", DEFAULT_LUMINANCE_THRESHOLD)
                # Parse start/end hour
                try:
                    sh = int(sched["start_time"].split(":")[0])
                    eh = int(sched["end_time"].split(":")[0])
                    if sh > eh:
                        curfew_active = (current_hour >= sh or current_hour < eh)
                    else:
                        curfew_active = (sh <= current_hour < eh)
                except Exception:
                    pass

        is_low_light = luminance < threshold

        if is_low_light and curfew_active:
            return True, luminance, "LOW_LIGHT_AND_CURFEW"
        elif is_low_light:
            return True, luminance, "LOW_LIGHT"
        elif curfew_active:
            return True, luminance, "CURFEW_SCHEDULE"

        return False, luminance, "DAYLIGHT"

    def check_night_movement(self, camera_id, frame_bgr, tracks, active_intrusions=None):
        """
        Detects movement during night mode.
        Returns list of night movement event dicts.
        """
        is_night, luminance, reason = self.is_night_mode(frame_bgr, camera_id)
        if not is_night or not tracks:
            return [], is_night, luminance

        with self._lock:
            events = []
            now = time.time()
            current_track_ids = set()

            for track in tracks:
                track_id = track.get("track_id")
                if track_id is None:
                    continue
                current_track_ids.add(track_id)

                alert_key = (camera_id, track_id)
                last_alert = self._last_alert_time.get(alert_key, 0)
                if (now - last_alert) < ALERT_COOLDOWN:
                    continue

                object_type = str(track.get("object_type", "object")).lower()

                # Check if this track is also in a virtual fence intrusion
                has_intrusion = False
                if active_intrusions:
                    has_intrusion = any(i.get("track_id") == track_id for i in active_intrusions)

                if has_intrusion:
                    event_type = "NIGHT_INTRUSION"
                    severity = "CRITICAL"
                    title = f"CRITICAL: Night Intrusion (Track #{track_id})"
                    msg = f"{object_type.title()} breached boundary during night surveillance (Lux: {luminance:.1f})"
                elif object_type == "person":
                    event_type = "NIGHT_PERSON_MOVEMENT"
                    severity = "HIGH"
                    title = f"Night Human Movement: Track #{track_id}"
                    msg = f"Person detected during curfew / low-light conditions (Lux: {luminance:.1f})"
                elif object_type in {"car", "truck", "bus", "motorcycle", "vehicle"}:
                    event_type = "NIGHT_VEHICLE_MOVEMENT"
                    severity = "HIGH"
                    title = f"Night Vehicle Movement: Track #{track_id}"
                    msg = f"Vehicle movement detected during curfew hours (Lux: {luminance:.1f})"
                else:
                    continue

                self._last_alert_time[alert_key] = now
                events.append({
                    "type": event_type,
                    "camera_id": camera_id,
                    "track_id": track_id,
                    "object_type": object_type,
                    "luminance": round(luminance, 1),
                    "night_reason": reason,
                    "severity": severity,
                    "title": title,
                    "message": msg,
                    "timestamp": now,
                })

            # Cleanup inactive tracks
            dead_keys = [k for k in self._last_alert_time.keys() if k[0] == camera_id and k[1] not in current_track_ids]
            for k in dead_keys:
                self._last_alert_time.pop(k, None)

            return events, is_night, luminance


night_engine = NightEngine()
