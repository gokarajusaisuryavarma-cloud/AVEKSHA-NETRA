from datetime import datetime, timedelta
import threading


# ============================================================
# AVEKSHA NETRA
# ALERT MANAGER
#
# AI Event
#     ↓
# Alert Manager
#     ↓
# Alert Ticket
#     ↓
# Dashboard / Alerts Page
#
# Alert lifetime = 3 HOURS
# ============================================================


# ============================================================
# CONFIGURATION
# ============================================================

ALERT_EXPIRY_HOURS = 3

MAX_ALERTS = 1000


# ============================================================
# GLOBAL ALERT STORAGE
# ============================================================

alerts = []

alerts_lock = threading.RLock()

_next_alert_id = 1


# ============================================================
# ALERT EVENT TYPES
# ============================================================

START_EVENT_TYPES = {
    "EVENT_STARTED",
    "STARTED",
    "TRACK_STARTED",
    "OBJECT_DETECTED",
    "DETECTED",
    "NEW_DETECTION",
    # 1. Face Recognition
    "FACE_RECOGNIZED",
    "FACE_UNKNOWN",
    # 2. ANPR
    "ANPR_DETECTED",
    "ANPR_WATCHLIST",
    # 3. Virtual Fence
    "PERSON_INTRUSION",
    "VEHICLE_INTRUSION",
    "VIRTUAL_FENCE_INTRUSION",
    # 4. Suspicious Behavior
    "LOITERING_DETECTED",
    "STATIONARY_OBJECT",
    "CROWD_GATHERING",
    # 5. Night Movement
    "NIGHT_PERSON_MOVEMENT",
    "NIGHT_VEHICLE_MOVEMENT",
    "NIGHT_INTRUSION",
}


# ============================================================
# GENERATE ALERT ID
# ============================================================

def _generate_alert_id():

    global _next_alert_id

    with alerts_lock:

        alert_id = _next_alert_id

        _next_alert_id += 1

        return alert_id


# ============================================================
# NORMALIZE OBJECT TYPE
# ============================================================

def _normalize_object_type(object_type):

    if object_type is None:

        return "unknown"

    value = str(
        object_type
    ).strip().lower()


    # --------------------------------------------------------
    # HUMAN
    # --------------------------------------------------------

    if value in {
        "person",
        "human",
        "people",
        "pedestrian"
    }:

        return "person"


    # --------------------------------------------------------
    # VEHICLES
    # --------------------------------------------------------

    if value in {
        "car",
        "truck",
        "bus",
        "motorcycle",
        "motorbike",
        "bicycle",
        "bike",
        "vehicle",
        "van"
    }:

        return "vehicle"


    return value


# ============================================================
# DISPLAY OBJECT NAME
# ============================================================

def _display_object_name(
    object_type
):

    normalized = _normalize_object_type(
        object_type
    )


    if normalized == "person":

        return "Human"


    if normalized == "vehicle":

        return "Vehicle"


    if normalized == "unknown":

        return "Object"


    return str(
        object_type
    ).replace(
        "_",
        " "
    ).title()


# ============================================================
# GENERATE ALERT TITLE
# ============================================================

def _generate_title(
    object_type
):

    display_name = _display_object_name(
        object_type
    )

    return f"{display_name} Detected"


# ============================================================
# GENERATE ALERT MESSAGE
# ============================================================

def _generate_message(
    object_type,
    camera_name,
    location
):

    display_name = _display_object_name(
        object_type
    )


    if location:

        return (
            f"{display_name} detected "
            f"by {camera_name} "
            f"at {location}."
        )


    return (
        f"{display_name} detected "
        f"by {camera_name}."
    )


# ============================================================
# GET SEVERITY
# ============================================================

def _get_severity(
    object_type
):

    normalized = _normalize_object_type(
        object_type
    )


    if normalized == "person":

        return "HIGH"


    if normalized == "vehicle":

        return "MEDIUM"


    return "LOW"


# ============================================================
# CLEAN EXPIRED ALERTS
# ============================================================

