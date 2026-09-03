import { useEffect, useState } from "react";
import "./Alerts.css";

const API_BASE = "https://aveksha-netra-backend.onrender.com";
function Alerts() {
  // ============================================================
  // STATE
  // ============================================================

  const [alerts, setAlerts] = useState([]);

  const [counts, setCounts] = useState({
    total: 0,
    active: 0,
    human: 0,
    vehicle: 0,
  });

  const [summary, setSummary] = useState({
    total_alerts: 0,
    active_alerts: 0,
    human_alerts: 0,
    vehicle_alerts: 0,
    retention_hours: 3,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ============================================================
  // FETCH ALERT DATA
  // ============================================================

  const fetchAlertData = async () => {
    try {
      setError("");

      const [
        alertsResponse,
        activeResponse,
        countResponse,
        summaryResponse,
      ] = await Promise.all([
        fetch(`${API_BASE}/api/alerts`),
        fetch(`${API_BASE}/api/alerts/active`),
        fetch(`${API_BASE}/api/alerts/count`),
        fetch(`${API_BASE}/api/alerts/summary`),
      ]);

      if (
        !alertsResponse.ok ||
        !activeResponse.ok ||
        !countResponse.ok ||
        !summaryResponse.ok
      ) {
        throw new Error("Alert API request failed");
      }

      const alertsData = await alertsResponse.json();
      const activeData = await activeResponse.json();
      const countData = await countResponse.json();
      const summaryData = await summaryResponse.json();

      // ========================================================
      // EXTRACT ALL ALERTS
      // ========================================================

      let allAlerts = [];

      if (Array.isArray(alertsData)) {
        allAlerts = alertsData;
      } else if (Array.isArray(alertsData?.alerts)) {
        allAlerts = alertsData.alerts;
      } else if (Array.isArray(alertsData?.data)) {
        allAlerts = alertsData.data;
      }

      // ========================================================
      // EXTRACT ACTIVE ALERTS
      // ========================================================

      let activeAlerts = [];

      if (Array.isArray(activeData)) {
        activeAlerts = activeData;
      } else if (Array.isArray(activeData?.alerts)) {
        activeAlerts = activeData.alerts;
      } else if (Array.isArray(activeData?.data)) {
        activeAlerts = activeData.data;
      }

      // ========================================================
      // BACKEND SUMMARY
      // ========================================================

      const backendSummary = summaryData?.summary || {};

      const totalAlerts = Number(
        backendSummary.total_alerts ??
          countData.total ??
          allAlerts.length
      );

      const activeAlertsCount = Number(
        backendSummary.active_alerts ??
          countData.active ??
          activeAlerts.length
      );

      const humanAlerts = Number(
        backendSummary.human_alerts ??
          countData.human ??
          0
      );

      const vehicleAlerts = Number(
        backendSummary.vehicle_alerts ??
          countData.vehicle ??
          0
      );

      const retentionHours = Number(
        backendSummary.retention_hours ?? 3
      );

      // ========================================================
      // SET COUNTS
      // ========================================================

      setCounts({
        total: totalAlerts,
        active: activeAlertsCount,
        human: humanAlerts,
        vehicle: vehicleAlerts,
      });

      // ========================================================
      // SET SUMMARY
      // ========================================================

      setSummary({
        total_alerts: totalAlerts,
        active_alerts: activeAlertsCount,
        human_alerts: humanAlerts,
        vehicle_alerts: vehicleAlerts,
        retention_hours: retentionHours,
      });

      // ========================================================
      // SORT ALERTS - NEWEST FIRST
      // ========================================================

      const sortedAlerts = [...allAlerts].sort((a, b) => {
        const timeA = new Date(
          a?.timestamp ||
            a?.created_at ||
            a?.createdAt ||
            0
        ).getTime();

        const timeB = new Date(
          b?.timestamp ||
            b?.created_at ||
            b?.createdAt ||
            0
        ).getTime();

        return timeB - timeA;
      });

      setAlerts(sortedAlerts);

      console.log("✅ Alerts loaded:", {
        total: totalAlerts,
        active: activeAlertsCount,
        human: humanAlerts,
        vehicle: vehicleAlerts,
        tableAlerts: sortedAlerts.length,
      });
    } catch (err) {
      console.error("❌ Alert API error:", err);

      setError(
        "Unable to connect to alert service."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // INITIAL LOAD + AUTO REFRESH
  // ============================================================

  useEffect(() => {
    fetchAlertData();

    const interval = setInterval(() => {
      fetchAlertData();
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // ============================================================
  // NORMALIZE ALERT
  // ============================================================

  const normalizeAlert = (alert) => {
    if (!alert || typeof alert !== "object") {
      return {
        id: "unknown",
        title: "Unknown Alert",
        message: "AI detection event",
        severity: "MEDIUM",
        status: "ACTIVE",
        camera_id: "--",
        camera_name: "Unknown Camera",
        location: "Unknown",
        object_type: "UNKNOWN",
        track_id: "--",
        timestamp: null,
      };
    }

    return {
      id:
        alert.id ??
        alert.alert_id ??
        alert.alertId ??
        "unknown",

      title:
        alert.title ||
        alert.event_type ||
        alert.eventType ||
        alert.alert_type ||
        alert.alertType ||
        "Security Alert",

      message:
        alert.message ||
        alert.description ||
        "AI detection event",

      severity:
        String(
          alert.severity ||
            alert.priority ||
            "MEDIUM"
        ).toUpperCase(),

      status:
        String(
          alert.status ||
            "ACTIVE"
        ).toUpperCase(),

      camera_id:
        alert.camera_id ??
        alert.cameraId ??
        "--",

      camera_name:
        alert.camera_name ||
        alert.cameraName ||
        "Unknown Camera",

      location:
        alert.location ||
        alert.camera_location ||
        "Unknown",

      object_type:
        alert.object_type ||
        alert.objectType ||
        alert.detected_object ||
        alert.detectedObject ||
        "unknown",

      track_id:
        alert.track_id ??
        alert.trackId ??
        "--",

      timestamp:
        alert.timestamp ||
        alert.created_at ||
        alert.createdAt ||
        null,
    };
  };

  // ============================================================
  // FORMAT TIME
  // ============================================================

  const formatTime = (value) => {
    if (!value) {
      return "--:--:--";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "--:--:--";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // ============================================================
  // FORMAT DATE
  // ============================================================

  const formatDate = (value) => {
    if (!value) {
      return "--";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "--";
    }

    return date.toLocaleDateString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // ============================================================
  // FORMAT CAMERA
  // ============================================================

  const formatCamera = (cameraId) => {
    if (
      cameraId === null ||
      cameraId === undefined ||
      cameraId === "--"
    ) {
      return "CAM----";
    }

    const cameraString = String(cameraId);

    if (cameraString.toUpperCase().startsWith("CAM-")) {
      return cameraString.toUpperCase();
    }

    return `CAM-${cameraString.padStart(3, "0")}`;
  };

  // ============================================================
  // FORMAT OBJECT
  // ============================================================

  const formatObject = (objectType) => {
    if (!objectType) {
      return "UNKNOWN";
    }

    return String(objectType).toUpperCase();
  };

  // ============================================================
  // NORMALIZED ALERTS
  // ============================================================

  const normalizedAlerts = alerts.map(normalizeAlert);

  // ============================================================
  // LOCAL SEVERITY COUNTS
  // ============================================================

  const criticalCount = normalizedAlerts.filter(
    (alert) => alert.severity === "CRITICAL"
  ).length;

  const highCount = normalizedAlerts.filter(
    (alert) => alert.severity === "HIGH"
  ).length;

  const mediumCount = normalizedAlerts.filter(
    (alert) => alert.severity === "MEDIUM"
  ).length;

  const lowCount = normalizedAlerts.filter(
    (alert) => alert.severity === "LOW"
  ).length;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="alerts-page">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="alerts-header">

        <div>
          <span className="section-label">
            THREAT MONITOR
          </span>

          <h2>
            Alert Center
          </h2>

          <p>
            Real-time security alerts generated
            by the AVEKSHA NETRA surveillance
            network.
          </p>
        </div>

        <div className="alert-system-status">

          <span
            className={
              error
                ? "alert-status-dot offline"
                : "alert-status-dot"
            }
          />

          {error
            ? "ALERT SERVICE OFFLINE"
            : "ALERT SYSTEM ONLINE"}

        </div>

      </div>


      {/* ======================================================
          STATISTICS
      ====================================================== */}

      <section className="alert-stats">

        <div className="alert-stat-card critical">

          <span>
            CRITICAL
          </span>

          <strong>
            {criticalCount}
          </strong>

          <small>
            Immediate attention
          </small>

        </div>


        <div className="alert-stat-card high">

          <span>
            HIGH
          </span>

          <strong>
            {highCount}
          </strong>

          <small>
            High priority alerts
          </small>

        </div>


        <div className="alert-stat-card medium">

          <span>
            MEDIUM
          </span>

          <strong>
            {mediumCount}
          </strong>

          <small>
            Requires monitoring
          </small>

        </div>


        <div className="alert-stat-card total">

          <span>
            TOTAL ALERTS
          </span>

          <strong>
            {counts.total}
          </strong>

          <small>
            All recorded alerts
          </small>

        </div>

      </section>


      {/* ======================================================
          BACKEND SUMMARY
      ====================================================== */}

      <section className="alert-summary">

        <div className="summary-item">

          <span>
            ACTIVE
          </span>

          <strong>
            {counts.active}
          </strong>

        </div>


        <div className="summary-item">

          <span>
            HUMAN
          </span>

          <strong>
            {counts.human}
          </strong>

        </div>


        <div className="summary-item">

          <span>
            VEHICLE
          </span>

          <strong>
            {counts.vehicle}
          </strong>

        </div>


        <div className="summary-item">

          <span>
            TOTAL EVENTS
          </span>

          <strong>
            {summary.total_alerts}
          </strong>

        </div>

      </section>


      {/* ======================================================
          ALERT TABLE
      ====================================================== */}

      <section className="alert-table-section">

        <div className="alert-table-header">

          <div>

            <span className="section-label">
              SECURITY EVENTS
            </span>

            <h3>
              Recent Alerts
            </h3>

          </div>

          <div className="alert-table-meta">

            <span>
              LOW: {lowCount}
            </span>

            <span>
              ACTIVE: {counts.active}
            </span>

            <span>
              RETENTION: {summary.retention_hours}H
            </span>

          </div>

        </div>


        <div className="alert-table">

          {/* ==================================================
              TABLE HEADER
          ================================================== */}

          <div className="alert-table-row alert-table-heading">

            <span>
              TIME
            </span>

            <span>
              CAMERA
            </span>

            <span>
              EVENT
            </span>

            <span>
              OBJECT
            </span>

            <span>
              SEVERITY
            </span>

            <span>
              STATUS
            </span>

          </div>


          {/* ==================================================
              LOADING
          ================================================== */}

          {loading ? (

            <div className="alert-table-empty">

              <span className="empty-alert-icon">
                ◌
              </span>

              <strong>
                Loading security events
              </strong>

              <small>
                Connecting to alert service...
              </small>

            </div>

          ) : error ? (

            /* ==================================================
               ERROR
            ================================================== */

            <div className="alert-table-empty">

              <span className="empty-alert-icon">
                !
              </span>

              <strong>
                Alert service unavailable
              </strong>

              <small>
                Check that the FastAPI backend
                is running on port 8000.
              </small>

              <button
                type="button"
                onClick={fetchAlertData}
                className="alert-retry-button"
              >
                Retry Connection
              </button>

            </div>

          ) : normalizedAlerts.length === 0 ? (

            /* ==================================================
               NO ALERTS
            ================================================== */

            <div className="alert-table-empty">

              <span className="empty-alert-icon">
                △
              </span>

              <strong>
                No security alerts recorded
              </strong>

              <small>
                AI detection events will appear
                here when threats are identified.
              </small>

            </div>

          ) : (

            /* ==================================================
               ALERT ROWS
            ================================================== */

            <div className="alert-table-body">

              {normalizedAlerts
                .slice(0, 50)
                .map((alert, index) => (

                  <div
                    className="alert-table-row"
                    key={`${alert.id}-${index}`}
                  >

                    {/* TIME */}

                    <span>

                      <strong>
                        {formatTime(
                          alert.timestamp
                        )}
                      </strong>

                      <small>
                        {formatDate(
                          alert.timestamp
                        )}
                      </small>

                    </span>


                    {/* CAMERA */}

                    <span>

                      <strong>
                        {formatCamera(
                          alert.camera_id
                        )}
                      </strong>

                      <small>
                        {alert.camera_name}
                      </small>

                      <small>
                        {alert.location}
                      </small>

                    </span>


                    {/* EVENT */}

                    <span>

                      <strong>
                        {alert.title}
                      </strong>

                      <small>
                        {alert.message}
                      </small>

                    </span>


                    {/* OBJECT */}

                    <span>

                      <strong>
                        {formatObject(
                          alert.object_type
                        )}
                      </strong>

                      {alert.track_id !== "--" && (

                        <small>
                          Track #{alert.track_id}
                        </small>

                      )}

                    </span>


                    {/* SEVERITY */}

                    <span>

                      <b
                        className={
                          `severity-${alert.severity.toLowerCase()}`
                        }
                      >
                        {alert.severity}
                      </b>

                    </span>


                    {/* STATUS */}

                    <span>

                      <b
                        className={
                          alert.status === "ACTIVE"
                            ? "status-active"
                            : "status-ended"
                        }
                      >
                        {alert.status}
                      </b>

                    </span>

                  </div>

                ))}

            </div>

          )}

        </div>

      </section>

    </div>
  );
}

export default Alerts;