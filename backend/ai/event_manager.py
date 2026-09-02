from datetime import datetime


# ============================================================
# AVEKSHA NETRA
# EVENT MANAGER
#
# One event per tracked object.
#
# Temporary detection loss should NOT immediately create
# a new event.
# ============================================================


class EventManager:

    def __init__(
        self,
        end_after_missing_frames=36
    ):

        self.active_events = {}

        self.completed_events = []

        self.end_after_missing_frames = (
            end_after_missing_frames
        )


    # ========================================================
    # PROCESS TRACKS
    # ========================================================

    def process_tracks(
        self,
        tracks,
        camera_id
    ):

        events = []

        currently_seen_ids = set()


        # ====================================================
        # PROCESS CURRENT TRACKS
        # ====================================================

        for track in tracks:

            track_id = track["track_id"]


            # ------------------------------------------------
            # Ignore unconfirmed tracks
            # ------------------------------------------------

            if not track.get(
                "confirmed",
                False
            ):

                continue


            currently_seen_ids.add(
                track_id
            )


            # =================================================
            # NEW EVENT
            # =================================================

            if track_id not in self.active_events:

                now = datetime.now()


                event = {

                    "track_id":
                        track_id,

                    "camera_id":
                        camera_id,

                    "object_type":
                        track["object_type"],

                    "category":
                        track["category"],

                    "first_seen":
                        now,

                    "last_seen":
                        now,

                    "status":
                        "ACTIVE",

                    "confidence":
                        track["confidence"],

                    "missing_frames":
                        0,

                    # ANPR fields
                    "plate_number":
                        None,

                    "plate_confidence":
                        None
                }


                self.active_events[
                    track_id
                ] = event


                events.append({

                    "type":
                        "EVENT_STARTED",

                    "event":
                        event

                })


            # =================================================
            # EXISTING EVENT
            # =================================================

            else:

                event = self.active_events[
                    track_id
                ]


                event["last_seen"] = (
                    datetime.now()
                )


                event["missing_frames"] = 0


                # Keep strongest object confidence

                event["confidence"] = max(

                    event["confidence"],

                    track["confidence"]

                )


        # ====================================================
        # CHECK MISSING EVENTS
        # ====================================================

        for track_id in list(
            self.active_events.keys()
        ):

            if track_id in currently_seen_ids:

                continue


            event = self.active_events[
                track_id
            ]


            event["missing_frames"] += 1


            # ------------------------------------------------
            # Do NOT end immediately.
            #
            # Tracker can temporarily lose the object.
            # ------------------------------------------------

            if (
                event["missing_frames"]
                <
                self.end_after_missing_frames
            ):

                continue


            # =================================================
            # EVENT REALLY ENDED
            # =================================================

            event["status"] = "ENDED"


            event["ended_at"] = (
                datetime.now()
            )


            duration = (

                event["ended_at"]

                -

                event["first_seen"]

            ).total_seconds()


            event["duration_seconds"] = (
                round(duration, 2)
            )


            events.append({

                "type":
                    "EVENT_ENDED",

                "event":
                    event

            })


            self.completed_events.append(
                event
            )


            del self.active_events[
                track_id
            ]


        return events


    # ========================================================
    # ATTACH NUMBER PLATE
    # ========================================================

    def attach_plate(
        self,
        track_id,
        plate_number,
        plate_confidence
    ):

        if track_id not in self.active_events:

            return False


        event = self.active_events[
            track_id
        ]


        current_confidence = (
            event["plate_confidence"]
            or 0
        )


        # Only accept stronger OCR results

        if (
            plate_confidence
            >=
            current_confidence
        ):

            event["plate_number"] = (
                plate_number
            )

            event["plate_confidence"] = (
                plate_confidence
            )


        return True


    # ========================================================
    # GET ACTIVE EVENTS
    # ========================================================

    def get_active_events(self):

        return list(
            self.active_events.values()
        )


    # ========================================================
    # GET COMPLETED EVENTS
    # ========================================================

    def get_completed_events(self):

        return list(
            self.completed_events
        )


    # ========================================================
    # RESET
    # ========================================================

    def reset(self):

        self.active_events.clear()

        self.completed_events.clear()