import cv2
import os
import time

from detector import analyze_frame
from tracker import ObjectTracker
from event_manager import EventManager
from anpr_manager import ANPRManager


# ============================================================
# AVEKSHA NETRA
# AI PIPELINE TEST
#
# CCTV
#   ↓
# YOLO Detection
#   ↓
# Object Tracking
#   ↓
# Event Management
#   ↓
# ANPR
#   ↓
# Plate Confirmation
# ============================================================


# ============================================================
# CONFIGURATION
# ============================================================

VIDEO_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "test_media",
        "test.mp4"
    )
)

CAMERA_ID = 1

DETECTION_CONFIDENCE = 0.40

MAX_TRACK_DISTANCE = 120

MAX_MISSING_FRAMES = 36

MIN_CONFIRMATIONS = 2


# ============================================================
# ANPR CONFIGURATION
# ============================================================

ANPR_PROCESS_EVERY = 10

ANPR_MIN_OBSERVATIONS = 3

ANPR_MIN_CONFIDENCE = 0.40


# ============================================================
# OPEN CCTV VIDEO
# ============================================================

print()
print("======================================")
print("🛡️ AVEKSHA NETRA AI PIPELINE")
print("======================================")

print()
print("🎥 Opening CCTV video...")


camera = cv2.VideoCapture(
    VIDEO_PATH
)


if not camera.isOpened():

    print(
        "❌ Could not open video:"
    )

    print(
        VIDEO_PATH
    )

    raise SystemExit


# ============================================================
# VIDEO INFORMATION
# ============================================================

fps = camera.get(
    cv2.CAP_PROP_FPS
)

total_frames = int(
    camera.get(
        cv2.CAP_PROP_FRAME_COUNT
    )
)


video_duration = (

    total_frames / fps

    if fps > 0

    else 0
)


print(
    f"✅ Video opened"
)

print(
    f"   FPS: {fps:.2f}"
)

print(
    f"   Frames: {total_frames}"
)

print(
    f"   Duration: "
    f"{video_duration:.1f} seconds"
)


# ============================================================
# CREATE AI COMPONENTS
# ============================================================

print()
print("🤖 Initializing AI components...")


tracker = ObjectTracker(

    max_distance=MAX_TRACK_DISTANCE,

    max_missing=MAX_MISSING_FRAMES,

    min_confirmations=MIN_CONFIRMATIONS
)


event_manager = EventManager(

    end_after_missing_frames=MAX_MISSING_FRAMES

)


anpr_manager = ANPRManager(

    process_every_n_frames=ANPR_PROCESS_EVERY,

    minimum_observations=ANPR_MIN_OBSERVATIONS,

    minimum_confidence=ANPR_MIN_CONFIDENCE

)


print(
    "✅ AI components ready"
)


# ============================================================
# PROCESSING VARIABLES
# ============================================================

frame_number = 0

start_time = time.time()

last_progress = -1


# ============================================================
# MAIN PROCESSING LOOP
# ============================================================

