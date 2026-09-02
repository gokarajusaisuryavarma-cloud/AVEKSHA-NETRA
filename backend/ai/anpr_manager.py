from collections import defaultdict

from plate_detector import read_plate_from_vehicle


# ============================================================
# AVEKSHA NETRA
# MULTI-FRAME ANPR MANAGER
#
# Purpose:
#   Run OCR periodically for tracked vehicles and confirm a
#   registration number using multiple observations.
# ============================================================


class ANPRManager:

    def __init__(
        self,
        process_every_n_frames=10,
        minimum_observations=3,
        minimum_confidence=0.40
    ):

        self.process_every_n_frames = (
            process_every_n_frames
        )

        self.minimum_observations = (
            minimum_observations
        )

        self.minimum_confidence = (
            minimum_confidence
        )

        self.frame_counter = 0

        # Track ID -> plate observations
        self.observations = defaultdict(list)

        # Track ID -> confirmed plate
        self.confirmed_plates = {}


    # ========================================================
    # PROCESS TRACKS
    # ========================================================

    def process(
        self,
        frame,
        tracks
    ):

        self.frame_counter += 1

        results = []


        # ----------------------------------------------------
        # Don't run OCR every frame
        # ----------------------------------------------------

        if (
            self.frame_counter
            %
            self.process_every_n_frames
            != 0
        ):

            return results


        # ----------------------------------------------------
        # Process vehicle tracks only
        # ----------------------------------------------------

        for track in tracks:

            category = str(
                track.get(
                    "category",
                    ""
                )
            ).upper()


            object_type = str(
                track.get(
                    "object_type",
                    ""
                )
            ).lower()


            # ------------------------------------------------
            # Only vehicles
            # ------------------------------------------------

            vehicle_classes = {

                "car",
                "motorcycle",
                "bus",
                "truck",
                "bicycle"
            }


            if (
                object_type
                not in vehicle_classes
                and
                category != "VEHICLE"
            ):

                continue


            track_id = track[
                "track_id"
            ]


            # ------------------------------------------------
            # Already confirmed?
            # ------------------------------------------------

            if track_id in self.confirmed_plates:

                continue


            bbox = track.get(
                "bbox"
            )


            if not bbox:

                continue


            # ------------------------------------------------
            # Run OCR
            # ------------------------------------------------

            result = read_plate_from_vehicle(

                frame,

                bbox

            )


            if result is None:

                continue


            plate = result[
                "plate_number"
            ]

            confidence = result[
                "confidence"
            ]


            if (
                confidence
                <
                self.minimum_confidence
            ):

                continue


            # ------------------------------------------------
            # Save observation
            # ------------------------------------------------

            self.observations[
                track_id
            ].append({

                "plate":
                    plate,

                "confidence":
                    confidence

            })


            # Keep only recent observations

            self.observations[
                track_id
            ] = self.observations[
                track_id
            ][-10:]


            # ------------------------------------------------
            # Try to confirm plate
            # ------------------------------------------------

            confirmed = self._confirm_plate(
                track_id
            )


            if confirmed:

                self.confirmed_plates[
                    track_id
                ] = confirmed


                results.append({

                    "track_id":
                        track_id,

                    "plate_number":
                        confirmed["plate_number"],

                    "confidence":
                        confirmed["confidence"]

                })


        return results


    # ========================================================
    # CONFIRM PLATE
    # ========================================================

    def _confirm_plate(
        self,
        track_id
    ):

        observations = self.observations[
            track_id
        ]


        if (
            len(observations)
            <
            self.minimum_observations
        ):

            return None


        # ----------------------------------------------------
        # Count how many times each plate appeared
        # ----------------------------------------------------

        counts = {}


        for observation in observations:

            plate = observation[
                "plate"
            ]


            counts[plate] = (
                counts.get(
                    plate,
                    0
                )
                + 1
            )


        # Most frequently observed plate

        best_plate = max(
            counts,
            key=counts.get
        )


        occurrences = counts[
            best_plate
        ]


        # Need repeated agreement

        if (
            occurrences
            <
            self.minimum_observations
        ):

            return None


        # ----------------------------------------------------
        # Calculate average confidence
        # ----------------------------------------------------

        matching = [

            observation

            for observation in observations

            if observation["plate"]
            ==
            best_plate

        ]


        average_confidence = (

            sum(
                item["confidence"]
                for item in matching
            )

            /

            len(matching)

        )


        return {

            "plate_number":
                best_plate,

            "confidence":
                average_confidence

        }


    # ========================================================
    # GET CONFIRMED PLATE
    # ========================================================

    def get_plate(
        self,
        track_id
    ):

        return self.confirmed_plates.get(
            track_id
        )


    # ========================================================
    # REMOVE FINISHED TRACK
    # ========================================================

    def remove_track(
        self,
        track_id
    ):

        self.observations.pop(
            track_id,
            None
        )

        self.confirmed_plates.pop(
            track_id,
            None
        )


    # ========================================================
    # RESET
    # ========================================================

    def reset(self):

        self.frame_counter = 0

        self.observations.clear()

        self.confirmed_plates.clear()