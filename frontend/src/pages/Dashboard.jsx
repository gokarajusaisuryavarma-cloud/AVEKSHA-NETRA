import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = "https://aveksha-netra-backend.onrender.com";

const ALERT_LIFETIME_MS = 3 * 60 * 60 * 1000;
const EVENT_POLL_INTERVAL = 3000;
const CAMERA_REFRESH_INTERVAL = 15000;

// ============================================================
// HELPERS
// ============================================================

const normalizeObject = (value) => {
  return String(value || "unknown")
    .toLowerCase()
    .trim();
};

const isHuman = (type) => {
  return normalizeObject(type) === "person";
};

const isVehicle = (type) => {
  return [
    "car",
    "truck",
    "bus",
    "motorcycle",
    "bicycle",
    "vehicle",
  ].includes(normalizeObject(type));
};

const capitalize = (value) => {
  const text = String(value || "unknown");

  return text.charAt(0).toUpperCase() + text.slice(1);
};

const getEventTime = (event) => {
  const value =
    event?.timestamp ||
    event?.first_seen ||
    event?.last_seen;

  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
};

const formatTime = (value) => {
  if (!value) {
    return "--:--:--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return date.toLocaleTimeString();
};

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString();
};

const getAlertTitle = (event) => {
  const type = normalizeObject(event?.object_type);

  if (isHuman(type)) {
    return "HUMAN DETECTED";
  }

  if (isVehicle(type)) {
    return "VEHICLE DETECTED";
  }

  return "OBJECT DETECTED";
};

const getAlertDescription = (event) => {
  const type = normalizeObject(event?.object_type);

  const location =
    event?.location || "Unknown location";

  if (isHuman(type)) {
    return `Human detected near ${location}.`;
  }

  return `${capitalize(type)} detected near ${location}.`;
};

const getAlertIcon = (event) => {
  const type = normalizeObject(event?.object_type);

  if (isHuman(type)) {
    return "●";
  }

  if (isVehicle(type)) {
    return "▣";
  }

  return "◆";
};

const getSeverity = (event) => {
  const type = normalizeObject(event?.object_type);

  if (isHuman(type)) {
    return "HIGH";
  }

  if (isVehicle(type)) {
    return "MEDIUM";
  }

  return "LOW";
};

const isStartedEvent = (event) => {
  return (
    event?.type === "EVENT_STARTED" ||
    event?.status === "ACTIVE"
  );
};

const getConfidence = (event) => {
  if (event?.confidence == null) {
    return "--";
  }

  const confidence = Number(event.confidence);

  if (Number.isNaN(confidence)) {
    return "--";
  }

  const percentage =
    confidence <= 1
      ? confidence * 100
      : confidence;

  return `${percentage.toFixed(0)}%`;
};

const getCameraId = (camera) => {
  return camera?.id ?? camera?.camera_id;
};

// ============================================================
// DASHBOARD
// ============================================================