try:

    while True:

        # ----------------------------------------------------
        # READ FRAME
        # ----------------------------------------------------

        success, frame = camera.read()


        if not success:

            print()
            print(
                "⏹️ CCTV video finished."
            )

            break


        frame_number += 1


        # ====================================================
        # AI DETECTION
        # ====================================================

        analysis = analyze_frame(

            frame,

            confidence=DETECTION_CONFIDENCE

        )


        detections = analysis.get(
            "detections",
            []
        )


        # ====================================================
        # OBJECT TRACKING
        # ====================================================

        tracker.update(
            detections
        )


        tracks = (
            tracker.get_confirmed_tracks()
        )


        # ====================================================
        # EVENT MANAGEMENT
        # ====================================================

        events = (
            event_manager.process_tracks(

                tracks,

                CAMERA_ID

            )
        )


        # ====================================================
        # ANPR
        #
        # Runs only periodically instead of every frame.
        # ====================================================

        plate_results = (
            anpr_manager.process(

                frame,

                tracks

            )
        )


        # ====================================================
        # ATTACH CONFIRMED PLATES TO EVENTS
        # ====================================================

        for plate_result in plate_results:

            track_id = (
                plate_result["track_id"]
            )

            plate_number = (
                plate_result["plate_number"]
            )

            plate_confidence = (
                plate_result["confidence"]
            )


            # ------------------------------------------------
            # Attach plate to active event
            # ------------------------------------------------

            attached = (
                event_manager.attach_plate(

                    track_id,

                    plate_number,

                    plate_confidence

                )
            )


            if attached:

                print()

                print(
                    "🔢 PLATE CONFIRMED"
                )

                print(
                    f"   Camera: "
                    f"CAM-{CAMERA_ID:03d}"
                )

                print(
                    f"   Track ID: "
                    f"{track_id}"
                )

                print(
                    f"   Plate: "
                    f"{plate_number}"
                )

                print(
                    f"   Confidence: "
                    f"{plate_confidence:.2f}"
                )


        # ====================================================
        # DISPLAY EVENTS
        # ====================================================

        for event in events:

            event_type = (
                event["type"]
            )

            data = (
                event["event"]
            )


            # =================================================
            # EVENT STARTED
            # =================================================

            if event_type == "EVENT_STARTED":

                print()

                print(
                    "🟢 EVENT STARTED"
                )

                print(
                    f"   Camera: "
                    f"CAM-{CAMERA_ID:03d}"
                )

                print(
                    f"   Track ID: "
                    f"{data['track_id']}"
                )

                print(
                    f"   Object: "
                    f"{data['object_type']}"
                )

                print(
                    f"   Category: "
                    f"{data['category']}"
                )

                print(
                    f"   Confidence: "
                    f"{data['confidence']:.2f}"
                )

                print(
                    f"   First Seen: "
                    f"{data['first_seen'].strftime('%H:%M:%S')}"
                )


            # =================================================
            # EVENT ENDED
            # =================================================

            elif event_type == "EVENT_ENDED":

                print()

                print(
                    "🔵 EVENT ENDED"
                )

                print(
                    f"   Camera: "
                    f"CAM-{CAMERA_ID:03d}"
                )

                print(
                    f"   Track ID: "
                    f"{data['track_id']}"
                )

                print(
                    f"   Object: "
                    f"{data['object_type']}"
                )

                print(
                    f"   Category: "
                    f"{data['category']}"
                )


                # ------------------------------------------------
                # Duration
                # ------------------------------------------------

                duration_seconds = (
                    data.get(
                        "duration_seconds"
                    )
                )


                if duration_seconds is not None:

                    print(
                        f"   Duration: "
                        f"{duration_seconds:.1f} seconds"
                    )


                # ------------------------------------------------
                # First seen
                # ------------------------------------------------

                print(
                    f"   First Seen: "
                    f"{data['first_seen'].strftime('%H:%M:%S')}"
                )


                # ------------------------------------------------
                # Last seen
                # ------------------------------------------------

                if data.get(
                    "ended_at"
                ):

                    print(
                        f"   Last Seen: "
                        f"{data['ended_at'].strftime('%H:%M:%S')}"
                    )


                # ------------------------------------------------
                # NUMBER PLATE
                # ------------------------------------------------

                plate = data.get(
                    "plate_number"
                )


                if plate:

                    print(
                        f"   Plate: "
                        f"{plate}"
                    )


                    if data.get(
                        "plate_confidence"
                    ) is not None:

                        print(
                            f"   Plate Confidence: "
                            f"{data['plate_confidence']:.2f}"
                        )


                else:

                    print(
                        "   Plate: "
                        "Not available"
                    )


        # ====================================================
        # PROGRESS
        # ====================================================

        progress = (

            frame_number
            /
            total_frames

        ) * 100


        progress_bucket = int(
            progress
        )


        if (

            progress_bucket
            !=
            last_progress

            and

            progress_bucket % 10 == 0

        ):

            print(
                f"📊 Processing: "
                f"{progress:.1f}%"
            )

            last_progress = (
                progress_bucket
            )


finally:

    # ========================================================
    # RELEASE VIDEO
    # ========================================================

    camera.release()


# ============================================================
# PROCESSING TIME
# ============================================================

elapsed = (
    time.time()
    - start_time
)


# ============================================================
# FINAL EVENTS
# ============================================================

completed_events = (
    event_manager
    .get_completed_events()
)


active_events = (
    event_manager
    .get_active_events()
)


# ============================================================
# FINAL SUMMARY
# ============================================================

print()

print(
    "======================================"
)

print(
    "🛡️ AVEKSHA NETRA AI SUMMARY"
)

print(
    "======================================"
)

print(
    f"Frames processed: "
    f"{frame_number}"
)

print(
    f"Events completed: "
    f"{len(completed_events)}"
)

print(
    f"Events still active: "
    f"{len(active_events)}"
)

print(
    f"Processing time: "
    f"{elapsed:.1f} seconds"
)


if elapsed > 0:

    processing_fps = (

        frame_number
        /
        elapsed

    )

    print(
        f"Processing speed: "
        f"{processing_fps:.2f} FPS"
    )


print(
    "======================================"
)

print(
    "✅ AI pipeline test completed"
)

print(
    "======================================"
)