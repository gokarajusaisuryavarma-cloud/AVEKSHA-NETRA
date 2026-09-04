import cv2
import os
import threading
import time
from datetime import datetime

from .detector import analyze_frame
from .tracker import ObjectTracker
from .event_manager import EventManager
from .alert_manager import process_ai_event
from .face_engine import face_engine
from .fence_engine import fence_engine
from .behavior_engine import behavior_engine
from .night_engine import night_engine
from .anpr_manager import anpr_manager


# ============================================================
# AVEKSHA NETRA
# LIVE AI SERVICE
#
# CAMERA
#     ↓
# OpenCV
#     ↓
# YOLO
#     ↓
# TRACKER
#     ↓
# EVENT MANAGER
#     ↓
# ALERT MANAGER
#     ↓
# MJPEG AI STREAM
#     ↓
# DASHBOARD
# ============================================================


# ============================================================
# CONFIGURATION
# ============================================================

DETECTION_CONFIDENCE = 0.40

MAX_TRACK_DISTANCE = 120
MAX_MISSING_FRAMES = 36
MIN_CONFIRMATIONS = 2

# Run YOLO on every Nth frame, but keep streaming EVERY frame.
PROCESS_EVERY_N_FRAMES = 2

MAX_STORED_EVENTS = 100

# Used only for local test-video playback.
# 0 means use the video's natural FPS.
DEFAULT_FILE_FPS = 25.0


# ============================================================
# GLOBAL CAMERA WORKERS
# ============================================================

workers = {}
workers_lock = threading.RLock()


# ============================================================
# CAMERA AI WORKER
# ============================================================

