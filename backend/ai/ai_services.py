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
# AI SERVICES
#
# Camera
#     ↓
# Video Stream
#     ↓
# YOLO Detector
#     ↓
# Object Tracker
#     ↓
# Event Manager
#     ↓
# Alert Manager
#     ↓
# Dashboard
# ============================================================


# ============================================================
# GLOBAL AI WORKERS
# ============================================================

camera_workers = {}

workers_lock = threading.RLock()


# ============================================================
# CAMERA AI WORKER
# ============================================================

class CameraAIWorker:

    def __init__(
        self,
        camera_id,
        source,
        camera_name="Camera",
        location="Unknown"
    ):

        self.camera_id = camera_id
        self.source = source
        self.camera_name = camera_name
        self.location = location

        # ----------------------------------------------------
        # THREAD STATE
        # ----------------------------------------------------

        self.running = False
        self.thread = None
        self.capture = None

        # ----------------------------------------------------
        # AI COMPONENTS
        # ----------------------------------------------------

        self.tracker = ObjectTracker(
            max_distance=120,
            max_missing=36,
            min_confirmations=2
        )

        self.event_manager = EventManager(
            end_after_missing_frames=36
        )

        # ----------------------------------------------------
        # FRAME STATE
        # ----------------------------------------------------

        self.last_frame = None
        self.last_update = None
        self.frame_count = 0

        # ----------------------------------------------------
        # STATISTICS
        # ----------------------------------------------------

        self.total_detections = 0
        self.total_events = 0

        # ----------------------------------------------------
        # LATEST AI DATA
        # ----------------------------------------------------

        self.latest_detections = []
        self.latest_tracks = []

        # ----------------------------------------------------
        # EVENT STORAGE
        # ----------------------------------------------------

        self.events = []

        # ----------------------------------------------------
        # STATUS
        # ----------------------------------------------------

        self.status = "STOPPED"
        self.error = None

    # ========================================================
    # START
    # ========================================================

    def start(self):

        if self.running:
            return

        self.running = True
        self.status = "STARTING"
        self.error = None

        self.thread = threading.Thread(
            target=self._process_loop,
            daemon=True,
            name=f"AI-Camera-{self.camera_id}"
        )

        self.thread.start()

        print(
            f"🤖 AI started for camera "
            f"{self.camera_id}"
        )

    # ========================================================
    # STOP
    # ========================================================

    def stop(self):

        self.running = False
        self.status = "STOPPING"

        if self.capture is not None:

            try:
                self.capture.release()
            except Exception:
                pass

        if (
            self.thread is not None
            and self.thread.is_alive()
            and self.thread != threading.current_thread()
        ):

            self.thread.join(timeout=2)

        self.status = "STOPPED"

        print(
            f"🛑 AI stopped for camera "
            f"{self.camera_id}"
        )

    # ========================================================
    # VIDEO SOURCE
    # ========================================================

    def _get_source(self):

        if (
            isinstance(self.source, str)
            and self.source.lower().endswith(
                (
                    ".mp4",
                    ".avi",
                    ".mov",
                    ".mkv"
                )
            )
        ):

            return os.path.abspath(self.source)

        return self.source

    # ========================================================
    # OPEN VIDEO
    # ========================================================

    def _open_capture(self):

        source = self._get_source()

        print(
            f"🎥 Opening AI source "
            f"for camera {self.camera_id}:"
        )

        print(source)

        try:

            capture = cv2.VideoCapture(
                source,
                cv2.CAP_FFMPEG
            )

        except Exception:

            capture = cv2.VideoCapture(
                source
            )

        if not capture.isOpened():

            print(
                f"❌ AI could not open "
                f"camera {self.camera_id}"
            )

            self.status = "OFFLINE"

            return None

        print(
            f"✅ AI source connected "
            f"for camera {self.camera_id}"
        )

        return capture

    # ========================================================
    # MAIN AI LOOP
    # ========================================================

    def _process_loop(self):

        self.capture = self._open_capture()

        if self.capture is None:

            self.running = False
            self.status = "OFFLINE"

            return

        self.status = "ONLINE"

        # ====================================================
        # PROCESS VIDEO
        # ====================================================

        while self.running:

            try:

                # ------------------------------------------------
                # READ FRAME
                # ------------------------------------------------

                success, frame = self.capture.read()

                # ------------------------------------------------
                # STREAM ENDED / CONNECTION LOST
                # ------------------------------------------------

                if not success:

                    print(
                        f"⚠️ Camera "
                        f"{self.camera_id} "
                        f"stream ended/lost"
                    )

                    self.status = "RECONNECTING"

                    try:
                        self.capture.release()
                    except Exception:
                        pass

                    if not self.running:
                        break

                    time.sleep(2)

                    self.capture = self._open_capture()

                    if self.capture is None:

                        time.sleep(3)
                        continue

                    self.status = "ONLINE"

                    continue

                # ------------------------------------------------
                # SAVE FRAME
                # ------------------------------------------------

                self.last_frame = frame
                self.last_update = datetime.now()
                self.frame_count += 1

                # =================================================
                # YOLO DETECTION
                # =================================================

                analysis = analyze_frame(
                    frame,
                    confidence=0.40
                )

                if not isinstance(analysis, dict):
                    analysis = {}

                detections = analysis.get(
                    "detections",
                    []
                )

                if detections is None:
                    detections = []

                self.latest_detections = detections

                self.total_detections += len(
                    detections
                )

                # =================================================
                # OBJECT TRACKING
                # =================================================

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

                # =================================================
                # EVENT MANAGEMENT
                # =================================================

                new_events = (
                    self.event_manager
                    .process_tracks(
                        tracks,
                        self.camera_id
                    )
                )

                if new_events is None:
                    new_events = []

                # =================================================
                # PROCESS EVENTS
                # =================================================

                for item in new_events:

                    if not isinstance(item, dict):
                        continue

                    # ------------------------------------------------
                    # EVENT TYPE
                    # ------------------------------------------------

                    event_type = item.get(
                        "type",
                        "UNKNOWN"
                    )

                    # ------------------------------------------------
                    # EVENT DATA
                    # ------------------------------------------------

                    event_data = item.get(
                        "event",
                        {}
                    )

                    if not isinstance(
                        event_data,
                        dict
                    ):

                        event_data = {}

                    # ------------------------------------------------
                    # EVENT INFORMATION
                    # ------------------------------------------------

                    object_type = event_data.get(
                        "object_type",
                        "unknown"
                    )

                    track_id = event_data.get(
                        "track_id"
                    )

                    category = event_data.get(
                        "category"
                    )

                    confidence = event_data.get(
                        "confidence"
                    )

                    event_status = event_data.get(
                        "status",
                        "ACTIVE"
                    )

                    # ------------------------------------------------
                    # CREATE INTERNAL EVENT
                    # ------------------------------------------------

                    event_record = {

                        "id":
                            len(self.events) + 1,

                        "type":
                            event_type,

                        "camera_id":
                            self.camera_id,

                        "camera_name":
                            self.camera_name,

                        "location":
                            self.location,

                        "track_id":
                            track_id,

                        "object_type":
                            object_type,

                        "category":
                            category,

                        "confidence":
                            confidence,

                        "status":
                            event_status,

                        "timestamp":
                            datetime.now().isoformat(),

                        "first_seen":
                            self._serialize_datetime(
                                event_data.get(
                                    "first_seen"
                                )
                            ),

                        "last_seen":
                            self._serialize_datetime(
                                event_data.get(
                                    "last_seen"
                                )
                            ),
                    }

                    self.events.append(
                        event_record
                    )

                    self.total_events += 1

                    # =================================================
                    # ALERT MANAGER
                    #
                    # IMPORTANT:
                    #
                    # EVENT_STARTED
                    #     → CREATE ALERT TICKET
                    #
                    # EVENT_ENDED
                    #     → CLOSE / UPDATE ALERT
                    #
                    # We do NOT create a new alert
                    # for every frame.
                    # =================================================

                    try:

                        process_ai_event(

                            camera_id=self.camera_id,

                            camera_name=self.camera_name,

                            location=self.location,

                            event_type=event_type,

                            object_type=object_type,

                            track_id=track_id

                        )

                    except Exception as alert_error:

                        print(
                            f"⚠️ Alert manager error "
                            f"for camera "
                            f"{self.camera_id}: "
                            f"{alert_error}"
                        )

                    # =================================================
                    # CONSOLE LOG
                    # =================================================

                    print()
                    print("🚨 AI EVENT")

                    print(
                        f"   Camera: "
                        f"{self.camera_name}"
                    )

                    print(
                        f"   Type: "
                        f"{event_type}"
                    )

                    print(
                        f"   Object: "
                        f"{object_type}"
                    )

                    print(
                        f"   Track: "
                        f"{track_id}"
                    )

                    print(
                        f"   Status: "
                        f"{event_status}"
                    )

                    # ------------------------------------------------
                    # LIMIT EVENT MEMORY
                    # ------------------------------------------------

                    if len(self.events) > 500:

                        self.events = (
                            self.events[-500:]
                        )

            # ========================================================
            # AI ERROR
            # ========================================================

            except Exception as error:

                self.error = str(error)

                print()

                print(
                    f"❌ AI error "
                    f"camera {self.camera_id}: "
                    f"{error}"
                )

                time.sleep(1)

        # ========================================================
        # CLEANUP
        # ========================================================

        if self.capture is not None:

            try:
                self.capture.release()
            except Exception:
                pass

        self.capture = None

        self.status = "STOPPED"

    # ========================================================
    # SERIALIZE DATETIME
    # ========================================================

    def _serialize_datetime(self, value):

        if value is None:
            return None

        if isinstance(value, datetime):
            return value.isoformat()

        return str(value)

    # ========================================================
    # AI PROCESSED VIDEO STREAM
    # ========================================================

    def generate_ai_stream(self):

        while True:

            # ------------------------------------------------
            # AI NOT RUNNING
            # ------------------------------------------------

            if not self.running:

                time.sleep(0.2)
                continue

            # ------------------------------------------------
            # GET LAST FRAME
            # ------------------------------------------------

            frame = self.last_frame

            if frame is None:

                time.sleep(0.1)
                continue

            try:

                output = frame.copy()

                # =================================================
                # DRAW DETECTION BOXES
                # =================================================

                for detection in (
                    self.latest_detections
                ):

                    if not isinstance(
                        detection,
                        dict
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

                        x1, y1, x2, y2 = (
                            map(int, bbox)
                        )

                    except Exception:

                        continue

                    # ------------------------------------------------
                    # OBJECT NAME
                    # ------------------------------------------------

                    object_name = detection.get(
                        "class_name",
                        detection.get(
                            "object_type",
                            "object"
                        )
                    )

                    # ------------------------------------------------
                    # CONFIDENCE
                    # ------------------------------------------------

                    confidence = detection.get(
                        "confidence",
                        0
                    )

                    try:

                        confidence = float(
                            confidence
                        )

                    except Exception:

                        confidence = 0

                    # ------------------------------------------------
                    # LABEL
                    # ------------------------------------------------

                    label = (
                        f"{str(object_name).upper()} "
                        f"{confidence * 100:.0f}%"
                    )

                    # ------------------------------------------------
                    # BOUNDING BOX
                    # ------------------------------------------------

                    cv2.rectangle(
                        output,
                        (x1, y1),
                        (x2, y2),
                        (0, 255, 0),
                        2
                    )

                    # ------------------------------------------------
                    # LABEL
                    # ------------------------------------------------

                    cv2.putText(
                        output,
                        label,
                        (
                            x1,
                            max(y1 - 10, 20)
                        ),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (0, 255, 0),
                        2
                    )

                # =================================================
                # ENCODE JPEG
                # =================================================

                success, buffer = (
                    cv2.imencode(
                        ".jpg",
                        output
                    )
                )

                if not success:
                    continue

                frame_bytes = buffer.tobytes()

                # =================================================
                # MJPEG
                # =================================================

                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n"
                    + frame_bytes
                    + b"\r\n"
                )

            except Exception as error:

                print(
                    f"❌ AI stream error: "
                    f"{error}"
                )

                time.sleep(0.1)

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

            "status":
                self.status,

            "running":
                self.running,

            "frame_count":
                self.frame_count,

            "total_detections":
                self.total_detections,

            "total_events":
                self.total_events,

            "last_update":
                (
                    self.last_update.isoformat()
                    if self.last_update
                    else None
                ),

            "error":
                self.error
        }

    # ========================================================
    # EVENTS
    # ========================================================

    def get_events(self):

        return list(
            self.events
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
    camera_name="Camera",
    location="Unknown"
):

    with workers_lock:

        # ----------------------------------------------------
        # EXISTING WORKER
        # ----------------------------------------------------

        if camera_id in camera_workers:

            worker = camera_workers[
                camera_id
            ]

            # ------------------------------------------------
            # ALREADY RUNNING
            # ------------------------------------------------

            if worker.running:
                return worker

            # ------------------------------------------------
            # REMOVE DEAD WORKER
            # ------------------------------------------------

            del camera_workers[
                camera_id
            ]

        # ----------------------------------------------------
        # CREATE WORKER
        # ----------------------------------------------------

        worker = CameraAIWorker(

            camera_id=camera_id,

            source=source,

            camera_name=camera_name,

            location=location

        )

        camera_workers[
            camera_id
        ] = worker

        worker.start()

        return worker


