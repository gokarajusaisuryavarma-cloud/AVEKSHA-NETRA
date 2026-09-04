import os
from ultralytics import YOLO


# ============================================================
# AVEKSHA NETRA
# AI OBJECT DETECTOR
# ============================================================

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "yolo11n.pt"
)

print("🤖 Loading YOLO detection model...")
print(f"📦 Model: {MODEL_PATH}")

model = YOLO(MODEL_PATH)

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

def analyze_frame(frame, confidence=0.40):

    if frame is None:
        return {
            "detections": [],
            "count": 0
        }

    results = model.predict(
        source=frame,
        conf=confidence,
        verbose=False
    )

    detections = []

    for result in results:

        boxes = result.boxes

        if boxes is None:
            continue

        for box in boxes:

            x1, y1, x2, y2 = box.xyxy[0].tolist()

            detection_confidence = float(box.conf[0])

            class_id = int(box.cls[0])

            class_name = str(model.names[class_id])

            if class_name in PERSON_CLASSES:
                category = "PERSON"

            elif class_name in VEHICLE_CLASSES:
                category = "VEHICLE"

            else:
                category = "OTHER"

            detections.append({
                "class_name": class_name,
                "object_type": class_name,
                "category": category,
                "confidence": detection_confidence,
                "bbox": [
                    int(x1),
                    int(y1),
                    int(x2),
                    int(y2)
                ]
            })

    return {
        "detections": detections,
        "count": len(detections)
    }