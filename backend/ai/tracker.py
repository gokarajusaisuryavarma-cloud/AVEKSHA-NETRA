import math


# ============================================================
# AVEKSHA NETRA
# OBJECT TRACKER
# ============================================================

class ObjectTracker:

    def __init__(
        self,
        max_distance=120,
        max_missing=36,
        min_confirmations=2
    ):

        self.max_distance = max_distance
        self.max_missing = max_missing
        self.min_confirmations = min_confirmations

        self.next_track_id = 1

        self.tracks = {}


    # ========================================================
    # DISTANCE BETWEEN TWO POINTS
    # ========================================================

    def _distance(self, point1, point2):

        x1, y1 = point1
        x2, y2 = point2

        return math.sqrt(
            (x2 - x1) ** 2 +
            (y2 - y1) ** 2
        )


    # ========================================================
    # GET CENTER OF BOUNDING BOX
    # ========================================================

    def _get_center(self, detection):

        x1, y1, x2, y2 = detection["bbox"]

        return (
            (x1 + x2) / 2,
            (y1 + y2) / 2
        )


    # ========================================================
    # CREATE NEW TRACK
    # ========================================================

    def _create_track(self, detection):

        center = self._get_center(
            detection
        )

        track_id = self.next_track_id

        self.next_track_id += 1

        self.tracks[track_id] = {

            "track_id":
                track_id,

            # detector.py uses class_name
            "class_name":
                detection["class_name"],

            # Keep object_type too because
            # event_manager uses this name
            "object_type":
                detection["class_name"],

            "category":
                detection["category"],

            "confidence":
                detection["confidence"],

            "bbox":
                detection["bbox"],

            "center":
                center,

            "missing_frames":
                0,

            "confirmations":
                1,

            "confirmed":
                (
                    self.min_confirmations <= 1
                ),

            "last_detection":
                detection
        }


    # ========================================================
    # UPDATE TRACKS
    # ========================================================

    def update(self, detections):

        if detections is None:

            detections = []


        matched_tracks = set()

        matched_detections = set()


        # ====================================================
        # FIND POSSIBLE MATCHES
        # ====================================================

        candidates = []


        for track_id, track in self.tracks.items():

            for index, detection in enumerate(
                detections
            ):

                if index in matched_detections:

                    continue


                # ------------------------------------------------
                # Match same object class only
                # ------------------------------------------------

                if (
                    detection["class_name"]
                    !=
                    track["class_name"]
                ):

                    continue


                center = self._get_center(
                    detection
                )


                distance = self._distance(
                    track["center"],
                    center
                )


                if (
                    distance
                    <=
                    self.max_distance
                ):

                    candidates.append(
                        (
                            distance,
                            track_id,
                            index
                        )
                    )


        # ====================================================
        # CLOSEST MATCHES FIRST
        # ====================================================

        candidates.sort(
            key=lambda item: item[0]
        )


        for (
            distance,
            track_id,
            detection_index
        ) in candidates:

            if track_id in matched_tracks:

                continue


            if detection_index in matched_detections:

                continue


            track = self.tracks[
                track_id
            ]

            detection = detections[
                detection_index
            ]


            # ------------------------------------------------
            # Update existing track
            # ------------------------------------------------

            center = self._get_center(
                detection
            )


            track["bbox"] = (
                detection["bbox"]
            )

            track["center"] = center

            track["confidence"] = (
                detection["confidence"]
            )

            track["category"] = (
                detection["category"]
            )

            track["last_detection"] = (
                detection
            )

            track["missing_frames"] = 0

            track["confirmations"] += 1


            # ------------------------------------------------
            # Confirm after required detections
            # ------------------------------------------------

            if (
                track["confirmations"]
                >=
                self.min_confirmations
            ):

                track["confirmed"] = True


            matched_tracks.add(
                track_id
            )

            matched_detections.add(
                detection_index
            )


        # ====================================================
        # HANDLE MISSING TRACKS
        # ====================================================

        tracks_to_delete = []


        for track_id, track in self.tracks.items():

            if track_id not in matched_tracks:

                track["missing_frames"] += 1


                # Keep the track alive temporarily

                if (
                    track["missing_frames"]
                    >
                    self.max_missing
                ):

                    tracks_to_delete.append(
                        track_id
                    )


        # ====================================================
        # DELETE LOST TRACKS
        # ====================================================

        for track_id in tracks_to_delete:

            del self.tracks[
                track_id
            ]


        # ====================================================
        # CREATE NEW TRACKS
        # ====================================================

        for index, detection in enumerate(
            detections
        ):

            if index in matched_detections:

                continue


            self._create_track(
                detection
            )


        return self.tracks


    # ========================================================
    # GET CONFIRMED TRACKS
    # ========================================================

    def get_confirmed_tracks(self):

        confirmed_tracks = []


        for track in self.tracks.values():

            if not track["confirmed"]:

                continue


            confirmed_tracks.append({

                "track_id":
                    track["track_id"],

                "class_name":
                    track["class_name"],

                "object_type":
                    track["object_type"],

                "category":
                    track["category"],

                "confidence":
                    track["confidence"],

                "bbox":
                    track["bbox"],

                "center":
                    track["center"],

                "missing_frames":
                    track["missing_frames"],

                "confirmed":
                    track["confirmed"],

                "last_detection":
                    track["last_detection"]
            })


        return confirmed_tracks


    # ========================================================
    # GET ALL TRACKS
    # ========================================================

    def get_all_tracks(self):

        return list(
            self.tracks.values()
        )


    # ========================================================
    # RESET
    # ========================================================

    def reset(self):

        self.tracks.clear()

        self.next_track_id = 1