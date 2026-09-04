import math
import time
import threading
from collections import defaultdict

# ============================================================
# AVEKSHA NETRA
# SUSPICIOUS ACTIVITY & BEHAVIOR ENGINE
#
# Heuristics:
# 1. Loitering Detection (Dwell time in localized radius)
# 2. Stationary / Abandoned Vehicle Detection
# 3. Crowd / Group Gathering (Pairwise spatial proximity)
# ============================================================

DEFAULT_LOITERING_SECONDS = 30.0
DEFAULT_STATIONARY_SECONDS = 25.0
CROWD_DISTANCE_THRESHOLD_PX = 120.0
MIN_CROWD_SIZE = 3
ALERT_COOLDOWN = 45.0


class BehaviorEngine:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(BehaviorEngine, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return

        self._track_history = {}  # (camera_id, track_id) -> dict(first_seen, initial_center, last_alert)
        self._last_crowd_alert = {}  # camera_id -> timestamp
        self._lock = threading.RLock()
        self._initialized = True

    def process_tracks(self, camera_id, tracks):
        """
        Analyzes active tracks for suspicious behaviors:
        - Loitering
        - Stationary vehicle/object
        - Crowd gathering
        Returns list of generated event dicts.
        """
        with self._lock:
            events = []
            now = time.time()
            active_persons = []
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
                cx = (x1 + x2) / 2.0
                cy = (y1 + y2) / 2.0
                object_type = str(track.get("object_type", "")).lower()

                key = (camera_id, track_id)
                if key not in self._track_history:
                    self._track_history[key] = {
                        "first_seen": now,
                        "initial_center": (cx, cy),
                        "last_alert": 0,
                    }

                history = self._track_history[key]
                dwell_time = now - history["first_seen"]
                dist = math.hypot(cx - history["initial_center"][0], cy - history["initial_center"][1])

                # ----------------------------------------------------
                # 1. LOITERING DETECTION (Person dwelling in small area)
                # ----------------------------------------------------
                if object_type == "person":
                    active_persons.append((track_id, cx, cy))

                    if dwell_time >= DEFAULT_LOITERING_SECONDS and dist <= 80.0:
                        if (now - history["last_alert"]) >= ALERT_COOLDOWN:
                            history["last_alert"] = now
                            dwell_int = int(dwell_time)
                            events.append({
                                "type": "LOITERING_DETECTED",
                                "camera_id": camera_id,
                                "track_id": track_id,
                                "object_type": "person",
                                "dwell_seconds": dwell_int,
                                "severity": "HIGH",
                                "title": f"Suspicious Loitering: Person #{track_id}",
                                "message": f"Subject lingering in area for {dwell_int}s (Track #{track_id})",
                                "timestamp": now,
                            })

                # ----------------------------------------------------
                # 2. STATIONARY VEHICLE / OBJECT
                # ----------------------------------------------------
                elif object_type in {"car", "truck", "bus", "motorcycle", "vehicle"}:
                    if dwell_time >= DEFAULT_STATIONARY_SECONDS and dist <= 25.0:
                        if (now - history["last_alert"]) >= ALERT_COOLDOWN:
                            history["last_alert"] = now
                            dwell_int = int(dwell_time)
                            events.append({
                                "type": "STATIONARY_OBJECT",
                                "camera_id": camera_id,
                                "track_id": track_id,
                                "object_type": object_type,
                                "dwell_seconds": dwell_int,
                                "severity": "MEDIUM",
                                "title": f"Stationary Vehicle: Track #{track_id}",
                                "message": f"{object_type.title()} stationary for {dwell_int}s",
                                "timestamp": now,
                            })

            # ----------------------------------------------------
            # 3. CROWD GATHERING (Spatial clustering of people)
            # ----------------------------------------------------
            if len(active_persons) >= MIN_CROWD_SIZE:
                clusters = []
                visited = set()

                for i in range(len(active_persons)):
                    if i in visited:
                        continue
                    cluster = [active_persons[i]]
                    visited.add(i)

                    for j in range(i + 1, len(active_persons)):
                        if j in visited:
                            continue
                        d = math.hypot(active_persons[i][1] - active_persons[j][1], active_persons[i][2] - active_persons[j][2])
                        if d <= CROWD_DISTANCE_THRESHOLD_PX:
                            cluster.append(active_persons[j])
                            visited.add(j)

                    if len(cluster) >= MIN_CROWD_SIZE:
                        clusters.append(cluster)

                if clusters:
                    last_alert = self._last_crowd_alert.get(camera_id, 0)
                    if (now - last_alert) >= 60.0:
                        self._last_crowd_alert[camera_id] = now
                        total_crowd = sum(len(c) for c in clusters)
                        events.append({
                            "type": "CROWD_GATHERING",
                            "camera_id": camera_id,
                            "track_id": None,
                            "object_type": "person",
                            "count": total_crowd,
                            "severity": "MEDIUM",
                            "title": f"Crowd Gathering Detected",
                            "message": f"Cluster of {total_crowd} persons formed in monitored area",
                            "timestamp": now,
                        })

            # Cleanup departed tracks
            dead_keys = [k for k in self._track_history.keys() if k[0] == camera_id and k[1] not in current_track_ids]
            for k in dead_keys:
                self._track_history.pop(k, None)

            return events


behavior_engine = BehaviorEngine()