# ============================================================
# STOP CAMERA AI
# ============================================================

def stop_camera_ai(camera_id):

    with workers_lock:

        worker = camera_workers.get(
            camera_id
        )

        if not worker:
            return False

        worker.stop()

        return True


# ============================================================
# REMOVE CAMERA AI
# ============================================================

def remove_camera_ai(camera_id):

    with workers_lock:

        worker = camera_workers.get(
            camera_id
        )

        if not worker:
            return False

        worker.stop()

        del camera_workers[
            camera_id
        ]

        return True


# ============================================================
# GET CAMERA AI
# ============================================================

def get_camera_ai(camera_id):

    with workers_lock:

        return camera_workers.get(
            camera_id
        )


# ============================================================
# GET ALL AI STATUS
# ============================================================

def get_all_ai_status():

    with workers_lock:

        return [

            worker.get_status()

            for worker
            in camera_workers.values()

        ]


# ============================================================
# GET CAMERA EVENTS
# ============================================================

def get_camera_events(camera_id):

    worker = get_camera_ai(
        camera_id
    )

    if not worker:
        return []

    return worker.get_events()


# ============================================================
# GET CAMERA TRACKS
# ============================================================

def get_camera_tracks(camera_id):

    worker = get_camera_ai(
        camera_id
    )

    if not worker:
        return []

    return worker.get_tracks()


