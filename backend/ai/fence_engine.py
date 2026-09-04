import json
import threading
import time
from shapely.geometry import Polygon, Point

# ============================================================
# AVEKSHA NETRA
# VIRTUAL-FENCE INTRUSION DETECTION ENGINE (Shapely)
# ============================================================

ALERT_COOLDOWN_SECONDS = 30.0


class FenceEngine:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(FenceEngine, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return

        self._zones = {}
        self._track_inside = {}
        self._last_alert_time = {}
        self._lock = threading.RLock()

        self._load_zones_from_db()
        self._initialized = True

    def _load_zones_from_db(self):
        try:
            from app.database import SessionLocal
            from app.models import CameraZone

            db = SessionLocal()
            try:
                zones = db.query(CameraZone).filter(CameraZone.is_active == True).all()
                with self._lock:
                    self._zones = {}
                    for z in zones:
                        pts = []
                        try:
                            pts_raw = json.loads(z.polygon_points)
                            pts = [(float(p[0]), float(p[1])) for p in pts_raw]
                        except Exception:
                            continue

                        if len(pts) < 3:
                            continue

                        poly = Polygon(pts)
                        zone_item = {
                            "id": z.id,
                            "name": z.name,
                            "camera_id": z.camera_id,
                            "zone_type": z.zone_type,
                            "points": pts,
                            "polygon": poly,
                            "alert_severity": z.alert_severity,
                        }
                        if z.camera_id not in self._zones:
                            self._zones[z.camera_id] = []
                        self._zones[z.camera_id].append(zone_item)
                print(f"✅ FenceEngine loaded active zones for {len(self._zones)} cameras")
            finally:
                db.close()
        except Exception as e:
            print(f"⚠️ FenceEngine DB load note: {e}")

    def reload_zones(self):
        self._load_zones_from_db()

    def get_zones_for_camera(self, camera_id):
        with self._lock:
            return self._zones.get(camera_id, [])

    def check_intrusions(self, camera_id, tracks, frame_width, frame_height):
        with self._lock:
            zones = self._zones.get(camera_id, [])
            if not zones or not tracks:
                return []

            events = []
            now = time.time()
            current_track_ids = set()

            for track in tracks:
                track_id = track.get("track_id")
                if track_id is None:
                    continue
                current_track_ids.add(track_id)

                bbox = track.get("bbox")
                if not bbox or len(bbox) != 4:
                    continue

                x1, y1, x2, y2 = bbox
                anchor_x = ((x1 + x2) / 2.0) / max(1, frame_width)
                anchor_y = float(y2) / max(1, frame_height)
                anchor_point = Point(anchor_x, anchor_y)

                track_key = (camera_id, track_id)
                inside_now = set()

                for zone in zones:
                    zone_id = zone["id"]
                    zone_poly = zone["polygon"]

                    if anchor_point.within(zone_poly):
                        inside_now.add(zone_id)

                        prev_inside = self._track_inside.get(track_key, set())
                        alert_key = (camera_id, track_id, zone_id)
                        last_alert = self._last_alert_time.get(alert_key, 0)

                        is_new_entry = zone_id not in prev_inside
                        cooldown_expired = (now - last_alert) > ALERT_COOLDOWN_SECONDS

                        if is_new_entry or cooldown_expired:
                            self._last_alert_time[alert_key] = now
                            object_type = track.get("object_type", "object").lower()

                            if object_type == "person":
                                event_type = "PERSON_INTRUSION"
                            elif object_type in {"car", "truck", "bus", "motorcycle", "vehicle"}:
                                event_type = "VEHICLE_INTRUSION"
                            else:
                                event_type = "VIRTUAL_FENCE_INTRUSION"

                            zone_name = zone["name"]
                            events.append({
                                "type": event_type,
                                "zone_id": zone_id,
                                "zone_name": zone_name,
                                "zone_type": zone["zone_type"],
                                "camera_id": camera_id,
                                "track_id": track_id,
                                "object_type": object_type,
                                "confidence": track.get("confidence", 0.8),
                                "severity": zone.get("alert_severity", "HIGH"),
                                "title": f"Virtual Fence Intrusion: {zone_name}",
                                "message": f"{object_type.title()} breached {zone_name} (Track #{track_id})",
                                "timestamp": now,
                            })

                self._track_inside[track_key] = inside_now

            dead_keys = [k for k in self._track_inside.keys() if k[0] == camera_id and k[1] not in current_track_ids]
            for k in dead_keys:
                self._track_inside.pop(k, None)

            return events


fence_engine = FenceEngine()