class CameraAIWorker:

    def __init__(
        self,
        camera_id,
        source,
        source_type,
        camera_name="Camera",
        location="Unknown",
    ):
        self.camera_id = camera_id
        self.source = source
        self.source_type = source_type
        self.camera_name = camera_name
        self.location = location

        # ----------------------------------------------------
        # THREAD STATE
        # ----------------------------------------------------

        self.running = False
        self.thread = None

        self.capture = None
        self.capture_lock = threading.RLock()

        # ----------------------------------------------------
        # FRAME STATE
        # ----------------------------------------------------

        self.last_frame = None
        self.last_update = None
        self.frame_number = 0

        # ----------------------------------------------------
        # AI STATE
        # ----------------------------------------------------

        self.latest_detections = []
        self.latest_tracks = []
        self.active_intrusions = []
        self.recognized_faces = {}
        self.night_mode = False
        self.luminance = 100.0

        self.tracker = ObjectTracker(
            max_distance=MAX_TRACK_DISTANCE,
            max_missing=MAX_MISSING_FRAMES,
            min_confirmations=MIN_CONFIRMATIONS,
        )

        self.event_manager = EventManager(
            end_after_missing_frames=MAX_MISSING_FRAMES
        )

        # ----------------------------------------------------
        # EVENTS
        # ----------------------------------------------------

        self.recent_events = []

        # ----------------------------------------------------
        # STATISTICS
        # ----------------------------------------------------

        self.total_detections = 0
        self.total_events = 0

        # ----------------------------------------------------
        # STATUS
        # ----------------------------------------------------

        self.status = "STOPPED"
        self.last_error = None

        # ----------------------------------------------------
        # STREAM CONDITION
        # ----------------------------------------------------

        self.frame_condition = threading.Condition()


    # ========================================================
    # START
    # ========================================================

    def start(self):

        if self.running:
            return

        self.running = True
        self.status = "STARTING"
        self.last_error = None

        self.thread = threading.Thread(
            target=self._run,
            daemon=True,
            name=f"AI-Camera-{self.camera_id}",
        )

        self.thread.start()

        print(
            f"🤖 AI started for camera {self.camera_id}"
        )


    # ========================================================
    # STOP
    # ========================================================

    def stop(self):

        self.running = False
        self.status = "STOPPING"

        with self.capture_lock:
            capture = self.capture

        if capture is not None:
            try:
                capture.release()
            except Exception:
                pass

        with self.frame_condition:
            self.frame_condition.notify_all()

        if (
            self.thread is not None
            and self.thread.is_alive()
            and self.thread != threading.current_thread()
        ):
            self.thread.join(timeout=2)

        self.status = "STOPPED"

        print(
            f"🛑 AI stopped for camera {self.camera_id}"
        )


    # ========================================================
    # GET SOURCE
    # ========================================================

    def _get_source(self):

        # ----------------------------------------------------
        # LOCAL TEST VIDEO
        # ----------------------------------------------------

        if self.source_type == "FILE":

            # ai_services.py is inside:
            # backend/ai/
            #
            # test.mp4 is inside:
            # backend/test_media/
            #
            # Therefore go one directory UP from ai/.

            backend_dir = os.path.dirname(
                os.path.dirname(os.path.abspath(__file__))
            )

            video_path = os.path.join(
                backend_dir,
                "test_media",
                "test.mp4",
            )

            return os.path.abspath(video_path)

        # ----------------------------------------------------
        # RTSP / OTHER SOURCE
        # ----------------------------------------------------

        return self.source


    # ========================================================
    # OPEN CAPTURE
    # ========================================================

    def _open_capture(self):

        source = self._get_source()

        print()
        print("🎥 Opening AI source")
        print(f"   Camera: {self.camera_id}")
        print(f"   Type: {self.source_type}")
        print(f"   Source: {source}")

        if self.source_type == "FILE":
            if not os.path.exists(source):
                self.last_error = (
                    f"Test video not found: {source}"
                )

                print(f"❌ {self.last_error}")
                return None

        capture = None

        try:
            capture = cv2.VideoCapture(
                source,
                cv2.CAP_FFMPEG,
            )
        except Exception:
            try:
                capture = cv2.VideoCapture(source)
            except Exception as error:
                self.last_error = str(error)
                return None

        if not capture.isOpened():

            try:
                capture.release()
            except Exception:
                pass

            self.last_error = (
                "Could not open camera source"
            )

            print(
                f"❌ AI could not open "
                f"camera {self.camera_id}"
            )

            return None

        # ----------------------------------------------------
        # FILE FPS
        # ----------------------------------------------------

        fps = capture.get(cv2.CAP_PROP_FPS)

        if (
            fps is None
            or fps <= 0
            or fps > 120
        ):
            fps = DEFAULT_FILE_FPS

        self.file_fps = fps

        print(
            f"✅ AI connected to camera "
            f"{self.camera_id}"
        )

        if self.source_type == "FILE":
            print(f"   Video FPS: {fps:.2f}")

        return capture


    # ========================================================
    # MAIN AI LOOP
    # ========================================================

    def _run(self):

        camera = None

        try:

            camera = self._open_capture()

            if camera is None:

                self.running = False
                self.status = "OFFLINE"

                return

            with self.capture_lock:
                self.capture = camera

            self.status = "ONLINE"

            print(
                f"🟢 AI worker ONLINE "
                f"for camera {self.camera_id}"
            )

            # ------------------------------------------------
            # Frame timing for local test video
            # ------------------------------------------------

            next_frame_time = time.monotonic()

            while self.running:

                # ============================================
                # READ FRAME
                # ============================================

                success, frame = camera.read()

                # ============================================
                # VIDEO ENDED / CONNECTION LOST
                # ============================================

                if not success:

                    if self.source_type == "FILE":

                        print(
                            f"🔄 Test video ended "
                            f"for camera {self.camera_id} "
                            f"- restarting from beginning"
                        )

                        try:
                            camera.release()
                        except Exception:
                            pass

                        # Re-open the same file.
                        time.sleep(0.2)

                        if not self.running:
                            break

                        camera = self._open_capture()

                        if camera is None:

                            self.status = "OFFLINE"

                            time.sleep(1)

                            continue

                        with self.capture_lock:
                            self.capture = camera

                        self.status = "ONLINE"

                        # Reset timing after restart.
                        next_frame_time = time.monotonic()

                        continue

                    # ----------------------------------------
                    # RTSP CONNECTION LOST
                    # ----------------------------------------

                    print(
                        f"⚠️ Camera {self.camera_id} "
                        f"stream lost - reconnecting"
                    )

                    self.status = "RECONNECTING"

                    try:
                        camera.release()
                    except Exception:
                        pass

                    if not self.running:
                        break

                    time.sleep(1)

                    camera = self._open_capture()

                    if camera is None:
                        time.sleep(2)
                        continue

                    with self.capture_lock:
                        self.capture = camera

                    self.status = "ONLINE"

                    continue

                # ============================================
                # SAVE EVERY FRAME FOR LIVE STREAM
                # ============================================

                self.frame_number += 1

                self.last_frame = frame.copy()
                self.last_update = datetime.now()

                # Wake up the MJPEG generator.
                with self.frame_condition:
                    self.frame_condition.notify_all()

                # ============================================
                # AI DETECTION
                #
                # IMPORTANT:
                # We do NOT skip updating last_frame.
                # Therefore the dashboard keeps receiving
                # continuous video even though YOLO runs
                # only every Nth frame.
                # ============================================

                if (
                    self.frame_number
                    % PROCESS_EVERY_N_FRAMES
                    != 0
                ):
                    self._control_file_playback(next_frame_time)
                    next_frame_time = self._next_frame_time(
                        next_frame_time
                    )
                    continue

                try:

                    analysis = analyze_frame(
                        frame,
                        confidence=DETECTION_CONFIDENCE,
                    )

                    if not isinstance(
                        analysis,
                        dict,
                    ):
                        analysis = {}

                except Exception as error:

                    self.last_error = (
                        f"Detection error: {error}"
                    )

                    print(
                        f"⚠️ Detection error "
                        f"camera {self.camera_id}: "
                        f"{error}"
                    )

                    analysis = {}

                detections = analysis.get(
                    "detections",
                    [],
                )

                if detections is None:
                    detections = []

                self.latest_detections = detections

                self.total_detections += len(
                    detections
                )

                # ============================================
                # TRACKING
                # ============================================

                try:

                    self.tracker.update(
                        detections
                    )

                    tracks = (
                        self.tracker
                        .get_confirmed_tracks()
                    )

                    if tracks is None:
                        tracks = []

                    self.latest_tracks = tracks

                except Exception as error:

                    self.last_error = (
                        f"Tracking error: {error}"
                    )

                    print(
                        f"⚠️ Tracking error "
                        f"camera {self.camera_id}: "
                        f"{error}"
                    )

                    tracks = []

                    self.latest_tracks = []

                # ============================================
                # 1. NIGHT MODE CHECK
                # ============================================

                try:
                    is_night, luminance, _ = night_engine.is_night_mode(
                        frame, self.camera_id
                    )
                    self.night_mode = is_night
                    self.luminance = luminance
                except Exception:
                    pass

                # ============================================
                # 2. ANPR (NUMBER PLATE RECOGNITION & WATCHLIST)
                # ============================================

                try:
                    anpr_events = anpr_manager.process(
                        frame, tracks, self.camera_id
                    )
                    for a_evt in anpr_events:
                        self._store_event({
                            "type": a_evt["type"],
                            "event": a_evt,
                        })
                except Exception as anpr_err:
                    print(f"⚠️ ANPR worker error: {anpr_err}")

                # ============================================
                # 3. FACE DETECTION & RECOGNITION
                # ============================================

                try:
                    for track in tracks:
                        if track.get("object_type") == "person":
                            tid = track["track_id"]
                            if (
                                tid not in self.recognized_faces
                                or (self.frame_number % 12 == 0)
                            ):
                                face_info = face_engine.process_person_crop(
                                    frame, track.get("bbox")
                                )
                                if face_info:
                                    self.recognized_faces[tid] = face_info
                                    track["face"] = face_info
                                    if (
                                        face_info.get("is_known")
                                        and not track.get("face_alerted")
                                    ):
                                        track["face_alerted"] = True
                                        f_evt = {
                                            "type": "FACE_RECOGNIZED",
                                            "camera_id": self.camera_id,
                                            "track_id": tid,
                                            "object_type": "person",
                                            "name": face_info["name"],
                                            "role": face_info["role"],
                                            "confidence": face_info["confidence"],
                                            "title": f"Personnel Identified: {face_info['name']}",
                                            "message": f"{face_info['name']} ({face_info['role']}) identified at {self.camera_name}",
                                            "severity": "INFO",
                                        }
                                        self._store_event({
                                            "type": "FACE_RECOGNIZED",
                                            "event": f_evt,
                                        })
                                elif tid in self.recognized_faces:
                                    track["face"] = self.recognized_faces[tid]
                except Exception as face_err:
                    print(f"⚠️ Face worker error: {face_err}")

                # ============================================
                # 4. VIRTUAL FENCE INTRUSION DETECTION
                # ============================================

                fence_events = []
                try:
                    h, w = frame.shape[:2]
                    fence_events = fence_engine.check_intrusions(
                        self.camera_id, tracks, w, h
                    )
                    self.active_intrusions = fence_events
                    for f_evt in fence_events:
                        self._store_event({
                            "type": f_evt["type"],
                            "event": f_evt,
                        })
                except Exception as fence_err:
                    print(f"⚠️ Fence worker error: {fence_err}")

                # ============================================
                # 5. SUSPICIOUS BEHAVIOR (LOITERING, CROWD)
                # ============================================

                try:
                    behavior_events = behavior_engine.process_tracks(
                        self.camera_id, tracks
                    )
                    for b_evt in behavior_events:
                        self._store_event({
                            "type": b_evt["type"],
                            "event": b_evt,
                        })
                except Exception as beh_err:
                    print(f"⚠️ Behavior worker error: {beh_err}")

                # ============================================
                # 6. NIGHT MOVEMENT DETECTION
                # ============================================

                try:
                    night_events, _, _ = night_engine.check_night_movement(
                        self.camera_id, frame, tracks, fence_events
                    )
                    for n_evt in night_events:
                        self._store_event({
                            "type": n_evt["type"],
                            "event": n_evt,
                        })
                except Exception as night_err:
                    print(f"⚠️ Night worker error: {night_err}")

                # ============================================
                # EVENT MANAGEMENT
                # ============================================

                try:

                    events = (
                        self.event_manager
                        .process_tracks(
                            tracks,
                            self.camera_id,
                        )
                    )

                    if events is None:
                        events = []

                except Exception as error:

                    self.last_error = (
                        f"Event manager error: {error}"
                    )

                    print(
                        f"⚠️ Event manager error "
                        f"camera {self.camera_id}: "
                        f"{error}"
                    )

                    events = []

                # ============================================
                # STORE + ALERT EVENTS
                # ============================================

                for event_data in events:

                    try:
                        self._store_event(
                            event_data
                        )
                    except Exception as error:
                        print(
                            f"⚠️ Event storage error: "
                            f"{error}"
                        )

                # ============================================
                # FILE PLAYBACK TIMING
                # ============================================

                self._control_file_playback(
                    next_frame_time
                )

                next_frame_time = (
                    self._next_frame_time(
                        next_frame_time
                    )
                )

        except Exception as error:

            self.last_error = str(error)

            print()
            print(
                f"❌ AI worker error "
                f"camera {self.camera_id}:"
            )
            print(error)

        finally:

            if camera is not None:

                try:
                    camera.release()
                except Exception:
                    pass

            with self.capture_lock:
                self.capture = None

            self.running = False

            with self.frame_condition:
                self.frame_condition.notify_all()

            if self.status != "OFFLINE":
                self.status = "STOPPED"

            print(
                f"🛑 AI worker released "
                f"camera {self.camera_id}"
            )


    # ========================================================
    # FILE PLAYBACK CONTROL
    # ========================================================

    def _control_file_playback(
        self,
        target_time,
    ):

        if self.source_type != "FILE":
            return

        fps = getattr(
            self,
            "file_fps",
            DEFAULT_FILE_FPS,
        )

        if fps <= 0:
            fps = DEFAULT_FILE_FPS

        frame_duration = 1.0 / fps

        now = time.monotonic()

        sleep_time = target_time - now

        if sleep_time > 0:
            time.sleep(sleep_time)


    def _next_frame_time(
        self,
        previous_time,
    ):

        if self.source_type != "FILE":
            return time.monotonic()

        fps = getattr(
            self,
            "file_fps",
            DEFAULT_FILE_FPS,
        )

        if fps <= 0:
            fps = DEFAULT_FILE_FPS

        return previous_time + (
            1.0 / fps
        )


    # ========================================================
    # STORE EVENT
    # ========================================================

    def _store_event(
        self,
        event_data,
    ):

        if not isinstance(
            event_data,
            dict,
        ):
            return

        event_type = event_data.get(
            "type",
            "UNKNOWN",
        )

        event = event_data.get(
            "event",
            {},
        )

        if not isinstance(
            event,
            dict,
        ):
            return

        # ----------------------------------------------------
        # Convert datetime values
        # ----------------------------------------------------

        event_copy = dict(event)

        for field in (
            "first_seen",
            "last_seen",
            "ended_at",
            "timestamp",
        ):

            value = event_copy.get(
                field
            )

            if isinstance(
                value,
                datetime,
            ):
                event_copy[field] = (
                    value.isoformat()
                )

        stored_event = {

            "id":
                self.total_events + 1,

            "type":
                event_type,

            "camera_id":
                self.camera_id,

            "camera_name":
                self.camera_name,

            "location":
                self.location,

            "event":
                event_copy,

            "timestamp":
                datetime.now().isoformat(),
        }

        self.recent_events.insert(
            0,
            stored_event,
        )

        self.total_events += 1

        # ----------------------------------------------------
        # Limit memory
        # ----------------------------------------------------

        self.recent_events = (
            self.recent_events[
                :MAX_STORED_EVENTS
            ]
        )

        # ----------------------------------------------------
        # ALERT MANAGER
        # ----------------------------------------------------

        try:

            process_ai_event(

                camera_id=self.camera_id,

                camera_name=self.camera_name,

                location=self.location,

                event_type=event_type,

                object_type=event_copy.get(
                    "object_type",
                    "unknown",
                ),

                track_id=event_copy.get(
                    "track_id"
                ),

                confidence=event_copy.get(
                    "confidence"
                ),

                custom_title=event_copy.get(
                    "title"
                ),

                custom_message=event_copy.get(
                    "message"
                ),

                severity=event_copy.get(
                    "severity"
                ),

                metadata=event_copy,
            )

        except Exception as error:

            print(
                f"⚠️ Alert manager error "
                f"camera {self.camera_id}: "
                f"{error}"
            )

        # ----------------------------------------------------
        # CONSOLE
        # ----------------------------------------------------

        if event_type == "EVENT_STARTED":

            print()
            print("🟢 AI EVENT STARTED")
            print(
                f"   Camera: {self.camera_name}"
            )
            print(
                f"   Track ID: "
                f"{event_copy.get('track_id')}"
            )
            print(
                f"   Object: "
                f"{event_copy.get('object_type')}"
            )
            print(
                f"   Category: "
                f"{event_copy.get('category')}"
            )
            print(
                f"   Confidence: "
                f"{event_copy.get('confidence', 0):.2f}"
                if isinstance(
                    event_copy.get("confidence"),
                    (int, float),
                )
                else
                f"   Confidence: "
                f"{event_copy.get('confidence', 0)}"
            )

        elif event_type == "EVENT_ENDED":

            print()
            print("🔵 AI EVENT ENDED")
            print(
                f"   Camera: {self.camera_name}"
            )
            print(
                f"   Track ID: "
                f"{event_copy.get('track_id')}"
            )


    # ========================================================
    # AI PROCESSED MJPEG STREAM
    # ========================================================

    def generate_ai_stream(self):

        """
        Continuously yields the latest processed frame
        as an MJPEG stream.

        The dashboard <img> element can display this as
        a live video-like feed.
        """

        last_sent_frame_number = -1

        while self.running:

            # ------------------------------------------------
            # WAIT FOR A NEW FRAME
            # ------------------------------------------------

            with self.frame_condition:

                if (
                    self.frame_number
                    == last_sent_frame_number
                ):
                    self.frame_condition.wait(
                        timeout=1.0
                    )

            if not self.running:
                break

            frame = self.last_frame

            if frame is None:
                time.sleep(0.05)
                continue

            current_frame_number = (
                self.frame_number
            )

            # ------------------------------------------------
            # Copy frame safely
            # ------------------------------------------------

            try:
                output = frame.copy()
            except Exception:
                continue

            frame_h, frame_w = output.shape[:2]

            # ------------------------------------------------
            # 1. DRAW VIRTUAL FENCE ZONES
            # ------------------------------------------------
            try:
                zones = fence_engine.get_zones_for_camera(self.camera_id)
                if zones:
                    zone_overlay = output.copy()
                    breached_zone_ids = {
                        i.get("zone_id") for i in self.active_intrusions
                    }

                    for z in zones:
                        pts = [
                            [int(px * frame_w), int(py * frame_h)]
                            for px, py in z.get("points", [])
                        ]
                        if len(pts) >= 3:
                            pts_arr = np.array(pts, np.int32).reshape((-1, 1, 2))
                            is_breached = z.get("id") in breached_zone_ids
                            zone_color = (0, 0, 255) if is_breached else (0, 165, 255)

                            cv2.fillPoly(zone_overlay, [pts_arr], zone_color)
                            cv2.polylines(output, [pts_arr], True, zone_color, 2)

                            # Label first point
                            lx, ly = pts[0]
                            tag_text = f"ZONE: {z.get('name', 'Restricted')}"
                            if is_breached:
                                tag_text = f"⚠️ INTRUSION: {z.get('name', '')}"
                            cv2.putText(
                                output,
                                tag_text,
                                (lx + 5, max(ly - 5, 20)),
                                cv2.FONT_HERSHEY_SIMPLEX,
                                0.5,
                                zone_color,
                                1,
                            )

                    cv2.addWeighted(zone_overlay, 0.18, output, 0.82, 0, output)
            except Exception as zone_draw_err:
                pass

            # ------------------------------------------------
            # 2. DRAW TRACKED OBJECTS WITH SIH BADGES
            # ------------------------------------------------
            tracks = self.latest_tracks if self.latest_tracks else []
            intrusive_tids = {i.get("track_id") for i in self.active_intrusions}

            # If no tracks yet, fallback to raw detections
            items_to_draw = tracks if tracks else self.latest_detections

            for item in items_to_draw:
                if not isinstance(item, dict):
                    continue

                bbox = item.get("bbox")
                if not bbox or len(bbox) != 4:
                    continue

                try:
                    x1, y1, x2, y2 = map(int, bbox)
                except Exception:
                    continue

                track_id = item.get("track_id")
                object_name = item.get(
                    "object_type", item.get("class_name", "object")
                ).lower()
                confidence = float(item.get("confidence", 0.0))

                # Default colors
                box_color = (0, 255, 0)
                primary_label = f"{object_name.upper()} #{track_id if track_id else ''} {confidence*100:.0f}%"
                secondary_label = None

                # Threat check: Is track in an active virtual fence intrusion?
                if track_id and track_id in intrusive_tids:
                    box_color = (0, 0, 255)
                    secondary_label = "⛔ INTRUSION BREACH"

                # Check Face Recognition (for Person)
                face_data = item.get("face") or (
                    self.recognized_faces.get(track_id) if track_id else None
                )
                if face_data:
                    if face_data.get("is_known"):
                        box_color = (0, 255, 128)
                        primary_label = f"ID: {face_data.get('name', '').upper()}"
                        secondary_label = f"ROLE: {face_data.get('role', 'Staff')}"
                    else:
                        box_color = (0, 220, 255)
                        primary_label = "ID: UNKNOWN PERSON"

                # Check ANPR (for Vehicle)
                plate_num = item.get("plate_number")
                if not plate_num and track_id:
                    confirmed_p = anpr_manager.get_plate(track_id)
                    if confirmed_p:
                        plate_num = confirmed_p.get("plate_number")
                        plate_cat = confirmed_p.get("category", "UNKNOWN")
                    else:
                        plate_cat = item.get("plate_category", "UNKNOWN")
                else:
                    plate_cat = item.get("plate_category", "UNKNOWN")

                if plate_num:
                    if plate_cat in {"SUSPICIOUS", "STOLEN", "RESTRICTED"}:
                        box_color = (0, 0, 255)
                        primary_label = f"🚨 {plate_num} [{plate_cat}]"
                    elif plate_cat == "ALLOWED":
                        box_color = (0, 255, 0)
                        primary_label = f"🚗 {plate_num} [ALLOWED]"
                    else:
                        box_color = (0, 215, 255)
                        primary_label = f"🚗 {plate_num} [UNREGISTERED]"

                # Bounding box
                cv2.rectangle(output, (x1, y1), (x2, y2), box_color, 2)

                # Primary label background pill
                label_y = max(y1 - 8, 20)
                (lw, lh), _ = cv2.getTextSize(
                    primary_label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1
                )
                cv2.rectangle(
                    output,
                    (x1, label_y - lh - 4),
                    (x1 + lw + 6, label_y + 2),
                    (10, 15, 20),
                    -1,
                )
                cv2.putText(
                    output,
                    primary_label,
                    (x1 + 3, label_y - 2),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    box_color,
                    1,
                )

                # Secondary label if present
                if secondary_label:
                    sec_y = min(y2 + 16, frame_h - 5)
                    (sw, sh), _ = cv2.getTextSize(
                        secondary_label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1
                    )
                    cv2.rectangle(
                        output,
                        (x1, sec_y - sh - 2),
                        (x1 + sw + 4, sec_y + 2),
                        (10, 15, 20),
                        -1,
                    )
                    cv2.putText(
                        output,
                        secondary_label,
                        (x1 + 2, sec_y - 1),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.45,
                        box_color,
                        1,
                    )

            # ------------------------------------------------
            # 3. TACTICAL HUD HEADER BAR
            # ------------------------------------------------
            hud_overlay = output.copy()
            cv2.rectangle(hud_overlay, (0, 0), (frame_w, 38), (10, 15, 20), -1)
            cv2.addWeighted(hud_overlay, 0.75, output, 0.25, 0, output)

            # Left telemetry
            hud_left = (
                f"AVEKSHA NETRA | CAM-{self.camera_id:03d} | "
                f"TRACKS: {len(tracks)}"
            )
            cv2.putText(
                output,
                hud_left,
                (12, 24),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 255, 180),
                1,
            )

            # Right telemetry: Night mode & Intrusions
            right_parts = []
            if self.night_mode:
                right_parts.append(f"🌙 NIGHT MODE (LUX: {self.luminance:.0f})")
            if self.active_intrusions:
                right_parts.append(f"🚨 {len(self.active_intrusions)} INTRUSION")

            if right_parts:
                hud_right = " | ".join(right_parts)
                (rw, _), _ = cv2.getTextSize(
                    hud_right, cv2.FONT_HERSHEY_SIMPLEX, 0.52, 1
                )
                cv2.putText(
                    output,
                    hud_right,
                    (max(10, frame_w - rw - 15), 24),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.52,
                    (0, 80, 255) if self.active_intrusions else (0, 220, 255),
                    2 if self.active_intrusions else 1,
                )

            # ------------------------------------------------
            # ENCODE JPEG
            # ------------------------------------------------

            try:

                success, buffer = cv2.imencode(
                    ".jpg",
                    output,
                    [
                        int(cv2.IMWRITE_JPEG_QUALITY),
                        80,
                    ],
                )

            except Exception:

                success, buffer = cv2.imencode(
                    ".jpg",
                    output,
                )

            if not success:
                continue

            frame_bytes = buffer.tobytes()

            last_sent_frame_number = (
                current_frame_number
            )

            # ------------------------------------------------
            # MJPEG FRAME
            # ------------------------------------------------

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: "
                + str(len(frame_bytes)).encode()
                + b"\r\n\r\n"
                + frame_bytes
                + b"\r\n"
            )


    # ========================================================
    # STATUS
    # ========================================================

    def get_status(self):

        return {

            "camera_id":
                self.camera_id,

            "camera_name":
                self.camera_name,

            "location":
                self.location,

            "running":
                self.running,

            "status":
                self.status,

            "source_type":
                self.source_type,

            "frame_number":
                self.frame_number,

            "frame_count":
                self.frame_number,

            "total_detections":
                self.total_detections,

            "total_events":
                self.total_events,

            "active_tracks":
                len(
                    self.latest_tracks
                ),

            "last_update":
                (
                    self.last_update.isoformat()
                    if self.last_update
                    else None
                ),

            "last_error":
                self.last_error,

            "events":
                self.recent_events,
        }


    # ========================================================
    # EVENTS
    # ========================================================

    def get_events(self):

        return list(
            self.recent_events
        )


    # ========================================================
    # TRACKS
    # ========================================================

    def get_tracks(self):

        return list(
            self.latest_tracks
        )


    # ========================================================
    # DETECTIONS
    # ========================================================

    def get_detections(self):

        return list(
            self.latest_detections
        )


