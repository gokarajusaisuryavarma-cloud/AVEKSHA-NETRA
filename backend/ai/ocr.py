import re
import cv2
import easyocr


# --------------------------------------------------
# AVEKSHA NETRA - ANPR OCR ENGINE
# --------------------------------------------------

print("🔤 Loading ANPR OCR Engine...")


reader = easyocr.Reader(
    ["en"],
    gpu=False
)


print("✅ ANPR OCR Engine ready")


# --------------------------------------------------
# CLEAN PLATE TEXT
# --------------------------------------------------

def clean_plate_text(text):

    text = text.upper()

    text = re.sub(
        r"[^A-Z0-9]",
        "",
        text
    )

    return text


# --------------------------------------------------
# READ NUMBER PLATE
# --------------------------------------------------

def read_plate(plate_image):

    if plate_image is None:
        return None


    if plate_image.size == 0:
        return None


    # Convert to grayscale

    gray = cv2.cvtColor(
        plate_image,
        cv2.COLOR_BGR2GRAY
    )


    # Improve contrast

    gray = cv2.resize(
        gray,
        None,
        fx=2,
        fy=2,
        interpolation=cv2.INTER_CUBIC
    )


    results = reader.readtext(
        gray,
        detail=1
    )


    candidates = []


    for result in results:

        detected_text = result[1]

        confidence = float(
            result[2]
        )


        cleaned = clean_plate_text(
            detected_text
        )


        if cleaned:

            candidates.append({

                "text": cleaned,

                "confidence":
                    confidence

            })


    if not candidates:

        return None


    # Highest-confidence OCR result

    best = max(
        candidates,
        key=lambda item:
        item["confidence"]
    )


    return best