function Dashboard({
  cameras = [],
  refreshCameras,
}) {
  // ============================================================
  // STATE
  // ============================================================

  const [events, setEvents] = useState([]);

  const [loadingEvents, setLoadingEvents] =
    useState(false);

  const [selectedAlert, setSelectedAlert] =
    useState(null);

  const [summaryRange, setSummaryRange] =
    useState(3);

  const [currentTime, setCurrentTime] =
    useState(Date.now());

  const [lastRefresh, setLastRefresh] =
    useState(null);

  const [backendOnline, setBackendOnline] =
    useState(true);

  const [streamErrors, setStreamErrors] =
    useState({});

  const [streamLoading, setStreamLoading] =
    useState({});

  const [aiStarting, setAiStarting] =
    useState({});

  const [aiStarted, setAiStarted] =
    useState({});

  const [refreshing, setRefreshing] =
    useState(false);

  // ============================================================
  // NORMALIZED CAMERAS
  // ============================================================

  const safeCameras = useMemo(() => {
    return Array.isArray(cameras)
      ? cameras.filter(Boolean)
      : [];
  }, [cameras]);

  // ============================================================
  // FETCH EVENTS
  // ============================================================

  const fetchEvents = useCallback(async () => {
    if (safeCameras.length === 0) {
      setEvents([]);
      setBackendOnline(true);
      return;
    }

    try {
      setLoadingEvents(true);

      const results = await Promise.all(
        safeCameras.map(async (camera) => {
          const cameraId = getCameraId(camera);

          if (cameraId == null) {
            return [];
          }

          try {
            const response = await fetch(
              `${API_BASE}/api/cameras/${cameraId}/events`
            );

            if (!response.ok) {
              return [];
            }

            const data = await response.json();

            const cameraEvents =
              Array.isArray(data?.events)
                ? data.events
                : Array.isArray(data)
                ? data
                : [];

            return cameraEvents.map((event) => ({
              ...event,

              camera_id:
                event?.camera_id ?? cameraId,

              camera_name:
                event?.camera_name ||
                camera?.name ||
                `Camera ${cameraId}`,

              location:
                event?.location ||
                camera?.location ||
                "Unknown location",
            }));
          } catch (error) {
            console.error(
              `Event API error for camera ${cameraId}:`,
              error
            );

            return [];
          }
        })
      );

      const combined = results
        .flat()
        .filter(Boolean);

      combined.sort(
        (a, b) =>
          getEventTime(b) -
          getEventTime(a)
      );

      setEvents(combined);
      setBackendOnline(true);
      setLastRefresh(Date.now());
    } catch (error) {
      console.error(
        "Dashboard event fetch failed:",
        error
      );

      setBackendOnline(false);
    } finally {
      setLoadingEvents(false);
    }
  }, [safeCameras]);

  // ============================================================
  // EVENT POLLING
  // ============================================================

  useEffect(() => {
    fetchEvents();

    const interval = setInterval(
      fetchEvents,
      EVENT_POLL_INTERVAL
    );

    return () => {
      clearInterval(interval);
    };
  }, [fetchEvents]);

  // ============================================================
  // CLOCK
  // ============================================================

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // ============================================================
  // CLOSE MODAL WITH ESC
  // ============================================================

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedAlert(null);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  // ============================================================
  // START AI
  // ============================================================

  const startAI = useCallback(
    async (camera) => {
      const cameraId = getCameraId(camera);

      if (cameraId == null) {
        return;
      }

      if (
        aiStarting[cameraId] ||
        aiStarted[cameraId]
      ) {
        return;
      }

      try {
        setAiStarting((previous) => ({
          ...previous,
          [cameraId]: true,
        }));

        const response = await fetch(
          `${API_BASE}/api/cameras/${cameraId}/ai/start`,
          {
            method: "POST",
          }
        );

        let data = {};

        try {
          data = await response.json();
        } catch {
          data = {};
        }

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              data?.message ||
              "Failed to start AI"
          );
        }

        setAiStarted((previous) => ({
          ...previous,
          [cameraId]: true,
        }));

        setBackendOnline(true);

        console.log(
          `AI started for ${camera?.name || cameraId}`,
          data
        );
      } catch (error) {
        console.error(
          `AI start error for camera ${cameraId}:`,
          error
        );

        setBackendOnline(false);
      } finally {
        setAiStarting((previous) => ({
          ...previous,
          [cameraId]: false,
        }));
      }
    },
    [aiStarting, aiStarted]
  );

  // ============================================================
  // AUTO START AI
  // ============================================================

  useEffect(() => {
    safeCameras
      .filter(
        (camera) => camera?.is_active
      )
      .forEach((camera) => {
        startAI(camera);
      });
  }, [safeCameras, startAI]);

  // ============================================================
  // ACTIVE CAMERAS
  // ============================================================

  const activeCameras = useMemo(() => {
    return safeCameras.filter(
      (camera) => camera?.is_active
    ).length;
  }, [safeCameras]);

  // ============================================================
  // ALERT EVENTS
  // ============================================================

  const alertEvents = useMemo(() => {
    const cutoff =
      currentTime - ALERT_LIFETIME_MS;

    const startedEvents = events.filter(
      (event) => {
        const eventTime =
          getEventTime(event);

        if (!eventTime) {
          return false;
        }

        if (eventTime < cutoff) {
          return false;
        }

        return isStartedEvent(event);
      }
    );

    // ----------------------------------------------------------
    // Deduplicate:
    // camera + object + track + 30 second bucket
    // ----------------------------------------------------------

    const unique = [];
    const seen = new Set();

    startedEvents.forEach((event) => {
      const type = normalizeObject(
        event?.object_type
      );

      const cameraId =
        event?.camera_id ?? "unknown";

      const trackId =
        event?.track_id ?? "unknown";

      const eventTime =
        getEventTime(event);

      const bucket = Math.floor(
        eventTime / 30000
      );

      const key =
        `${cameraId}-${type}-${trackId}-${bucket}`;

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      unique.push(event);
    });

    unique.sort(
      (a, b) =>
        getEventTime(b) -
        getEventTime(a)
    );

    return unique;
  }, [events, currentTime]);

  // ============================================================
  // ACTIVE ALERT COUNT
  // ============================================================

  const activeAlerts =
    alertEvents.length;

  // ============================================================
  // EVENTS TODAY
  // ============================================================

  const eventsToday = useMemo(() => {
    const today = new Date();

    return events.filter((event) => {
      const eventTime =
        getEventTime(event);

      if (!eventTime) {
        return false;
      }

      const date =
        new Date(eventTime);

      return (
        date.getFullYear() ===
          today.getFullYear() &&
        date.getMonth() ===
          today.getMonth() &&
        date.getDate() ===
          today.getDate()
      );
    });
  }, [events]);

  // ============================================================
  // SUMMARY
  // ============================================================

  const summary = useMemo(() => {
    const cutoff =
      currentTime -
      summaryRange *
        60 *
        60 *
        1000;

    const rangeEvents = events.filter(
      (event) => {
        const time =
          getEventTime(event);

        return (
          time >= cutoff &&
          time <= currentTime
        );
      }
    );

    const meaningful =
      rangeEvents.filter(
        isStartedEvent
      );

    let humans = 0;
    let vehicles = 0;
    let other = 0;

    meaningful.forEach((event) => {
      const type =
        normalizeObject(
          event?.object_type
        );

      if (isHuman(type)) {
        humans++;
      } else if (isVehicle(type)) {
        vehicles++;
      } else {
        other++;
      }
    });

    return {
      total: meaningful.length,
      humans,
      vehicles,
      other,
    };
  }, [
    events,
    summaryRange,
    currentTime,
  ]);

  // ============================================================
  // STREAM HANDLERS
  // ============================================================

  const handleStreamLoad = (cameraId) => {
    setStreamLoading((previous) => ({
      ...previous,
      [cameraId]: false,
    }));

    setStreamErrors((previous) => {
      const next = { ...previous };
      delete next[cameraId];
      return next;
    });
  };

  const handleStreamError = (cameraId) => {
    setStreamLoading((previous) => ({
      ...previous,
      [cameraId]: false,
    }));

    setStreamErrors((previous) => ({
      ...previous,
      [cameraId]: true,
    }));
  };

  const handleStreamStart = (cameraId) => {
    setStreamLoading((previous) => ({
      ...previous,
      [cameraId]: true,
    }));
  };

  // ============================================================
  // REFRESH
  // ============================================================

  const handleRefresh = async () => {
    try {
      setRefreshing(true);

      if (refreshCameras) {
        await refreshCameras();
      }

      await fetchEvents();

      setLastRefresh(Date.now());
    } catch (error) {
      console.error(
        "Dashboard refresh error:",
        error
      );
    } finally {
      setRefreshing(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="dashboard-page">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="page-header">
        <div>
          <span className="section-label">
            SURVEILLANCE OVERVIEW
          </span>

          <h2>
            Command Center
          </h2>

          <p>
            Real-time operational overview of
            the AVEKSHA NETRA surveillance network.
          </p>
        </div>

        <div className="mission-status">
          <span
            className="status-dot"
            style={{
              opacity: backendOnline ? 1 : 0.4,
            }}
          />

          {backendOnline
            ? "ALL SYSTEMS NOMINAL"
            : "BACKEND CONNECTION LOST"}
        </div>
      </div>

      {/* ======================================================
          STAT CARDS
      ====================================================== */}

      <section className="dashboard-stats">

        {/* CAMERAS */}

        <div className="dashboard-stat">
          <div>
            <span>CAMERAS</span>

            <strong>
              {safeCameras.length}
            </strong>
          </div>

          <div className="stat-icon">
            ▣
          </div>
        </div>

        {/* ACTIVE FEEDS */}

        <div className="dashboard-stat">
          <div>
            <span>ACTIVE FEEDS</span>

            <strong>
              {activeCameras}
            </strong>
          </div>

          <div className="stat-icon">
            ◉
          </div>
        </div>

        {/* ACTIVE ALERTS */}

        <div
          className={
            `dashboard-stat ${
              activeAlerts > 0
                ? "alert-stat"
                : ""
            }`
          }
        >
          <div>
            <span>ACTIVE ALERTS</span>

            <strong>
              {activeAlerts}
            </strong>
          </div>

          <div className="stat-icon">
            △
          </div>
        </div>

        {/* EVENTS TODAY */}

        <div className="dashboard-stat">
          <div>
            <span>EVENTS TODAY</span>

            <strong>
              {eventsToday.length}
            </strong>
          </div>

          <div className="stat-icon">
            ≡
          </div>
        </div>

      </section>

      {/* ======================================================
          LIVE SURVEILLANCE
      ====================================================== */}

      <section className="dashboard-section">

        <div className="section-heading">

          <div>
            <span className="section-label">
              LIVE SURVEILLANCE
            </span>

            <h3>
              Camera Network
            </h3>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <button
              onClick={handleRefresh}
              className="camera-edit-button"
              disabled={refreshing}
            >
              {refreshing
                ? "REFRESHING..."
                : "REFRESH"}
            </button>

            <span className="feed-count">
              {safeCameras.length} SOURCES
            </span>
          </div>

        </div>

        <div className="dashboard-camera-grid">

          {safeCameras.length === 0 ? (

            <div className="no-camera">
              No surveillance sources connected.
            </div>

          ) : (

            safeCameras.map((camera) => {
              const cameraId =
                getCameraId(camera);

              const hasStreamError =
                streamErrors[cameraId];

              const isLoading =
                streamLoading[cameraId];

              return (
                <div
                  className="dashboard-camera"
                  key={cameraId}
                >

                  {/* CAMERA HEADER */}

                  <div className="feed-header">

                    <span>
                      CAM-
                      {String(cameraId).padStart(
                        3,
                        "0"
                      )}
                    </span>

                    <span className="feed-live">
                      <i />
                      {camera?.is_active
                        ? "LIVE"
                        : "OFFLINE"}
                    </span>

                  </div>

                  {/* VIDEO */}

                  <div className="feed-area">

                    {!camera?.is_active ? (

                      <div className="feed-placeholder">

                        <div className="camera-crosshair">
                          ⊕
                        </div>

                        <span>
                          CAMERA OFFLINE
                        </span>

                        <small>
                          Stream unavailable
                        </small>

                      </div>

                    ) : hasStreamError ? (

                      <div className="feed-placeholder">

                        <div className="camera-crosshair">
                          !
                        </div>

                        <span>
                          STREAM ERROR
                        </span>

                        <small>
                          AI stream unavailable
                        </small>

                        <button
                          type="button"
                          onClick={() => {
                            setStreamErrors(
                              (previous) => ({
                                ...previous,
                                [cameraId]: false,
                              })
                            );

                            setStreamLoading(
                              (previous) => ({
                                ...previous,
                                [cameraId]: true,
                              })
                            );
                          }}
                          style={{
                            marginTop: "10px",
                            padding: "7px 12px",
                            cursor: "pointer",
                          }}
                        >
                          RETRY
                        </button>

                      </div>

                    ) : (

                      <>
                        {isLoading && (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              zIndex: 2,
                              pointerEvents: "none",
                              background:
                                "rgba(0,0,0,0.25)",
                            }}
                          >
                            CONNECTING...
                          </div>
                        )}

                        <img
                          src={`${API_BASE}/api/cameras/${cameraId}/ai-stream`}
                          alt={`${camera?.name || "Camera"} AI surveillance feed`}
                          className="live-feed"
                          onLoad={() =>
                            handleStreamLoad(
                              cameraId
                            )
                          }
                          onError={() =>
                            handleStreamError(
                              cameraId
                            )
                          }
                          onLoadStart={() =>
                            handleStreamStart(
                              cameraId
                            )
                          }
                        />
                      </>

                    )}

                  </div>

                  {/* CAMERA FOOTER */}

                  <div className="feed-footer">

                    <div>
                      <strong>
                        {camera?.name ||
                          `Camera ${cameraId}`}
                      </strong>

                      <span>
                        {camera?.location ||
                          "Unknown location"}
                      </span>
                    </div>

                    <div className="camera-actions">

                      <span
                        className={
                          camera?.is_active
                            ? "feed-status active"
                            : "feed-status"
                        }
                      >
                        {camera?.is_active
                          ? "ACTIVE"
                          : "OFFLINE"}
                      </span>

                    </div>

                  </div>

                </div>
              );
            })
          )}

        </div>
      </section>

      {/* ======================================================
          ALERT TICKETS
      ====================================================== */}

      <section className="dashboard-section">

        <div className="section-heading">

          <div>
            <span className="section-label">
              THREAT MONITOR
            </span>

            <h3>
              Active Alerts
            </h3>
          </div>

          <div>
            <span className="feed-count">
              AUTO-CLEAR: 3 HOURS
            </span>
          </div>

        </div>

        <div
          style={{
            display: "grid",
            gap: "12px",
          }}
        >

          {loadingEvents &&
          alertEvents.length === 0 ? (

            <div className="empty-events">

              <div className="event-icon">
                ◌
              </div>

              <strong>
                Loading alerts...
              </strong>

              <span>
                Connecting to AI alert service.
              </span>

            </div>

          ) : alertEvents.length === 0 ? (

            <div className="empty-events">

              <div className="event-icon">
                ✓
              </div>

              <strong>
                No active alerts
              </strong>

              <span>
                The surveillance network is operating normally.
              </span>

            </div>

          ) : (

            alertEvents
              .slice(0, 10)
              .map((alert, index) => (

                <button
                  type="button"
                  key={
                    `${alert?.camera_id || "camera"}-${
                      alert?.id || "event"
                    }-${index}`
                  }
                  onClick={() =>
                    setSelectedAlert(alert)
                  }
                  style={{
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    border:
                      "1px solid rgba(255,255,255,0.08)",
                    background:
                      "rgba(255,255,255,0.025)",
                    padding: "18px",
                    borderRadius: "10px",
                    display: "grid",
                    gridTemplateColumns:
                      "50px 1fr auto",
                    gap: "16px",
                    alignItems: "center",
                    color: "inherit",
                  }}
                >

                  {/* ICON */}

                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                      border:
                        "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    {getAlertIcon(alert)}
                  </div>

                  {/* MAIN */}

                  <div>

                    <strong
                      style={{
                        display: "block",
                        marginBottom: "6px",
                      }}
                    >
                      {getAlertTitle(alert)}
                    </strong>

                    <span
                      style={{
                        display: "block",
                        opacity: 0.75,
                        fontSize: "13px",
                      }}
                    >
                      CAM-
                      {String(
                        alert?.camera_id ?? "--"
                      ).padStart(3, "0")}

                      {" • "}

                      {alert?.camera_name ||
                        "Unknown camera"}
                    </span>

                    <small
                      style={{
                        display: "block",
                        marginTop: "4px",
                        opacity: 0.55,
                      }}
                    >
                      {getAlertDescription(alert)}
                    </small>

                  </div>

                  {/* META */}

                  <div
                    style={{
                      textAlign: "right",
                      display: "grid",
                      gap: "5px",
                    }}
                  >

                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      {getSeverity(alert)}
                    </span>

                    <span
                      style={{
                        fontSize: "12px",
                        opacity: 0.7,
                      }}
                    >
                      {formatTime(
                        alert?.timestamp ||
                          alert?.first_seen
                      )}
                    </span>

                    <span
                      style={{
                        fontSize: "11px",
                        opacity: 0.5,
                      }}
                    >
                      CLICK FOR DETAILS
                    </span>

                  </div>

                </button>
              ))
          )}

        </div>
      </section>

      {/* ======================================================
          ALERT DETAIL MODAL
      ====================================================== */}

      {selectedAlert && (

        <div
          onClick={() =>
            setSelectedAlert(null)
          }
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >

          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: "min(650px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              border:
                "1px solid rgba(255,255,255,0.12)",
              borderRadius: "14px",
              background: "#11151a",
              padding: "28px",
              boxShadow:
                "0 20px 70px rgba(0,0,0,0.5)",
            }}
          >

            {/* HEADER */}

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "flex-start",
                gap: "20px",
              }}
            >

              <div>

                <span className="section-label">
                  ALERT DETAILS
                </span>

                <h2
                  style={{
                    marginTop: "8px",
                    marginBottom: "5px",
                  }}
                >
                  {getAlertTitle(
                    selectedAlert
                  )}
                </h2>

                <p
                  style={{
                    margin: 0,
                    opacity: 0.7,
                  }}
                >
                  AI-generated surveillance alert
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedAlert(null)
                }
                style={{
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "22px",
                  cursor: "pointer",
                }}
                aria-label="Close alert"
              >
                ×
              </button>

            </div>

            {/* DESCRIPTION */}

            <div
              style={{
                marginTop: "24px",
                padding: "18px",
                borderRadius: "10px",
                background:
                  "rgba(255,255,255,0.04)",
              }}
            >
              <strong>
                {getAlertDescription(
                  selectedAlert
                )}
              </strong>
            </div>

            {/* DETAILS */}

            <div
              style={{
                marginTop: "20px",
                display: "grid",
                gap: "12px",
              }}
            >

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "20px",
                }}
              >
                <span>OBJECT</span>

                <strong>
                  {capitalize(
                    selectedAlert?.object_type
                  )}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "20px",
                }}
              >
                <span>CAMERA</span>

                <strong>
                  CAM-
                  {String(
                    selectedAlert?.camera_id ??
                      "--"
                  ).padStart(3, "0")}

                  {" • "}

                  {selectedAlert?.camera_name ||
                    "Unknown camera"}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "20px",
                }}
              >
                <span>LOCATION</span>

                <strong>
                  {selectedAlert?.location ||
                    "Unknown"}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "20px",
                }}
              >
                <span>TRACK ID</span>

                <strong>
                  #
                  {selectedAlert?.track_id ??
                    "--"}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "20px",
                }}
              >
                <span>CONFIDENCE</span>

                <strong>
                  {getConfidence(
                    selectedAlert
                  )}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "20px",
                }}
              >
                <span>DETECTED AT</span>

                <strong>
                  {formatDateTime(
                    selectedAlert?.timestamp ||
                      selectedAlert?.first_seen
                  )}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "20px",
                }}
              >
                <span>SEVERITY</span>

                <strong>
                  {getSeverity(
                    selectedAlert
                  )}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "20px",
                }}
              >
                <span>STATUS</span>

                <strong>
                  {selectedAlert?.status ||
                    "ACTIVE"}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "20px",
                }}
              >
                <span>AUTO CLEAR</span>

                <strong>
                  3 HOURS
                </strong>
              </div>

            </div>

            {/* CLOSE */}

            <button
              type="button"
              onClick={() =>
                setSelectedAlert(null)
              }
              style={{
                marginTop: "26px",
                width: "100%",
                padding: "12px",
                cursor: "pointer",
                borderRadius: "8px",
                border:
                  "1px solid rgba(255,255,255,0.15)",
                background:
                  "rgba(255,255,255,0.05)",
                color: "inherit",
                fontWeight: 700,
              }}
            >
              CLOSE ALERT
            </button>

          </div>
        </div>
      )}

      {/* ======================================================
          LOWER DASHBOARD
      ====================================================== */}

      <section className="dashboard-lower">

        {/* ====================================================
            EVENT MONITOR
        ==================================================== */}

        <div className="panel">

          <div className="panel-header">

            <div>

              <span className="section-label">
                EVENT MONITOR
              </span>

              <h3>
                Recent Events
              </h3>

            </div>

            <span className="panel-count">
              {events.length} EVENTS
            </span>

          </div>

          <div className="events-list">

            {events.length === 0 ? (

              <div className="empty-events">

                <div className="event-icon">
                  ≡
                </div>

                <strong>
                  No events recorded
                </strong>

                <span>
                  Detection events will appear here.
                </span>

              </div>

            ) : (

              events
                .slice(0, 12)
                .map((event, index) => (

                  <div
                    className="event-row"
                    key={
                      `${event?.camera_id || "camera"}-${
                        event?.id || "event"
                      }-${index}`
                    }
                  >

                    <div className="event-icon-small">
                      {getAlertIcon(event)}
                    </div>

                    <div className="event-main">

                      <strong>
                        {String(
                          event?.object_type ||
                            "UNKNOWN"
                        ).toUpperCase()}
                      </strong>

                      <span>
                        CAM-
                        {String(
                          event?.camera_id ??
                            "--"
                        ).padStart(3, "0")}

                        {" • "}

                        {event?.camera_name ||
                          "Unknown camera"}
                      </span>

                      <small>
                        {event?.location ||
                          "Unknown location"}
                      </small>

                    </div>

                    <div className="event-meta">

                      <span
                        className={
                          isStartedEvent(event)
                            ? "event-active"
                            : "event-ended"
                        }
                      >
                        {event?.status ||
                          event?.type ||
                          "EVENT"}
                      </span>

                      <span>
                        TRACK #
                        {event?.track_id ??
                          "--"}
                      </span>

                      <span>
                        {getConfidence(event)}
                      </span>

                      <span>
                        {formatTime(
                          event?.timestamp ||
                            event?.first_seen
                        )}
                      </span>

                    </div>

                  </div>
                ))
            )}

          </div>
        </div>

        {/* ====================================================
            ALERT STATUS + SUMMARY
        ==================================================== */}

        <div className="panel">

          <div className="panel-header">

            <div>

              <span className="section-label">
                THREAT MONITOR
              </span>

              <h3>
                Alert Status
              </h3>

            </div>

            <span
              className={
                activeAlerts > 0
                  ? "secure-badge alert-badge"
                  : "secure-badge"
              }
            >
              {activeAlerts > 0
                ? "ATTENTION"
                : "SECURE"}
            </span>

          </div>

          {/* THREAT STATUS */}

          <div className="threat-status">

            <div
              className={
                activeAlerts > 0
                  ? "threat-ring threat-active"
                  : "threat-ring"
              }
            >
              {activeAlerts > 0
                ? "!"
                : "✓"}
            </div>

            <strong>
              {activeAlerts > 0
                ? `${activeAlerts} Active Alert${
                    activeAlerts > 1
                      ? "s"
                      : ""
                  }`
                : "No Active Threats"}
            </strong>

            <span>
              {activeAlerts > 0
                ? "AI detection events require attention."
                : "Surveillance network is operating normally."}
            </span>

          </div>

          {/* AI SUMMARY */}

          <div
            style={{
              marginTop: "25px",
            }}
          >

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >

              <strong>
                AI ACTIVITY SUMMARY
              </strong>

              <select
                value={summaryRange}
                onChange={(event) =>
                  setSummaryRange(
                    Number(
                      event.target.value
                    )
                  )
                }
                style={{
                  padding: "7px 10px",
                  borderRadius: "6px",
                  background:
                    "rgba(255,255,255,0.06)",
                  color: "inherit",
                  border:
                    "1px solid rgba(255,255,255,0.15)",
                }}
              >

                <option value={1}>
                  LAST 1 HOUR
                </option>

                <option value={3}>
                  LAST 3 HOURS
                </option>

                <option value={6}>
                  LAST 6 HOURS
                </option>

                <option value={12}>
                  LAST 12 HOURS
                </option>

                <option value={24}>
                  LAST 24 HOURS
                </option>

              </select>

            </div>

            {/* TOTAL */}

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                padding: "12px 0",
                borderBottom:
                  "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span>
                TOTAL ALERTS
              </span>

              <strong>
                {summary.total}
              </strong>
            </div>

            {/* HUMANS */}

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                padding: "12px 0",
                borderBottom:
                  "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span>
                HUMANS DETECTED
              </span>

              <strong>
                {summary.humans}
              </strong>
            </div>

            {/* VEHICLES */}

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                padding: "12px 0",
                borderBottom:
                  "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span>
                VEHICLES DETECTED
              </span>

              <strong>
                {summary.vehicles}
              </strong>
            </div>

            {/* OTHER */}

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                padding: "12px 0",
              }}
            >
              <span>
                OTHER OBJECTS
              </span>

              <strong>
                {summary.other}
              </strong>
            </div>

          </div>

          {/* LAST REFRESH */}

          <div
            style={{
              marginTop: "18px",
              fontSize: "11px",
              opacity: 0.5,
            }}
          >
            LAST UPDATED:{" "}
            {lastRefresh
              ? formatDateTime(lastRefresh)
              : "WAITING..."}
          </div>

        </div>
      </section>

    </div>
  );
}

export default Dashboard;