# ============================================================
# START CAMERA AI
# ============================================================

def start_camera_ai(
    camera_id,
    source,
    source_type,
    camera_name="Camera",
    location="Unknown",
):

    with workers_lock:

        existing = workers.get(
            camera_id
        )

        # ----------------------------------------------------
        # Already running
        # ----------------------------------------------------

        if existing and existing.running:

            return existing

        # ----------------------------------------------------
        # Remove old worker
        # ----------------------------------------------------

        if existing:

            try:
                existing.stop()
            except Exception:
                pass

            workers.pop(
                camera_id,
                None,
            )

        # ----------------------------------------------------
        # Create worker
        # ----------------------------------------------------

        worker = CameraAIWorker(

            camera_id=camera_id,

            source=source,

            source_type=source_type,

            camera_name=camera_name,

            location=location,
        )

        workers[
            camera_id
        ] = worker

        worker.start()

        return worker


# ============================================================
# STOP CAMERA AI
# ============================================================

def stop_camera_ai(
    camera_id
):

    with workers_lock:

        worker = workers.get(
            camera_id
        )

        if not worker:
            return False

        worker.stop()

        return True


# ============================================================
# REMOVE CAMERA AI
# ============================================================

def remove_camera_ai(
    camera_id
):

    with workers_lock:

        worker = workers.get(
            camera_id
        )

        if not worker:
            return False

        worker.stop()

        workers.pop(
            camera_id,
            None,
        )

        return True


