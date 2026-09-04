import cv2
import os
import threading
import time
from datetime import datetime

from .detector import analyze_frame
from .tracker import ObjectTracker
from .event_manager import EventManager
from .alert_manager import process_ai_event


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

            # ------------------------------------------------
            # DRAW DETECTION BOXES
            # ------------------------------------------------

            detections = (
                self.latest_detections
            )

            if detections is None:
                detections = []

            for detection in detections:

                if not isinstance(
                    detection,
                    dict,
                ):
                    continue

                bbox = detection.get(
                    "bbox"
                )

                if not bbox:
                    continue

                if len(bbox) != 4:
                    continue

                try:

                    x1, y1, x2, y2 = map(
                        int,
                        bbox,
                    )

                except Exception:
                    continue

                object_name = detection.get(
                    "class_name",
                    detection.get(
                        "object_type",
                        "object",
                    ),
                )

                confidence = detection.get(
                    "confidence",
                    0,
                )

                try:
                    confidence = float(
                        confidence
                    )
                except Exception:
                    confidence = 0.0

                label = (
                    f"{str(object_name).upper()} "
                    f"{confidence * 100:.0f}%"
                )

                # Bounding box
                cv2.rectangle(
                    output,
                    (x1, y1),
                    (x2, y2),
                    (0, 255, 0),
                    2,
                )

                # Label
                cv2.putText(
                    output,
                    label,
                    (
                        x1,
                        max(
                            y1 - 10,
                            20,
                        ),
                    ),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 0),
                    2,
                )

            # ------------------------------------------------
            # STATUS OVERLAY
            # ------------------------------------------------

            status_text = (
                f"AVEKSHA NETRA | "
                f"CAM {self.camera_id} | "
                f"FRAME {current_frame_number}"
            )

            cv2.putText(
                output,
                status_text,
                (15, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (0, 255, 0),
                2,
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
