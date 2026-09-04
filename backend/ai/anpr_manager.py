import re
import time
import threading
from collections import defaultdict

try:
    from .plate_detector import read_plate_from_vehicle
except ImportError:
    from plate_detector import read_plate_from_vehicle

# ============================================================
# AVEKSHA NETRA
# MULTI-FRAME ANPR & WATCHLIST MATCHING MANAGER
#
# Process:
# Vehicle Track -> Multi-frame OCR -> Voting Confirmation ->
# Watchlist Verification -> ANPR Alert Dispatch
# ============================================================


class ANPRManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ANPRManager, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(
        self,
        process_every_n_frames=6,
        minimum_observations=2,
        minimum_confidence=0.35,
    ):
        if getattr(self, "_initialized", False):
            return

        self.process_every_n_frames = process_every_n_frames
        self.minimum_observations = minimum_observations
        self.minimum_confidence = minimum_confidence
        self.frame_counter = 0

        # Track ID -> list of plate observations
        self.observations = defaultdict(list)

        # Track ID -> confirmed plate dict
        self.confirmed_plates = {}

        # Watchlist cache: plate_number (upper) -> dict(category, owner, description)
        self._watchlist = {}
        self._cache_lock = threading.RLock()

        self._load_watchlist_from_db()
        self._initialized = True

    def _load_watchlist_from_db(self):
        try:
            from app.database import SessionLocal
            from app.models import PlateWatchlist

            db = SessionLocal()
            try:
                records = db.query(PlateWatchlist).all()
                with self._cache_lock:
                    self._watchlist = {}
                    for r in records:
                        clean_num = re.sub(r"[^A-Z0-9]", "", r.plate_number.upper())
                        self._watchlist[clean_num] = {
                            "category": r.category.upper(),
                            "owner_name": r.owner_name,
                            "vehicle_description": r.vehicle_description,
                            "notes": r.notes,
                        }
                print(f"✅ ANPRManager loaded {len(self._watchlist)} plates from watchlist")
            finally:
                db.close()
        except Exception as e:
            print(f"⚠️ ANPRManager DB load note: {e}")

    def reload_watchlist(self):
        self._load_watchlist_from_db()

    def check_watchlist(self, plate_number):
        clean = re.sub(r"[^A-Z0-9]", "", str(plate_number).upper())
        with self._cache_lock:
            if clean in self._watchlist:
                match = self._watchlist[clean]
                return True, match["category"], match.get("owner_name"), match.get("vehicle_description")
        return False, "UNKNOWN", None, None

    def process(self, frame, tracks, camera_id=1):
        """
        Runs periodic OCR on active vehicle tracks and checks against watchlist.
        Returns list of new ANPR event dicts.
        """
        self.frame_counter += 1
        results = []

        if self.frame_counter % self.process_every_n_frames != 0:
            return results

        vehicle_classes = {"car", "truck", "bus", "motorcycle", "van", "vehicle"}

        for track in tracks:
            category = str(track.get("category", "")).upper()
            object_type = str(track.get("object_type", "")).lower()

            if object_type not in vehicle_classes and category != "VEHICLE":
                continue

            track_id = track["track_id"]

            # If already confirmed, ensure track carries plate info
            if track_id in self.confirmed_plates:
                cached = self.confirmed_plates[track_id]
                track["plate_number"] = cached["plate_number"]
                track["plate_category"] = cached["category"]
                track["plate_confidence"] = cached["confidence"]
                continue

            bbox = track.get("bbox")
            if not bbox:
                continue

            # Run OCR on vehicle crop
            result = read_plate_from_vehicle(frame, bbox)
            if result is None:
                continue

            plate = result.get("plate_number")
            confidence = result.get("confidence", 0.0)

            if not plate or confidence < self.minimum_confidence:
                continue

            self.observations[track_id].append({
                "plate": plate,
                "confidence": confidence,
            })
            self.observations[track_id] = self.observations[track_id][-10:]

            confirmed = self._confirm_plate(track_id)
            if confirmed:
                plate_num = confirmed["plate_number"]
                is_flagged, cat, owner, v_desc = self.check_watchlist(plate_num)

                confirmed["category"] = cat
                confirmed["is_flagged"] = is_flagged
                confirmed["owner_name"] = owner
                confirmed["vehicle_description"] = v_desc

                self.confirmed_plates[track_id] = confirmed

                # Decorate track
                track["plate_number"] = plate_num
                track["plate_category"] = cat
                track["plate_confidence"] = confirmed["confidence"]

                # Generate event
                is_threat = cat in {"SUSPICIOUS", "STOLEN", "RESTRICTED"}
                event_type = "ANPR_WATCHLIST" if is_threat else "ANPR_DETECTED"
                severity = "CRITICAL" if is_threat else ("INFO" if cat == "ALLOWED" else "MEDIUM")

                title = f"Watchlist Alert: {plate_num} ({cat})" if is_threat else f"Plate Recognized: {plate_num}"
                msg = f"Vehicle with plate {plate_num} ({cat})"
                if owner:
                    msg += f" registered to {owner}"

                results.append({
                    "type": event_type,
                    "camera_id": camera_id,
                    "track_id": track_id,
                    "object_type": object_type,
                    "plate_number": plate_num,
                    "category": cat,
                    "confidence": confirmed["confidence"],
                    "severity": severity,
                    "title": title,
                    "message": msg,
                    "timestamp": time.time(),
                })

        return results

    def _confirm_plate(self, track_id):
        observations = self.observations[track_id]
        if len(observations) < self.minimum_observations:
            return None

        counts = {}
        for obs in observations:
            p = obs["plate"]
            counts[p] = counts.get(p, 0) + 1

        best_plate = max(counts, key=counts.get)
        if counts[best_plate] < self.minimum_observations:
            return None

        matching = [obs for obs in observations if obs["plate"] == best_plate]
        avg_conf = sum(o["confidence"] for o in matching) / len(matching)

        return {
            "plate_number": best_plate,
            "confidence": round(avg_conf, 2),
        }

    def get_plate(self, track_id):
        return self.confirmed_plates.get(track_id)

    def remove_track(self, track_id):
        self.observations.pop(track_id, None)
        self.confirmed_plates.pop(track_id, None)

    def reset(self):
        self.frame_counter = 0
        self.observations.clear()
        self.confirmed_plates.clear()


anpr_manager = ANPRManager()