# ============================================================
# GET CAMERA AI
# ============================================================

def get_camera_ai(
    camera_id
):

    with workers_lock:

        return workers.get(
            camera_id
        )


# ============================================================
# GET ALL AI WORKERS
# ============================================================

def get_all_ai_status():

    with workers_lock:

        return [
            worker.get_status()
            for worker in workers.values()
        ]


# ============================================================
# GET CAMERA EVENTS
# ============================================================

def get_camera_events(
    camera_id
):

    worker = get_camera_ai(
        camera_id
    )

    if not worker:
        return []

    return worker.get_events()


# ============================================================
# GET CAMERA TRACKS
# ============================================================

def get_camera_tracks(
    camera_id
):

    worker = get_camera_ai(
        camera_id
    )

    if not worker:
        return []

    return worker.get_tracks()


# ============================================================
# GET CAMERA DETECTIONS
# ============================================================

def get_camera_detections(
    camera_id
):

    worker = get_camera_ai(
        camera_id
    )

    if not worker:
        return []

    return worker.get_detections()


# ============================================================
# ACTIVE EVENT COUNT
# ============================================================

def get_active_event_count():

    total = 0

    with workers_lock:

        for worker in workers.values():

            for item in worker.get_events():

                event = item.get(
                    "event",
                    {},
                )

                status = event.get(
                    "status"
                )

                if status == "ACTIVE":

                    total += 1

    return total


# ============================================================
# TOTAL EVENT COUNT
# ============================================================

def get_total_event_count():

    total = 0

    with workers_lock:

        for worker in workers.values():

            total += len(
                worker.get_events()
            )

    return total


# ============================================================
# STOP ALL AI
# ============================================================

def stop_all_ai():

    with workers_lock:

        workers_list = list(
            workers.values()
        )

    for worker in workers_list:

        try:

            worker.stop()

        except Exception as error:

            print(
                f"❌ Error stopping "
                f"camera {worker.camera_id}: "
                f"{error}"
            )

    with workers_lock:

        workers.clear()

    print(
        "🛑 All AI workers stopped"
    )


# ============================================================
# AI SUMMARY
# ============================================================

def get_ai_summary():

    with workers_lock:

        workers_list = list(
            workers.values()
        )

    return {

        "total_workers":
            len(workers_list),

        "online_workers":
            sum(
                1
                for worker in workers_list
                if worker.running
            ),

        "active_events":
            get_active_event_count(),

        "total_events":
            get_total_event_count(),

        "workers":
            [
                worker.get_status()
                for worker in workers_list
            ],
    }