def cleanup_expired_alerts():

    now = datetime.now()

    with alerts_lock:

        valid_alerts = []


        for alert in alerts:

            expires_at = alert.get(
                "expires_at"
            )


            # ------------------------------------------------
            # If expiry information is missing,
            # keep the alert rather than deleting it.
            # ------------------------------------------------

            if not expires_at:

                valid_alerts.append(
                    alert
                )

                continue


            try:

                expiry_time = (
                    datetime.fromisoformat(
                        expires_at
                    )
                )

            except (
                ValueError,
                TypeError
            ):

                valid_alerts.append(
                    alert
                )

                continue


            # ------------------------------------------------
            # Alert still valid
            # ------------------------------------------------

            if expiry_time > now:

                valid_alerts.append(
                    alert
                )


            # ------------------------------------------------
            # Expired alert
            # ------------------------------------------------

            else:

                print(
                    f"🕒 Alert expired: "
                    f"#{alert.get('id')} "
                    f"{alert.get('title')}"
                )


        alerts.clear()

        alerts.extend(
            valid_alerts
        )


# ============================================================
# CHECK WHETHER EVENT SHOULD CREATE ALERT
# ============================================================

def _should_create_alert(
    event_type
):

    if event_type is None:

        return False


    normalized_type = (
        str(event_type)
        .strip()
        .upper()
    )


    return (
        normalized_type
        in START_EVENT_TYPES
    )


# ============================================================
# CREATE AI ALERT
# ============================================================

def process_ai_event(
    camera_id,
    camera_name,
    location,
    event_type,
    object_type,
    track_id,
    confidence=None,
    custom_title=None,
    custom_message=None,
    severity=None,
    metadata=None,
):

    # ========================================================
    # ONLY START/DETECTION EVENTS CREATE ALERTS
    # ========================================================

    if not _should_create_alert(
        event_type
    ):

        return None


    # ========================================================
    # CLEAN OLD ALERTS
    # ========================================================

    cleanup_expired_alerts()


    # ========================================================
    # CURRENT TIME
    # ========================================================

    now = datetime.now()


    expires_at = (
        now +
        timedelta(
            hours=ALERT_EXPIRY_HOURS
        )
    )


    # ========================================================
    # NORMALIZE OBJECT
    # ========================================================

    normalized_object = (
        _normalize_object_type(
            object_type
        )
    )


    display_object = (
        _display_object_name(
            object_type
        )
    )


    # ========================================================
    # CREATE ALERT
    # ========================================================

    final_title = custom_title or _generate_title(object_type)
    final_message = custom_message or _generate_message(object_type, camera_name, location)
    final_severity = severity or _get_severity(object_type)

    alert = {

        # ----------------------------------------------------
        # ID
        # ----------------------------------------------------

        "id":
            _generate_alert_id(),

        "alert_type":
            event_type,

        # ----------------------------------------------------
        # BASIC INFORMATION
        # ----------------------------------------------------

        "title":
            final_title,

        "message":
            final_message,


        # ----------------------------------------------------
        # SEVERITY
        # ----------------------------------------------------

        "severity":
            final_severity,


        # ----------------------------------------------------
        # STATUS
        # ----------------------------------------------------

        "status":
            "ACTIVE",
        "metadata":
            metadata or {},


        # ----------------------------------------------------
        # CAMERA INFORMATION
        # ----------------------------------------------------

        "camera_id":
            camera_id,

        "camera_name":
            camera_name,

        "location":
            location,


        # ----------------------------------------------------
        # OBJECT INFORMATION
        # ----------------------------------------------------

        "object_type":
            normalized_object,

        "detected_object":
            object_type,

        "display_object":
            display_object,

        "track_id":
            track_id,

        "confidence":
            confidence,


        # ----------------------------------------------------
        # TIME INFORMATION
        # ----------------------------------------------------

        "timestamp":
            now.isoformat(),

        "created_at":
            now.isoformat(),

        "expires_at":
            expires_at.isoformat(),

        "alert_lifetime_hours":
            ALERT_EXPIRY_HOURS,

    }


    # ========================================================
    # STORE ALERT
    # ========================================================

    with alerts_lock:

        alerts.append(
            alert
        )


        # ----------------------------------------------------
        # MEMORY PROTECTION
        # ----------------------------------------------------

        if len(alerts) > MAX_ALERTS:

            del alerts[
                :-MAX_ALERTS
            ]


    # ========================================================
    # CONSOLE LOG
    # ========================================================

    print()

    print(
        "╔══════════════════════════════════════════════╗"
    )

    print(
        "║       🚨 DASHBOARD ALERT CREATED            ║"
    )

    print(
        "╠══════════════════════════════════════════════╣"
    )

    print(
        f"║ Alert ID : #{alert['id']}"
    )

    print(
        f"║ Title    : {alert['title']}"
    )

    print(
        f"║ Object   : {display_object}"
    )

    print(
        f"║ Camera   : {camera_name}"
    )

    print(
        f"║ Location : {location}"
    )

    print(
        f"║ Track    : #{track_id}"
    )

    print(
        f"║ Severity : {alert['severity']}"
    )

    print(
        f"║ Created  : {alert['created_at']}"
    )

    print(
        f"║ Expires  : {alert['expires_at']}"
    )

    print(
        "╚══════════════════════════════════════════════╝"
    )


    return alert


