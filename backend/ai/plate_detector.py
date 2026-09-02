import cv2
import re
import easyocr


# ============================================================
# AVEKSHA NETRA
# NUMBER PLATE DETECTION + OCR
# ============================================================


# ============================================================
# LOAD OCR ENGINE
# ============================================================

print("🔤 Loading ANPR OCR engine...")

reader = easyocr.Reader(
    ["en"],
    gpu=False
)

print("✅ ANPR OCR engine ready")


# ============================================================
# CLEAN PLATE TEXT
# ============================================================

def clean_plate_text(text):

    text = text.upper()

    text = re.sub(
        r"[^A-Z0-9]",
        "",
        text
    )

    return text


# ============================================================
# READ NUMBER PLATE
# ============================================================

def read_number_plate(
    plate_image,
    minimum_confidence=0.40
):

    if plate_image is None:
        return None

    if plate_image.size == 0:
        return None


    # --------------------------------------------------------
    # Upscale small image
    # --------------------------------------------------------

    height, width = plate_image.shape[:2]

    if width < 300:

        scale = 300 / width

        plate_image = cv2.resize(
            plate_image,
            None,
            fx=scale,
            fy=scale,
            interpolation=cv2.INTER_CUBIC
        )


    # --------------------------------------------------------
    # OCR
    # --------------------------------------------------------

    results = reader.readtext(
        plate_image,
        detail=1
    )


    best_text = None
    best_confidence = 0.0


    # --------------------------------------------------------
    # Find best OCR result
    # --------------------------------------------------------

    for result in results:

        text = result[1]

        confidence = float(
            result[2]
        )


        if confidence < minimum_confidence:
            continue


        cleaned = clean_plate_text(
            text
        )


        if len(cleaned) < 4:
            continue


        if confidence > best_confidence:

            best_text = cleaned

            best_confidence = confidence


    # --------------------------------------------------------
    # Nothing useful found
    # --------------------------------------------------------

    if best_text is None:
        return None


    return {

        "plate_number":
            best_text,

        "confidence":
            best_confidence
    }


# ============================================================
# READ PLATE FROM VEHICLE
# ============================================================

def read_plate_from_vehicle(
    frame,
    vehicle_bbox
):

    if frame is None:
        return None


    if frame.size == 0:
        return None


    # --------------------------------------------------------
    # Get vehicle bounding box
    # --------------------------------------------------------

    x1, y1, x2, y2 = map(
        int,
        vehicle_bbox
    )


    frame_height, frame_width = (
        frame.shape[:2]
    )


    # --------------------------------------------------------
    # Keep coordinates inside frame
    # --------------------------------------------------------

    x1 = max(
        0,
        min(
            x1,
            frame_width - 1
        )
    )

    y1 = max(
        0,
        min(
            y1,
            frame_height - 1
        )
    )

    x2 = max(
        0,
        min(
            x2,
            frame_width
        )
    )

    y2 = max(
        0,
        min(
            y2,
            frame_height
        )
    )


    # --------------------------------------------------------
    # Invalid bounding box
    # --------------------------------------------------------

    if x2 <= x1 or y2 <= y1:

        return None


    # --------------------------------------------------------
    # Crop vehicle
    # --------------------------------------------------------

    vehicle_crop = frame[
        y1:y2,
        x1:x2
    ]


    if vehicle_crop.size == 0:

        return None


    # --------------------------------------------------------
    # OCR vehicle crop
    #
    # NOTE:
    # This is MVP ANPR.
    #
    # Later we will add a dedicated number-plate
    # localization model before OCR.
    # --------------------------------------------------------

    result = read_number_plate(
        vehicle_crop
    )


    return result