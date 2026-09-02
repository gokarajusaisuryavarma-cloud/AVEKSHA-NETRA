import cv2
import os
import threading
import time

from detector import analyze_frame
from tracker import ObjectTracker
from event_manager import EventManager


# ============================================================
# AVEKSHA NETRA
# LIVE AI SERVICE
#
# CAMERA
#   ↓
# OpenCV
#   ↓
# YOLO
#   ↓
# TRACKER
#   ↓
# EVENT MANAGER
#   ↓
# DASHBOARD
# ============================================================


# ============================================================
# CONFIGURATION
# ============================================================

DETECTION_CONFIDENCE = 0.40

MAX_TRACK_DISTANCE = 120

MAX_MISSING_FRAMES = 36

MIN_CONFIRMATIONS = 2

PROCESS_EVERY_N_FRAMES = 2

MAX_STORED_EVENTS = 100


# ============================================================
# GLOBAL CAMERA WORKERS
# ============================================================

workers = {}

workers_lock = threading.Lock()


# ============================================================
# CAMERA AI WORKER
# ============================================================

class CameraAIWorker:

    def __init__(
        self,
        camera_id,
        source,
        source_type
    ):

        self.camera_id = camera_id

        self.source = source

        self.source_type = source_type

        self.running = False

        self.thread = None

        self.frame_number = 0

        self.last_error = None

        self.latest_tracks = []

        self.recent_events = []

        self.tracker = ObjectTracker(

            max_distance=MAX_TRACK_DISTANCE,

            max_missing=MAX_MISSING_FRAMES,

            min_confirmations=MIN_CONFIRMATIONS

        )

        self.event_manager = EventManager(

            end_after_missing_frames=
            MAX_MISSING_FRAMES

        )


    # ========================================================
    # START
    # ========================================================

    def start(self):

        if self.running:

            return


        self.running = True

        self.thread = threading.Thread(

            target=self._run,

            daemon=True

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

        print(
            f"🛑 AI stopped for camera "
            f"{self.camera_id}"
        )


    # ========================================================
    # GET SOURCE
    # ========================================================

    def _get_source(self):

        if self.source_type == "FILE":

            video_path = os.path.abspath(

                os.path.join(

                    os.path.dirname(__file__),

                    "test_media",

                    "test.mp4"

                )

            )

            return video_path


        return self.source


    # ========================================================
    # MAIN AI LOOP
    # ========================================================

    def _run(self):

        source = self._get_source()

        print()

        print(
            "======================================"
        )

        print(
            f"🤖 AI WORKER - CAMERA {self.camera_id}"
        )

        print(
            f"Source type: {self.source_type}"
        )

        print(
            f"Source: {source}"
        )

        print(
            "======================================"
        )


        camera = None


        try:

            camera = cv2.VideoCapture(

                source,

                cv2.CAP_FFMPEG

            )


            if not camera.isOpened():

                self.last_error = (
                    "Could not open camera source"
                )

                print(
                    f"❌ AI could not open "
                    f"camera {self.camera_id}"
                )

                return


            print(
                f"✅ AI connected to camera "
                f"{self.camera_id}"
            )


            # =================================================
            # PROCESS FRAMES
            # =================================================

            while self.running:

                success, frame = camera.read()


                # ---------------------------------------------
                # VIDEO ENDED
                # ---------------------------------------------

                if not success:

                    print(
                        f"⏹️ Camera "
                        f"{self.camera_id} "
                        f"stream ended"
                    )

                    break


                self.frame_number += 1


                # ---------------------------------------------
                # Process every Nth frame
                # ---------------------------------------------

                if (
                    self.frame_number
                    %
                    PROCESS_EVERY_N_FRAMES
                    != 0
                ):

                    continue


                # =================================================
                # YOLO DETECTION
                # =================================================

                analysis = analyze_frame(

                    frame,

                    confidence=DETECTION_CONFIDENCE

                )


                detections = analysis.get(

                    "detections",

                    []

                )


                # =================================================
                # TRACKING
                # =================================================

                self.tracker.update(

                    detections

                )


                tracks = (

                    self.tracker
                    .get_confirmed_tracks()

                )


                self.latest_tracks = tracks


                # =================================================
                # EVENT MANAGEMENT
                # =================================================

                events = (

                    self.event_manager
                    .process_tracks(

                        tracks,

                        self.camera_id

                    )

                )


                # =================================================
                # SAVE EVENTS
                # =================================================

                for event_data in events:

                    self._store_event(

                        event_data

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

                camera.release()


            self.running = False


            print(
                f"🛑 AI worker released "
                f"camera {self.camera_id}"
            )


    # ========================================================
    # STORE EVENT
    # ========================================================

    def _store_event(
        self,
        event_data
    ):

        event_type = event_data.get(
            "type"
        )

        event = event_data.get(
            "event"
        )


        if not event:

            return


        # ----------------------------------------------------
        # Convert datetime values to strings
        # ----------------------------------------------------

        first_seen = event.get(
            "first_seen"
        )

        last_seen = event.get(
            "last_seen"
        )

        ended_at = event.get(
            "ended_at"
        )


        event_copy = dict(event)


        if first_seen:

            event_copy["first_seen"] = (
                first_seen.isoformat()
            )


        if last_seen:

            event_copy["last_seen"] = (
                last_seen.isoformat()
            )


        if ended_at:

            event_copy["ended_at"] = (
                ended_at.isoformat()
            )


        stored_event = {

            "type":
                event_type,

            "event":
                event_copy

        }


        self.recent_events.insert(

            0,

            stored_event

        )


        # ----------------------------------------------------
        # Limit memory usage
        # ----------------------------------------------------

        self.recent_events = (

            self.recent_events[
                :MAX_STORED_EVENTS
            ]

        )


        # ----------------------------------------------------
        # Console output
        # ----------------------------------------------------

        if event_type == "EVENT_STARTED":

            print()

            print(
                "🟢 AI EVENT STARTED"
            )

            print(
                f"   Camera: "
                f"{self.camera_id}"
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
            )


        elif event_type == "EVENT_ENDED":

            print()

            print(
                "🔵 AI EVENT ENDED"
            )

            print(
                f"   Camera: "
                f"{self.camera_id}"
            )

            print(
                f"   Track ID: "
                f"{event_copy.get('track_id')}"
            )


    # ========================================================
    # STATUS
    # ========================================================

    def get_status(self):

        return {

            "camera_id":
                self.camera_id,

            "running":
                self.running,

            "source_type":
                self.source_type,

            "frame_number":
                self.frame_number,

            "last_error":
                self.last_error,

            "active_tracks":
                len(self.latest_tracks),

            "events":
                self.recent_events

        }


# ============================================================
# START CAMERA AI
# ============================================================

def start_camera_ai(
    camera_id,
    source,
    source_type
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
        # Create worker
        # ----------------------------------------------------

        worker = CameraAIWorker(

            camera_id=camera_id,

            source=source,

            source_type=source_type

        )


        workers[camera_id] = worker


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
# GET CAMERA AI STATUS
# ============================================================

def get_camera_ai(
    camera_id
):

    with workers_lock:

        worker = workers.get(
            camera_id
        )


        if not worker:

            return None


        return worker


# ============================================================
# GET ALL AI WORKERS
# ============================================================

def get_all_ai_status():

    with workers_lock:

        return [

            worker.get_status()

            for worker in workers.values()

        ]