# ============================================================
# GET ALL ALERTS
# ============================================================

def get_alerts():

    cleanup_expired_alerts()

    with alerts_lock:

        return list(
            alerts
        )


# ============================================================
# GET ACTIVE ALERTS
# ============================================================

def get_active_alerts():

    cleanup_expired_alerts()

    with alerts_lock:

        return [

            alert

            for alert in alerts

            if alert.get(
                "status"
            ) == "ACTIVE"

        ]


# ============================================================
# GET ALERT BY ID
# ============================================================

def get_alert_by_id(
    alert_id
):

    cleanup_expired_alerts()

    with alerts_lock:

        for alert in alerts:

            if str(
                alert.get("id")
            ) == str(
                alert_id
            ):

                return alert


    return None


# ============================================================
# GET ALERTS FOR CAMERA
# ============================================================

def get_alerts_by_camera(
    camera_id
):

    cleanup_expired_alerts()

    with alerts_lock:

        return [

            alert

            for alert in alerts

            if str(
                alert.get(
                    "camera_id"
                )
            ) == str(
                camera_id
            )

        ]


# ============================================================
# GET ALERT COUNT
# ============================================================

def get_alert_count():

    cleanup_expired_alerts()

    with alerts_lock:

        return len(
            alerts
        )


# ============================================================
# GET ACTIVE ALERT COUNT
# ============================================================

def get_active_alert_count():

    cleanup_expired_alerts()

    with alerts_lock:

        return sum(

            1

            for alert in alerts

            if alert.get(
                "status"
            ) == "ACTIVE"

        )


# ============================================================
# GET HUMAN ALERT COUNT
# ============================================================

def get_human_alert_count():

    cleanup_expired_alerts()

    with alerts_lock:

        return sum(

            1

            for alert in alerts

            if alert.get(
                "object_type"
            ) == "person"

        )


# ============================================================
# GET VEHICLE ALERT COUNT
# ============================================================

def get_vehicle_alert_count():

    cleanup_expired_alerts()

    with alerts_lock:

        return sum(

            1

            for alert in alerts

            if alert.get(
                "object_type"
            ) == "vehicle"

        )


# ============================================================
# GET ALERTS BY TIME RANGE
# ============================================================

def get_alerts_by_time_range(
    start_time=None,
    end_time=None
):

    cleanup_expired_alerts()


    with alerts_lock:

        result = []


        for alert in alerts:

            timestamp = alert.get(
                "timestamp"
            )


            if not timestamp:

                continue


            try:

                alert_time = (
                    datetime.fromisoformat(
                        timestamp
                    )
                )

            except (
                ValueError,
                TypeError
            ):

                continue


            # ------------------------------------------------
            # Start filter
            # ------------------------------------------------

            if (
                start_time is not None
                and
                alert_time < start_time
            ):

                continue


            # ------------------------------------------------
            # End filter
            # ------------------------------------------------

            if (
                end_time is not None
                and
                alert_time > end_time
            ):

                continue


            result.append(
                alert
            )


        return result