# ============================================================
# GET CAMERA DETECTIONS
# ============================================================

def get_camera_detections(camera_id):

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

        for worker in camera_workers.values():

            for event in worker.get_events():

                if event.get(
                    "status"
                ) == "ACTIVE":

                    total += 1

    return total


# ============================================================
# TOTAL EVENT COUNT
# ============================================================

def get_total_event_count():

    total = 0

    with workers_lock:

        for worker in camera_workers.values():

            total += len(
                worker.get_events()
            )

    return total


# ============================================================
# STOP ALL AI
# ============================================================

def stop_all_ai():

    with workers_lock:

        workers = list(
            camera_workers.values()
        )

    # --------------------------------------------------------
    # STOP WORKERS
    # --------------------------------------------------------

    for worker in workers:

        try:

            worker.stop()

        except Exception as error:

            print(
                f"❌ Error stopping "
                f"camera {worker.camera_id}: "
                f"{error}"
            )

    # --------------------------------------------------------
    # CLEAR REGISTRY
    # --------------------------------------------------------

    with workers_lock:

        camera_workers.clear()

    print(
        "🛑 All AI workers stopped"
    )


# ============================================================
# AI SUMMARY
# ============================================================

def get_ai_summary():

    with workers_lock:

        workers = list(
            camera_workers.values()
        )

        return {

            "total_workers":
                len(workers),

            "online_workers":
                sum(
                    1
                    for worker in workers
                    if worker.running
                ),

            "active_events":
                get_active_event_count(),

            "total_events":
                get_total_event_count()
        }