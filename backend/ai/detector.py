from ultralytics import YOLO


# ============================================================
# AVEKSHA NETRA
# AI OBJECT DETECTOR
# ============================================================

print("🤖 Loading YOLO detection model...")
import os
from ultralytics import YOLO


MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "yolo11n.pt"
)

print("🤖 Loading YOLO detection model...")
print(f"📦 Model: {MODEL_PATH}")

model = YOLO(MODEL_PATH)

print("✅ YOLO detection model ready")

print("✅ YOLO detection model ready")


# ============================================================
# OBJECT CATEGORIES
# ============================================================

PERSON_CLASSES = {
    "person"
}

VEHICLE_CLASSES = {
    "car",
    "motorcycle",
    "bus",
    "truck",
    "bicycle"
}


# ============================================================
# DETECT OBJECTS
# ============================================================

def analyze_frame(
    frame,
    confidence=0.40
):

    if frame is None:

        return {
            "detections": []
        }


    results = model.predict(
        source=frame,
        conf=confidence,
        verbose=False
    )


    detections = []


    # ========================================================
    # PROCESS YOLO RESULTS
    # ========================================================

    for result in results:

        boxes = result.boxes

        if boxes is None:
            continue


        for box in boxes:

            # ------------------------------------------------
            # Bounding box
            # ------------------------------------------------

            x1, y1, x2, y2 = (
                box.xyxy[0].tolist()
            )


            # ------------------------------------------------
            # Confidence
            # ------------------------------------------------

            detection_confidence = float(
                box.conf[0]
            )


            # ------------------------------------------------
            # Class
            # ------------------------------------------------

            class_id = int(
                box.cls[0]
            )

            class_name = str(
                model.names[class_id]
            )


            # ------------------------------------------------
            # Category
            # ------------------------------------------------

            if class_name in PERSON_CLASSES:

                category = "PERSON"

            elif class_name in VEHICLE_CLASSES:

                category = "VEHICLE"

            else:

                category = "OTHER"


            # ------------------------------------------------
            # Detection
            #
            # IMPORTANT:
            # We provide both:
            #
            # class_name
            # object_type
            #
            # because the tracker uses class_name while
            # the event/ANPR system uses object_type.
            # ------------------------------------------------

            detection = {

                "class_name":
                    class_name,

                "object_type":
                    class_name,

                "category":
                    category,

                "confidence":
                    detection_confidence,

                "bbox": [

                    int(x1),
                    int(y1),
                    int(x2),
                    int(y2)

                ]

            }


            detections.append(
                detection
            )


    # ========================================================
    # RETURN
    # ========================================================

    return {

        "detections":
            detections,

        "count":
            len(detections)

    }