# ============================================================
# GENERATE TIME RANGE SUMMARY
# ============================================================

def get_alert_summary_by_time_range(
    start_time=None,
    end_time=None
):

    matching_alerts = (
        get_alerts_by_time_range(
            start_time,
            end_time
        )
    )


    # ========================================================
    # COUNTERS
    # ========================================================

    total_alerts = len(
        matching_alerts
    )


    human_alerts = 0

    vehicle_alerts = 0

    active_alerts = 0


    object_counts = {}


    # ========================================================
    # ANALYZE ALERTS
    # ========================================================

    for alert in matching_alerts:

        object_type = alert.get(
            "object_type",
            "unknown"
        )


        # ----------------------------------------------------
        # Human
        # ----------------------------------------------------

        if object_type == "person":

            human_alerts += 1


        # ----------------------------------------------------
        # Vehicle
        # ----------------------------------------------------

        elif object_type == "vehicle":

            vehicle_alerts += 1


        # ----------------------------------------------------
        # Active
        # ----------------------------------------------------

        if alert.get(
            "status"
        ) == "ACTIVE":

            active_alerts += 1


        # ----------------------------------------------------
        # Object breakdown
        # ----------------------------------------------------

        detected_object = (
            alert.get(
                "detected_object"
            )
            or object_type
        )


        detected_object = str(
            detected_object
        ).lower()


        object_counts[
            detected_object
        ] = (
            object_counts.get(
                detected_object,
                0
            ) + 1
        )


    # ========================================================
    # RETURN SUMMARY
    # ========================================================

    return {

        "total_alerts":
            total_alerts,

        "active_alerts":
            active_alerts,

        "human_alerts":
            human_alerts,

        "vehicle_alerts":
            vehicle_alerts,

        "object_breakdown":
            object_counts,

        "start_time":
            (
                start_time.isoformat()
                if start_time
                else None
            ),

        "end_time":
            (
                end_time.isoformat()
                if end_time
                else None
            ),

        "retention_hours":
            ALERT_EXPIRY_HOURS,

    }


# ============================================================
# ALERT SUMMARY
# ============================================================

def get_alert_summary():

    cleanup_expired_alerts()

    with alerts_lock:

        total = len(
            alerts
        )


        humans = sum(

            1

            for alert in alerts

            if alert.get(
                "object_type"
            ) == "person"

        )


        vehicles = sum(

            1

            for alert in alerts

            if alert.get(
                "object_type"
            ) == "vehicle"

        )


        active = sum(

            1

            for alert in alerts

            if alert.get(
                "status"
            ) == "ACTIVE"

        )


        return {

            "total_alerts":
                total,

            "active_alerts":
                active,

            "human_alerts":
                humans,

            "vehicle_alerts":
                vehicles,

            "retention_hours":
                ALERT_EXPIRY_HOURS,

        }


# ============================================================
# CLEAR ALL ALERTS
# ============================================================

def clear_alerts():

    with alerts_lock:

        alerts.clear()


    print(
        "🧹 All alerts cleared"
    )


# ============================================================
# RESET ALERT ID
# ============================================================

def reset_alert_manager():

    global _next_alert_id


    with alerts_lock:

        alerts.clear()

        _next_alert_id = 1


# ============================================================
# ACKNOWLEDGE ALERT
# ============================================================

def acknowledge_alert(alert_id):

    with alerts_lock:

        for alert in alerts:

            if str(alert.get("id")) == str(alert_id):

                alert["status"] = "ACKNOWLEDGED"

                alert["acknowledged_at"] = datetime.now().isoformat()

                return alert

    return None


    print(
        "🔄 Alert manager reset"
    )