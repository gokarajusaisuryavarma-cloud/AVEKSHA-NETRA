import os
import cv2
import json
import threading
import numpy as np
from datetime import datetime

# ============================================================
# AVEKSHA NETRA
# FACE DETECTION & RECOGNITION ENGINE (YuNet + SFace)
# ============================================================

SIMILARITY_THRESHOLD = 0.363  # SFace standard cosine threshold

WEIGHTS_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        'weights'
    )
)

YUNET_PATH = os.path.join(
    WEIGHTS_DIR,
    'face_detection_yunet_2023mar.onnx'
)

SFACE_PATH = os.path.join(
    WEIGHTS_DIR,
    'face_recognition_sface_2021dec.onnx'
)


class FaceEngine:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(FaceEngine, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if getattr(self, '_initialized', False):
            return

        self._detector = None
        self._recognizer = None
        self._known_faces = []
        self._cache_lock = threading.RLock()
        self._detector_lock = threading.Lock()

        self._load_models()
        self._load_known_faces_from_db()
        self._initialized = True

    def _load_models(self):
        if not os.path.exists(YUNET_PATH) or not os.path.exists(SFACE_PATH):
            print(f'⚠️ Face models not found in {WEIGHTS_DIR}')
            return

        try:
            self._detector = cv2.FaceDetectorYN.create(
                YUNET_PATH,
                '',
                (320, 320),
                score_threshold=0.55,
                nms_threshold=0.3,
                top_k=5000,
            )
            self._recognizer = cv2.FaceRecognizerSF.create(
                SFACE_PATH,
                '',
            )
            print('✅ FaceEngine loaded YuNet & SFace models successfully')
        except Exception as e:
            print(f'❌ FaceEngine error loading models: {e}')

    def _load_known_faces_from_db(self):
        try:
            from app.database import SessionLocal
            from app.models import KnownFace

            db = SessionLocal()
            try:
                records = db.query(KnownFace).all()
                with self._cache_lock:
                    self._known_faces = []
                    for r in records:
                        try:
                            feat_list = json.loads(r.embedding)
                            feat_arr = np.array(feat_list, dtype=np.float32).reshape(1, 128)
                            self._known_faces.append({
                                'id': r.id,
                                'name': r.name,
                                'role': r.role,
                                'department': r.department,
                                'feature': feat_arr,
                            })
                        except Exception as parse_err:
                            print(f'⚠️ Error parsing embedding for face {r.name}: {parse_err}')
                print(f'✅ FaceEngine loaded {len(self._known_faces)} registered faces into cache')
            finally:
                db.close()
        except Exception as e:
            print(f'⚠️ FaceEngine DB load note: {e}')

    def reload_cache(self):
        self._load_known_faces_from_db()

    def detect_faces(self, image_bgr, min_size=20):
        if self._detector is None or image_bgr is None or image_bgr.size == 0:
            return []

        h, w = image_bgr.shape[:2]
        if h < min_size or w < min_size:
            return []

        with self._detector_lock:
            try:
                self._detector.setInputSize((w, h))
                _, faces = self._detector.detect(image_bgr)
                if faces is None or len(faces) == 0:
                    return []
                return faces
            except Exception as e:
                print(f'⚠️ Face detection error: {e}')
                return []

    def extract_feature(self, image_bgr, face_row):
        if self._recognizer is None or image_bgr is None:
            return None

        try:
            aligned_face = self._recognizer.alignCrop(image_bgr, face_row)
            if aligned_face is None or aligned_face.size == 0:
                return None
            feature = self._recognizer.feature(aligned_face)
            return feature
        except Exception as e:
            print(f'⚠️ Feature extraction error: {e}')
            return None

    def match_feature(self, feature, threshold=SIMILARITY_THRESHOLD):
        if self._recognizer is None or feature is None:
            return False, 'Unknown', 'Unknown', '', 0.0

        best_score = -1.0
        best_match = None

        with self._cache_lock:
            for kf in self._known_faces:
                try:
                    score = self._recognizer.match(
                        feature,
                        kf['feature'],
                        cv2.FaceRecognizerSF_FR_COSINE
                    )
                    if score > best_score:
                        best_score = score
                        best_match = kf
                except Exception:
                    continue

        if best_match and best_score >= threshold:
            return True, best_match['name'], best_match['role'], best_match['department'], float(best_score)

        return False, 'Unknown', 'Visitor', '', float(max(0.0, best_score))

    def process_person_crop(self, frame_bgr, bbox):
        if frame_bgr is None or not bbox or len(bbox) != 4:
            return None

        h, w = frame_bgr.shape[:2]
        x1, y1, x2, y2 = map(int, bbox)
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        if x2 <= x1 or y2 <= y1:
            return None

        head_y2 = y1 + int((y2 - y1) * 0.55)
        person_crop = frame_bgr[y1:head_y2, x1:x2]

        if person_crop.size == 0:
            return None

        faces = self.detect_faces(person_crop)
        if len(faces) == 0:
            return None

        face = faces[0]
        feature = self.extract_feature(person_crop, face)
        if feature is None:
            return None

        is_known, name, role, dept, sim = self.match_feature(feature)

        fx, fy, fw, fh = map(int, face[:4])
        frame_face_bbox = [x1 + fx, y1 + fy, x1 + fx + fw, y1 + fy + fh]

        return {
            'name': name,
            'role': role,
            'department': dept,
            'is_known': is_known,
            'similarity': sim,
            'face_bbox': frame_face_bbox,
            'confidence': float(face[14]),
        }

    def register_face(self, name, role, department, image_bgr, notes=None):
        faces = self.detect_faces(image_bgr)
        if len(faces) == 0:
            return False, 'No face detected in the provided image', None

        face = faces[0]
        feature = self.extract_feature(image_bgr, face)
        if feature is None:
            return False, 'Could not extract facial embedding', None

        feat_list = feature.flatten().tolist()
        feat_json = json.dumps(feat_list)

        from app.database import SessionLocal
        from app.models import KnownFace

        db = SessionLocal()
        try:
            kf = KnownFace(
                name=name.strip(),
                role=role.strip() if role else 'Staff',
                department=department.strip() if department else 'General',
                embedding=feat_json,
                notes=notes,
            )
            db.add(kf)
            db.commit()
            db.refresh(kf)
            face_id = kf.id
        except Exception as e:
            db.rollback()
            return False, f'Database error: {e}', None
        finally:
            db.close()

        self.reload_cache()
        return True, f'Face registered successfully for {name}', face_id


face_engine = FaceEngine()
